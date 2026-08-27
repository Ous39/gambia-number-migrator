import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';
import type { CleanupCandidate, ContactLike, MigrationCandidate, PublishedRulesPayload } from '@gnm/shared';
import { findCleanupCandidates, formatMigratedLikeOriginal, generateMigrationCandidates, hasApprovedMigrationRules, normalizeGambianPhone, verifyMigratedPair } from '@gnm/shared';
import { appendHistory, getBackupRecords, getJson, keys, loadBackupItems, saveBackupRecord, setJson } from './storage';

type ScanProgress = { processed: number; total: number; percent: number };
export type MigrationProgress = { processed: number; total: number; percent: number; succeeded: number; skipped: number; failed: number };

type ExpoPhone = { id?: string; label?: string; number?: string; digits?: string };

function phoneText(phone: ExpoPhone): string {
  return String(phone.number || phone.digits || '');
}

function sameNormalizedPhone(rawA: string, rawB: string): boolean {
  const a = normalizeGambianPhone(rawA);
  const b = normalizeGambianPhone(rawB);
  return a.type !== 'invalid' && b.type !== 'invalid' && a.localDigits === b.localDigits;
}

function isSelectedOldPhone(phone: ExpoPhone, item: MigrationCandidate, index: number): boolean {
  const byIndex = index === item.phoneIndex && sameNormalizedPhone(phoneText(phone), item.normalizedOldNumber || item.originalNumber);
  const byNumber = sameNormalizedPhone(phoneText(phone), item.normalizedOldNumber || item.originalNumber);
  return byIndex || byNumber;
}

function migrationKey(item: Pick<MigrationCandidate, 'contactId' | 'phoneIndex' | 'originalNumber' | 'migratedNumber'>): string {
  return `${item.contactId}:${item.phoneIndex}:${item.originalNumber}:${item.migratedNumber || 'review'}`;
}

// Bump whenever a saved scan's shape changes in a way that affects list-item
// identity (e.g. the phoneIndex field). A cached scan from before the bump is
// treated as stale and forces a rescan, instead of silently reusing candidates
// that are missing the new field and colliding in FlatList keys.
export const SCAN_SCHEMA_VERSION = 2;

async function updateStoredScanAfterMigration(selected: MigrationCandidate[], successKeys: Set<string>, nextStatus: MigrationCandidate['status'], reason: string) {
  if (!successKeys.size) return;
  const scan = await getJson<any>(keys.scan, null).catch(() => null);
  if (!scan?.candidates?.length) return;

  const selectedByKey = new Map(selected.map((item) => [migrationKey(item), item]));
  const nextCandidates = (scan.candidates || []).map((candidate: MigrationCandidate) => {
    const key = migrationKey(candidate);
    if (!successKeys.has(key)) return candidate;
    const selectedItem = selectedByKey.get(key) || candidate;
    return {
      ...candidate,
      migratedNumber: candidate.migratedNumber || selectedItem.migratedNumber,
      status: nextStatus,
      reason,
    };
  });

  const summary = {
    ready: nextCandidates.filter((candidate: MigrationCandidate) => candidate.status === 'Ready').length,
    alreadyUpdated: nextCandidates.filter((candidate: MigrationCandidate) => ['Duplicate Pair Found', 'Already Added', 'Already Updated'].includes(candidate.status)).length,
    review: nextCandidates.filter((candidate: MigrationCandidate) => ['Manual Review', 'Duplicate Risk', 'Invalid', 'Unsafe'].includes(candidate.status)).length,
    unchangedContacts: Number(scan.summary?.unchangedContacts || 0),
  };

  await setJson(keys.scan, {
    ...scan,
    candidates: nextCandidates,
    summary,
    lastUpdatedAt: new Date().toISOString(),
  }).catch(() => undefined);
}

// Migration, cleanup, backup and restore all mutate or read the same on-device
// contacts store. Running two of them at once (e.g. a restore started while a
// migration is mid-flight after leaving and reopening the app) can race and
// leave contacts in an inconsistent state, so every entry point checks first.
async function assertNoConflictingOperation(kind: 'migration' | 'cleanup' | 'backup' | 'restore') {
  const migrationJob = await getJson<any>(keys.migrationJob, null).catch(() => null);
  if (kind !== 'migration' && migrationJob?.status === 'running') {
    throw new Error('A migration is still in progress on this device. Open Preview to finish or resume it before starting this action.');
  }
  const operationJob = await getJson<any>(keys.operationJob, null).catch(() => null);
  if (operationJob?.status === 'running' && operationJob.kind !== kind) {
    throw new Error(`${operationJob.title || 'Another operation'} is still in progress. Wait for it to finish before starting this action.`);
  }
}

export async function ensureContactPermission() {
  if (Platform.OS === 'web') {
    throw new Error('Contact scanning requires a mobile device. Open this app in Expo Go on your phone.');
  }
  const current = await Contacts.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Contacts.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function loadDeviceContacts(onProgress?: (progress: ScanProgress) => void): Promise<ContactLike[]> {
  const ok = await ensureContactPermission();
  if (!ok) throw new Error('Contacts permission is required to scan. Contacts stay on your device and are not uploaded.');

  const res = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.Company]
  });

  const total = res.data.length;
  if (!total) throw new Error('No contacts were returned by this phone. Confirm Contacts permission is set to Allow, add at least one test contact with a phone number, then scan again.');
  const contacts: ContactLike[] = [];

  for (let i = 0; i < total; i++) {
    const c = res.data[i];
    if (c.phoneNumbers?.length) {
      contacts.push({
        id: c.id || String(i),
        name: c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Contact',
        phoneNumbers: (c.phoneNumbers || []).map((p: ExpoPhone) => ({ id: p.id, label: p.label, number: phoneText(p) }))
      });
    }

    if ((i + 1) % 50 === 0 || i === total - 1) {
      onProgress?.({ processed: i + 1, total, percent: total ? Math.round(((i + 1) / total) * 100) : 100 });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  if (!contacts.length) throw new Error(`The phone returned ${total} contact${total === 1 ? '' : 's'}, but none had a readable phone number. Add a number to a test contact and try again.`);
  return contacts;
}

export async function scanContacts(
  payload: PublishedRulesPayload,
  updateMode: 'duplicate' | 'replace',
  onProgress?: (progress: ScanProgress) => void
) {
  if (!hasApprovedMigrationRules(payload)) throw new Error('Verified migration rules are required. Ask the administrator to publish the official operator ranges, then refresh the dashboard.');
  const started = Date.now();
  const contacts = await loadDeviceContacts(onProgress);
  const candidates = generateMigrationCandidates(contacts, payload, updateMode);
  const cleanup = findCleanupCandidates(contacts, payload);
  const candidateContactIds = new Set(candidates.map((candidate) => candidate.contactId));
  const result = {
    contactsCount: contacts.length,
    candidates,
    cleanup,
    summary: {
      ready: candidates.filter((candidate) => candidate.status === 'Ready').length,
      alreadyUpdated: candidates.filter((candidate) => ['Duplicate Pair Found', 'Already Added', 'Already Updated'].includes(candidate.status)).length,
      review: candidates.filter((candidate) => ['Manual Review', 'Duplicate Risk', 'Invalid', 'Unsafe'].includes(candidate.status)).length,
      unchangedContacts: Math.max(0, contacts.length - candidateContactIds.size),
    },
    date: new Date().toISOString(),
    durationMs: Date.now() - started,
    rulesVersion: payload.versionNumber,
    schemaVersion: SCAN_SCHEMA_VERSION
  };
  await setJson(keys.scan, result);
  await appendHistory({
    operationType: 'scan',
    numberScanned: contacts.length,
    numberAdded: 0,
    numberReplaced: 0,
    numberRemoved: 0,
    numberSkipped: 0,
    numberFailed: 0,
    duration: result.durationMs,
    rulesVersionUsed: payload.versionNumber,
    status: 'success'
  });
  return result;
}

async function createBackup(operationType: string, items: any[], metadata: Record<string, any> = {}) {
  const backup = {
    id: `BKP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    operationType,
    date: new Date().toISOString(),
    itemCount: items.length,
    items,
    ...metadata,
  };
  await saveBackupRecord(backup);
  return backup;
}

function cleanStoredPhones(phoneNumbers: ExpoPhone[] = []) {
  return phoneNumbers.map((p) => ({ id: p.id, label: p.label || 'mobile', number: phoneText(p) }));
}

async function createOldMigrationBackup(operationType: string, selected: any[]) {
  if (!selected.length) throw new Error('Select at least one contact number before continuing.');
  const items: any[] = [];

  for (const item of selected) {
    let beforePhoneNumbers: any[] = cleanStoredPhones((item.beforePhoneNumbers || []) as ExpoPhone[]);
    let contactName = item.contactName;

    // Current scan results already contain the local phone snapshot. Fall back
    // to the Contacts provider only for legacy scans created before v2.4.
    if (!beforePhoneNumbers.length) {
      const contact = await Contacts.getContactByIdAsync(item.contactId, [Contacts.Fields.PhoneNumbers, Contacts.Fields.FirstName, Contacts.Fields.LastName]);
      if (!contact) throw new Error(`Could not read ${item.contactName || 'a selected contact'} for backup. No contacts were changed.`);
      beforePhoneNumbers = cleanStoredPhones((contact.phoneNumbers || []) as ExpoPhone[]);
      contactName = contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || item.contactName;
    }
    if (!beforePhoneNumbers.length) throw new Error(`No phone numbers were found for ${item.contactName || 'a selected contact'}. No contacts were changed.`);

    items.push({
      ...item,
      contactName,
      beforePhoneNumbers,
      backupScope: 'old_migration',
      oldNumber: item.normalizedOldNumber || item.oldNumber || item.originalNumber,
      newNumber: item.migratedNumber || item.newNumber,
    });
  }

  return createBackup(operationType, items, {
    backupScope: 'old_migration',
    backupTitle: operationType === 'replace_update' ? 'Old migration backup - replace' : operationType === 'duplicate_cleanup' ? 'Old migration backup - cleanup' : 'Old migration backup - add',
    restoreStrategy: 'exact_phone_snapshot_first',
  });
}

async function currentApprovedRules() {
  const rules = await getJson<PublishedRulesPayload>(keys.rules, { versionNumber: 0, publishedAt: '', operators: [], rules: [] });
  if (!hasApprovedMigrationRules(rules)) throw new Error('Verified official migration rules are unavailable. Refresh the dashboard before changing contacts.');
  return rules;
}

async function validateMigrationSelection(selected: MigrationCandidate[]) {
  if (!selected.length) throw new Error('Select at least one ready number before continuing.');
  const rules = await currentApprovedRules();
  for (const item of selected) {
    if (item.status !== 'Ready' || !item.migratedNumber) throw new Error(`${item.contactName || 'A selected contact'} is no longer ready to migrate. Scan again.`);
    const verification = verifyMigratedPair(item.originalNumber, item.migratedNumber, rules);
    if (!verification.matched || verification.matchedRuleId !== item.matchedRuleId) throw new Error(`Migration rules changed for ${item.contactName || item.originalNumber}. Scan again before updating.`);
  }
  return rules;
}

async function readContactPhones(contactId: string) {
  const contact = await Contacts.getContactByIdAsync(contactId, [Contacts.Fields.PhoneNumbers]);
  if (!contact) throw new Error('Contact no longer exists.');
  return { contact, phoneNumbers: [...((contact.phoneNumbers || []) as ExpoPhone[])] };
}

function isRestrictedContactError(error: any) {
  const raw = String(error?.message || error || 'The contacts provider rejected the update.');
  return /OperationApplicationException|insert failed|returned no result|read.?only/i.test(raw);
}

function contactWriteError(error: any) {
  const raw = String(error?.message || error || 'The contacts provider rejected the update.');
  return new Error(isRestrictedContactError(error)
    ? 'Android could not write this contact. It may be stored on the SIM, WhatsApp, or a read-only/synced account. Move or copy it to the Phone or Google contacts account, then try again.'
    : raw);
}

type ContactWriteResult = { copied: boolean; contactId: string };

type WritableContactCopy = { sourceContactId: string; writableContactId: string; createdAt: string; backupIds?: string[] };

async function createOrUpdateWritableCopy(sourceContactId: string, expected: ExpoPhone[], fallbackName?: string, backupId?: string): Promise<ContactWriteResult> {
  const copies = await getJson<WritableContactCopy[]>(keys.writableContactCopies, []);
  const existing = copies.find((entry) => entry.sourceContactId === sourceContactId);
  const source = await Contacts.getContactByIdAsync(sourceContactId);
  const firstName = String(source?.firstName || source?.name || fallbackName || 'Migrated contact').trim();
  const copyPhones = expected.map((phone) => ({ label: phone.label || 'mobile', number: phoneText(phone) }));

  if (existing) {
    const writable = await Contacts.getContactByIdAsync(existing.writableContactId, [Contacts.Fields.PhoneNumbers]);
    if (writable) {
      await Contacts.updateContactAsync({ id: existing.writableContactId, phoneNumbers: copyPhones } as any);
      if (backupId && !existing.backupIds?.includes(backupId)) {
        existing.backupIds = [...(existing.backupIds || []), backupId];
        await setJson(keys.writableContactCopies, copies);
      }
      return { copied: true, contactId: existing.writableContactId };
    }
  }

  const writableContactId = await Contacts.addContactAsync({
    firstName,
    ...(source?.lastName ? { lastName: source.lastName } : {}),
    ...(source?.company ? { company: source.company } : {}),
    phoneNumbers: copyPhones,
    note: 'Writable safety copy created by Gambia Number Migrator',
  } as any);
  const next = [{ sourceContactId, writableContactId, createdAt: new Date().toISOString(), backupIds: backupId ? [backupId] : [] }, ...copies.filter((entry) => entry.sourceContactId !== sourceContactId)].slice(0, 10000);
  await setJson(keys.writableContactCopies, next);
  return { copied: true, contactId: writableContactId };
}

async function writeContactPhones(contactId: string, expected: ExpoPhone[], fallbackName?: string, allowWritableCopy = false, backupId?: string): Promise<ContactWriteResult> {
  const payload = expected.map((phone) => ({
    ...(phone.id ? { id: phone.id } : {}),
    label: phone.label || 'mobile',
    number: phoneText(phone),
  }));

  try {
    // Only send the field GNM changes. Spreading the complete Expo contact can
    // make Android attempt to insert account-owned/read-only data rows.
    await Contacts.updateContactAsync({ id: contactId, phoneNumbers: payload } as any);
    return { copied: false, contactId };
  } catch (firstError) {
    // Android contact providers can return stale data-row ids after a sync.
    // Re-read once and retry with current ids before reporting the contact.
    try {
      const fresh = await Contacts.getContactByIdAsync(contactId, [Contacts.Fields.PhoneNumbers]);
      if (!fresh) throw firstError;
      const freshPhones = (fresh.phoneNumbers || []) as ExpoPhone[];
      const retryPayload = payload.map((phone) => {
        if (!phone.id) return phone;
        const current = freshPhones.find((candidate) => candidate.id === phone.id)
          || freshPhones.find((candidate) => sameNormalizedPhone(phoneText(candidate), phone.number));
        return { ...phone, ...(current?.id ? { id: current.id } : {}) };
      });
      await Contacts.updateContactAsync({ id: contactId, phoneNumbers: retryPayload } as any);
      return { copied: false, contactId };
    } catch (retryError) {
      if (allowWritableCopy && Platform.OS === 'android' && isRestrictedContactError(retryError)) {
        try {
          return await createOrUpdateWritableCopy(contactId, expected, fallbackName, backupId);
        } catch (copyError) {
          throw contactWriteError(copyError);
        }
      }
      throw contactWriteError(retryError);
    }
  }
}

function phoneSnapshot(phones: ExpoPhone[]) {
  return phones.map((phone) => phoneText(phone).replace(/\D/g, '')).filter(Boolean).sort();
}

async function updateAndVerifyPhones(contact: any, expected: ExpoPhone[]) {
  await writeContactPhones(contact.id, expected);
  const verified = await Contacts.getContactByIdAsync(contact.id, [Contacts.Fields.PhoneNumbers]);
  if (!verified || JSON.stringify(phoneSnapshot((verified.phoneNumbers || []) as ExpoPhone[])) !== JSON.stringify(phoneSnapshot(expected))) {
    throw new Error('The phone did not confirm the restored contact numbers.');
  }
}

export async function createFullContactsBackup(onProgress?: (progress: ScanProgress) => void) {
  await assertNoConflictingOperation('backup');
  const contacts = await loadDeviceContacts(onProgress);
  if (!contacts.length) throw new Error('No contacts with phone numbers were found, so no backup was created.');
  const items = contacts.map((contact) => ({
    contactId: contact.id,
    contactName: contact.name,
    phoneNumbers: contact.phoneNumbers || []
  }));
  const backup = await createBackup('manual_full_backup', items, { backupScope: 'full_contacts', backupTitle: 'Full contacts backup', restoreStrategy: 'full_contact_snapshot' });
  await appendHistory({
    operationType: 'manual_full_backup',
    numberScanned: contacts.length,
    backupId: backup.id,
    status: 'success'
  });
  return { backupId: backup.id, itemCount: items.length };
}

async function loadMigrationJob(operation: string, selected: MigrationCandidate[]) {
  const existing = await getJson<any>(keys.migrationJob, null).catch(() => null);
  const selectedKeys = selected.map(migrationKey);
  const existingKeys = Array.isArray(existing?.selectedKeys) ? existing.selectedKeys : [];
  const sameSelection = existing?.operation === operation
    && existingKeys.length === selectedKeys.length
    && selectedKeys.every((key) => existingKeys.includes(key));
  if (existing?.status === 'running' && !sameSelection) throw new Error('Another migration is unfinished. Re-select the same contacts to resume it, or restore its backup before starting a different migration.');
  if (sameSelection) return existing;
  const job = { id: `JOB-${Date.now()}`, operation, status: 'running', selectedKeys, completedKeys: [], successKeys: [], succeeded: 0, skipped: 0, failed: 0, createdAt: new Date().toISOString() };
  await setJson(keys.migrationJob, job);
  return job;
}

async function checkpointJob(job: any, force = false) {
  // Persist checkpoints often enough to resume safely without serializing a
  // growing job object after every contact. Large phonebooks otherwise spend
  // more time copying JSON than updating the Contacts provider.
  if (force || job.completedKeys.length % 100 === 0) await setJson(keys.migrationJob, { ...job, updatedAt: new Date().toISOString() });
}

function markJobComplete(job: any, completed: Set<string>, itemKey: string, succeeded: number, skipped: number, failed: number, successful = false) {
  completed.add(itemKey);
  if (!Array.isArray(job.completedKeys)) job.completedKeys = [];
  job.completedKeys.push(itemKey);
  if (!Array.isArray(job.successKeys)) job.successKeys = [];
  if (successful && !job.successKeys.includes(itemKey)) job.successKeys.push(itemKey);
  job.succeeded = succeeded;
  job.skipped = skipped;
  job.failed = failed;
}

function groupByContact<T extends { contactId: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => groups.set(item.contactId, [...(groups.get(item.contactId) || []), item]));
  return [...groups.values()];
}

async function yieldToInterface() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function shouldVerifyWrite(processed: number) {
  // Native Contacts writes reject on failure. Re-read the first few writes and
  // periodic samples for safety without doubling every operation on 10k+ runs.
  return processed < 3 || (processed + 1) % 100 === 0;
}

function emitMigrationProgress(job: any, total: number, onProgress?: (progress: MigrationProgress) => void) {
  const processed = job.completedKeys.length;
  onProgress?.({ processed, total, percent: total ? Math.round((processed / total) * 100) : 100, succeeded: job.succeeded, skipped: job.skipped, failed: job.failed });
}

export async function applyDuplicateAdd(selected: MigrationCandidate[], onProgress?: (progress: MigrationProgress) => void, shouldPause?: () => boolean) {
  await assertNoConflictingOperation('migration');
  const permitted = await ensureContactPermission();
  if (!permitted) throw new Error('Contacts permission is required to migrate numbers. Contacts stay on your device and are not uploaded.');
  await validateMigrationSelection(selected);
  const job = await loadMigrationJob('duplicate_add', selected);
  const backup = job.backupId ? { id: job.backupId } : await createOldMigrationBackup('duplicate_add', selected);
  job.backupId = backup.id;
  await checkpointJob(job, true);
  let added = Number(job.succeeded || 0);
  let skipped = Number(job.skipped || 0);
  let failed = Number(job.failed || 0);
  const failureDetails: Array<{ contactName: string; number: string; reason: string }> = [];
  const successKeys = new Set<string>(job.successKeys || []);
  const completed = new Set<string>(job.completedKeys || []);

  for (const group of groupByContact(selected)) {
    if (shouldPause?.()) { await checkpointJob(job, true); throw new Error('Migration paused safely. Re-select the same contacts to resume from this checkpoint.'); }
    const pending = group.filter((item) => !completed.has(migrationKey(item)));
    if (!pending.length) continue;
    const valid = pending.filter((item) => item.migratedNumber && item.status !== 'Manual Review' && item.status !== 'Unsafe');
    const invalid = pending.filter((item) => !valid.includes(item));
    for (const item of invalid) {
      skipped++;
      markJobComplete(job, completed, migrationKey(item), added, skipped, failed);
    }
    if (valid.length) try {
      const { contact, phoneNumbers } = await readContactPhones(valid[0].contactId);
      const next = [...phoneNumbers];
      const planned: MigrationCandidate[] = [];
      for (const item of valid) {
        const oldStillExists = next.some((p, index) => isSelectedOldPhone(p, item, index));
        const newAlreadyExists = next.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!));
        if (!oldStillExists || newAlreadyExists) {
          skipped++;
          markJobComplete(job, completed, migrationKey(item), added, skipped, failed);
        } else {
          next.push({ label: item.phoneLabel || 'mobile', number: formatMigratedLikeOriginal(item.originalNumber, item.migratedNumber!) });
          planned.push(item);
        }
      }
      if (planned.length) {
        const writeResult = await writeContactPhones(contact.id, next, planned[0].contactName, true, backup.id);
        if (shouldVerifyWrite(job.completedKeys.length)) {
          const verified = await readContactPhones(writeResult.contactId);
          if (planned.some((item) => !verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!)))) throw new Error('Contact update could not be verified.');
        }
        if (writeResult.copied) job.copied = Number(job.copied || 0) + 1;
        for (const item of planned) {
          added++;
          const itemKey = migrationKey(item);
          successKeys.add(itemKey);
          markJobComplete(job, completed, itemKey, added, skipped, failed, true);
        }
      }
    } catch (error: any) {
      for (const item of valid.filter((candidate) => !completed.has(migrationKey(candidate)))) {
        failed++;
        failureDetails.push({ contactName: item.contactName || 'Unnamed contact', number: item.originalNumber, reason: error?.message || 'The contacts provider rejected the update.' });
        markJobComplete(job, completed, migrationKey(item), added, skipped, failed);
      }
    }
    await checkpointJob(job); emitMigrationProgress(job, selected.length, onProgress);
    await yieldToInterface();
  }

  await updateStoredScanAfterMigration(selected, successKeys, 'Duplicate Pair Found', 'New 9-digit number was added during the latest migration.');

  await appendHistory({
    operationType: 'duplicate_add',
    numberAdded: added,
    numberCopied: Number(job.copied || 0),
    numberSkipped: skipped,
    numberFailed: failed,
    backupId: backup.id,
    status: failed ? 'partial' : 'success',
    failureDetails
  });
  await setJson(keys.migrationJob, null);
  return { added, copied: Number(job.copied || 0), skipped, failed, backupId: backup.id, failureDetails };
}

export async function applyReplace(selected: MigrationCandidate[], onProgress?: (progress: MigrationProgress) => void, shouldPause?: () => boolean) {
  await assertNoConflictingOperation('migration');
  const permitted = await ensureContactPermission();
  if (!permitted) throw new Error('Contacts permission is required to migrate numbers. Contacts stay on your device and are not uploaded.');
  await validateMigrationSelection(selected);
  const transition = await getJson<any>(keys.transition, null);
  if (!transition?.allowReplaceMode) throw new Error('Replace mode is disabled by the administrator. Use Add & Keep Old instead.');
  const job = await loadMigrationJob('replace_update', selected);
  const backup = job.backupId ? { id: job.backupId } : await createOldMigrationBackup('replace_update', selected);
  job.backupId = backup.id; await checkpointJob(job, true);
  let replaced = Number(job.succeeded || 0);
  let skipped = Number(job.skipped || 0);
  let failed = Number(job.failed || 0);
  const failureDetails: Array<{ contactName: string; number: string; reason: string }> = [];
  const successKeys = new Set<string>(job.successKeys || []);
  const completed = new Set<string>(job.completedKeys || []);

  for (const group of groupByContact(selected)) {
    if (shouldPause?.()) { await checkpointJob(job, true); throw new Error('Migration paused safely. Re-select the same contacts to resume from this checkpoint.'); }
    const pending = group.filter((item) => !completed.has(migrationKey(item)));
    if (!pending.length) continue;
    const valid = pending.filter((item) => item.migratedNumber && item.status !== 'Manual Review' && item.status !== 'Unsafe');
    for (const item of pending.filter((item) => !valid.includes(item))) {
      skipped++;
      markJobComplete(job, completed, migrationKey(item), replaced, skipped, failed);
    }
    if (valid.length) try {
      const { contact, phoneNumbers } = await readContactPhones(valid[0].contactId);
      let next = [...phoneNumbers];
      const planned: MigrationCandidate[] = [];
      for (const item of valid) {
        const oldIndex = next.findIndex((p, index) => isSelectedOldPhone(p, item, index));
        if (oldIndex < 0) {
          skipped++;
          markJobComplete(job, completed, migrationKey(item), replaced, skipped, failed);
          continue;
        }
        const newAlreadyExists = next.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!));
        next = newAlreadyExists
          ? next.filter((_p, index) => index !== oldIndex)
          : next.map((p, index) => (index === oldIndex ? { ...p, number: formatMigratedLikeOriginal(phoneText(p), item.migratedNumber!) } : p));
        planned.push(item);
      }
      if (planned.length) {
        const writeResult = await writeContactPhones(contact.id, next, planned[0].contactName, true, backup.id);
        if (shouldVerifyWrite(job.completedKeys.length)) {
          const verified = await readContactPhones(writeResult.contactId);
          if (planned.some((item) => !verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!)))) throw new Error('Contact replacement could not be verified.');
        }
        if (writeResult.copied) job.copied = Number(job.copied || 0) + 1;
        for (const item of planned) {
          replaced++;
          const itemKey = migrationKey(item);
          successKeys.add(itemKey);
          markJobComplete(job, completed, itemKey, replaced, skipped, failed, true);
        }
      }
    } catch (error: any) {
      for (const item of valid.filter((candidate) => !completed.has(migrationKey(candidate)))) {
        failed++;
        failureDetails.push({ contactName: item.contactName || 'Unnamed contact', number: item.originalNumber, reason: error?.message || 'The contacts provider rejected the replacement.' });
        markJobComplete(job, completed, migrationKey(item), replaced, skipped, failed);
      }
    }
    await checkpointJob(job); emitMigrationProgress(job, selected.length, onProgress);
    await yieldToInterface();
  }

  await updateStoredScanAfterMigration(selected, successKeys, 'Already Updated', 'Old 7-digit number was replaced with the new 9-digit number during the latest migration.');

  await appendHistory({
    operationType: 'replace_update',
    numberReplaced: replaced,
    numberCopied: Number(job.copied || 0),
    numberSkipped: skipped,
    numberFailed: failed,
    backupId: backup.id,
    status: failed ? 'partial' : 'success',
    failureDetails
  });
  await setJson(keys.migrationJob, null);
  return { replaced, copied: Number(job.copied || 0), skipped, failed, backupId: backup.id, failureDetails };
}

export async function removeOldDuplicates(selected: CleanupCandidate[], onProgress?: (progress: MigrationProgress) => void) {
  if (!selected.length) throw new Error('Select at least one verified duplicate before continuing.');
  await assertNoConflictingOperation('cleanup');
  const permitted = await ensureContactPermission();
  if (!permitted) throw new Error('Contacts permission is required to clean up numbers. Contacts stay on your device and are not uploaded.');
  const rules = await currentApprovedRules();
  for (const item of selected) if (item.status !== 'Safe' || !verifyMigratedPair(item.oldNumber, item.newNumber, rules).matched) throw new Error(`Cleanup verification failed for ${item.contactName || item.oldNumber}. Scan again.`);
  const backup = await createOldMigrationBackup('duplicate_cleanup', selected);
  let removed = 0;
  let skipped = 0;
  let failed = 0;
  const removedKeys = new Set<string>();

  let processed = 0;
  for (const group of groupByContact(selected)) {
    const skippedBefore = skipped;
    try {
      const { contact, phoneNumbers } = await readContactPhones(group[0].contactId);
      let next = [...phoneNumbers];
      const planned: CleanupCandidate[] = [];
      for (const item of group) {
        const hasNew = next.some((p) => sameNormalizedPhone(phoneText(p), item.newNumber));
        const hasOld = next.some((p) => sameNormalizedPhone(phoneText(p), item.oldNumber));
        if (!hasNew || !hasOld) skipped++;
        else {
          next = next.filter((p) => !sameNormalizedPhone(phoneText(p), item.oldNumber));
          planned.push(item);
        }
      }
      if (planned.length) {
        await writeContactPhones(contact.id, next);
        const verified = await readContactPhones(contact.id);
        if (planned.some((item) => !verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.newNumber)) || verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.oldNumber)))) throw new Error('Duplicate cleanup could not be verified.');
        removed += planned.length;
        planned.forEach((item) => removedKeys.add(`${item.contactId}:${item.oldNumber}:${item.newNumber}`));
      }
    } catch {
      skipped = skippedBefore;
      failed += group.length;
    }
    processed += group.length;
    onProgress?.({ processed, total: selected.length, percent: Math.round((processed / selected.length) * 100), succeeded: removed, skipped, failed });
    await yieldToInterface();
  }

  await appendHistory({
    operationType: 'duplicate_cleanup',
    numberRemoved: removed,
    numberSkipped: skipped,
    numberFailed: failed,
    backupId: backup.id,
    status: failed ? 'partial' : 'success'
  });
  const savedScan = await getJson<any>(keys.scan, null).catch(() => null);
  if (savedScan) {
    await setJson(keys.scan, {
      ...savedScan,
      cleanup: (savedScan.cleanup || []).filter((item: CleanupCandidate) => !removedKeys.has(`${item.contactId}:${item.oldNumber}:${item.newNumber}`)),
      lastUpdatedAt: new Date().toISOString(),
    });
  }
  return { removed, skipped, failed, backupId: backup.id };
}

// Reverses only the single number GNM changed for a migration/cleanup backup
// item, keyed off the recorded old/new numbers. Deliberately never replaces
// the contact's whole phone array: that would silently drop any number the
// user added to this contact after the backup was taken. Returns null when
// there is nothing safe to do (duplicate prevention - the target state
// already holds, so restoring again would be a no-op or would create a dupe).
function targetedRestorePhones(currentPhones: ExpoPhone[], item: any, backup: any): ExpoPhone[] | null {
  const oldNumber = item.normalizedOldNumber || item.oldNumber || item.originalNumber;
  const newNumber = item.migratedNumber || item.newNumber;
  const snapshotEntry = (item.beforePhoneNumbers || []).find((p: any) => oldNumber && sameNormalizedPhone(String(p.number || ''), oldNumber));
  const oldLabel = snapshotEntry?.label || item.phoneLabel || 'mobile';

  if (backup.operationType === 'duplicate_cleanup') {
    if (!oldNumber) return null;
    if (currentPhones.some((p) => sameNormalizedPhone(phoneText(p), oldNumber))) return null;
    return [...currentPhones, { label: oldLabel, number: oldNumber }];
  }

  if (backup.operationType === 'duplicate_add') {
    if (!newNumber) return null;
    const next = currentPhones.filter((p) => !sameNormalizedPhone(phoneText(p), newNumber));
    return next.length === currentPhones.length ? null : next;
  }

  if (backup.operationType === 'replace_update') {
    if (!oldNumber) return null;
    let changed = false;
    const next = currentPhones.map((p) => {
      if (!changed && newNumber && sameNormalizedPhone(phoneText(p), newNumber)) { changed = true; return { ...p, number: oldNumber }; }
      return p;
    });
    if (changed) return next;
    if (currentPhones.some((p) => sameNormalizedPhone(phoneText(p), oldNumber))) return null;
    return [...currentPhones, { label: oldLabel, number: oldNumber }];
  }

  return null;
}

export async function restoreBackup(backupId: string, onProgress?: (progress: MigrationProgress) => void) {
  await assertNoConflictingOperation('restore');
  const permitted = await ensureContactPermission();
  if (!permitted) throw new Error('Contacts permission is required to restore a backup. Contacts stay on your device and are not uploaded.');

  const backups = await getBackupRecords();
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) throw new Error('Backup not found on this device.');

  const backupItems = await loadBackupItems(backup);
  if (!backupItems.length) throw new Error('This backup contains no contact records and cannot be restored.');
  const writableCopies = await getJson<WritableContactCopy[]>(keys.writableContactCopies, []);

  let restored = 0;
  let skipped = 0;
  let failed = 0;
  const failureDetails: Array<{ contactName: string; reason: string }> = [];
  const total = backupItems.length;
  const isFullSnapshot = backup.backupScope === 'full_contacts' || backup.operationType === 'manual_full_backup';

  for (let i = 0; i < backupItems.length; i++) {
    const item = backupItems[i];
    const contactLabel = item.contactName || 'Unnamed contact';
    try {
      const writableCopy = writableCopies.find((entry) => entry.sourceContactId === item.contactId && entry.backupIds?.includes(backupId));
      const savedSnapshot: ExpoPhone[] = Array.isArray(item.beforePhoneNumbers) && item.beforePhoneNumbers.length
        ? item.beforePhoneNumbers
        : (Array.isArray(item.phoneNumbers) ? item.phoneNumbers : []);

      if (writableCopy) {
        const copy = await Contacts.getContactByIdAsync(writableCopy.writableContactId, [Contacts.Fields.PhoneNumbers]);
        if (!copy) { failed++; failureDetails.push({ contactName: contactLabel, reason: 'The writable safety copy for this contact no longer exists on this device.' }); continue; }
        if (!savedSnapshot.length) { skipped++; continue; }
        await updateAndVerifyPhones(copy, savedSnapshot);
        restored++;
        continue;
      }

      const contact = await Contacts.getContactByIdAsync(item.contactId, [Contacts.Fields.PhoneNumbers]);
      if (!contact) { failed++; failureDetails.push({ contactName: contactLabel, reason: 'Contact no longer exists on this device.' }); continue; }
      const currentPhones: ExpoPhone[] = [...((contact.phoneNumbers || []) as ExpoPhone[])];

      if (isFullSnapshot) {
        if (!savedSnapshot.length) { skipped++; continue; }
        await updateAndVerifyPhones(contact, savedSnapshot);
        restored++;
        continue;
      }

      const target = targetedRestorePhones(currentPhones, item, backup);
      if (target) {
        await updateAndVerifyPhones(contact, target);
        restored++;
      } else if (savedSnapshot.length && !currentPhones.length) {
        // Contact currently has no numbers at all - fall back to the full
        // snapshot rather than leaving it with nothing to restore into.
        await updateAndVerifyPhones(contact, savedSnapshot);
        restored++;
      } else {
        skipped++;
      }
    } catch (error: any) {
      failed++;
      failureDetails.push({ contactName: contactLabel, reason: error?.message || 'The contacts provider rejected the restore.' });
    }

    if (i < 3 || (i + 1) % 25 === 0 || i === backupItems.length - 1) {
      onProgress?.({ processed: i + 1, total, percent: total ? Math.round(((i + 1) / total) * 100) : 100, succeeded: restored, skipped, failed });
      await yieldToInterface();
    }
  }

  await appendHistory({
    operationType: 'restore',
    numberRestored: restored,
    numberSkipped: skipped,
    numberFailed: failed,
    backupId,
    status: failed ? 'partial' : 'success',
    failureDetails
  });
  await setJson(keys.scan, null);
  return { restored, skipped, failed, failureDetails };
}
