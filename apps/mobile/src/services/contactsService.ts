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
    rulesVersion: payload.versionNumber
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

export async function createFullContactsBackup(onProgress?: (progress: ScanProgress) => void) {
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
  const sameSelection = existing?.operation === operation && selectedKeys.every((key) => existing.selectedKeys?.includes(key));
  if (existing?.status === 'running' && !sameSelection) throw new Error('Another migration is unfinished. Re-select the same contacts to resume it, or restore its backup before starting a different migration.');
  if (sameSelection) return existing;
  const job = { id: `JOB-${Date.now()}`, operation, status: 'running', selectedKeys, completedKeys: [], succeeded: 0, skipped: 0, failed: 0, createdAt: new Date().toISOString() };
  await setJson(keys.migrationJob, job);
  return job;
}

async function checkpointJob(job: any, force = false) {
  // Persist checkpoints often enough to resume safely without serializing a
  // growing job object after every contact. Large phonebooks otherwise spend
  // more time copying JSON than updating the Contacts provider.
  if (force || job.completedKeys.length % 100 === 0) await setJson(keys.migrationJob, { ...job, updatedAt: new Date().toISOString() });
}

function markJobComplete(job: any, completed: Set<string>, itemKey: string, succeeded: number, skipped: number, failed: number) {
  completed.add(itemKey);
  if (!Array.isArray(job.completedKeys)) job.completedKeys = [];
  job.completedKeys.push(itemKey);
  job.succeeded = succeeded;
  job.skipped = skipped;
  job.failed = failed;
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
  await validateMigrationSelection(selected);
  const job = await loadMigrationJob('duplicate_add', selected);
  const backup = job.backupId ? { id: job.backupId } : await createOldMigrationBackup('duplicate_add', selected);
  job.backupId = backup.id;
  await checkpointJob(job, true);
  let added = Number(job.succeeded || 0);
  let skipped = Number(job.skipped || 0);
  let failed = Number(job.failed || 0);
  const successKeys = new Set<string>();
  const completed = new Set<string>(job.completedKeys || []);

  for (const item of selected) {
    if (shouldPause?.()) { await checkpointJob(job, true); throw new Error('Migration paused safely. Re-select the same contacts to resume from this checkpoint.'); }
    const itemKey = migrationKey(item);
    if (completed.has(itemKey)) continue;
    if (!item.migratedNumber || item.status === 'Manual Review' || item.status === 'Unsafe') {
      skipped++;
    } else {
      try {
        const { contact, phoneNumbers } = await readContactPhones(item.contactId);
        const oldStillExists = phoneNumbers.some((p, index) => isSelectedOldPhone(p, item, index));
        const newAlreadyExists = phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!));

        if (!oldStillExists || newAlreadyExists) skipped++;
        else {
          const migratedDisplay = formatMigratedLikeOriginal(item.originalNumber, item.migratedNumber);
          phoneNumbers.push({ label: item.phoneLabel || 'mobile', number: migratedDisplay });
          await Contacts.updateContactAsync({ ...contact, phoneNumbers } as any);
          if (shouldVerifyWrite(job.completedKeys.length)) {
            const verified = await readContactPhones(item.contactId);
            if (!verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!)) || !verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.originalNumber))) throw new Error('Contact update could not be verified.');
          }
          added++;
          successKeys.add(itemKey);
        }
      } catch { failed++; }
    }
    markJobComplete(job, completed, itemKey, added, skipped, failed);
    await checkpointJob(job); emitMigrationProgress(job, selected.length, onProgress);
    if (job.completedKeys.length % 50 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  await updateStoredScanAfterMigration(selected, successKeys, 'Duplicate Pair Found', 'New 9-digit number was added during the latest migration.');

  await appendHistory({
    operationType: 'duplicate_add',
    numberAdded: added,
    numberSkipped: skipped,
    numberFailed: failed,
    backupId: backup.id,
    status: failed ? 'partial' : 'success'
  });
  await setJson(keys.migrationJob, null);
  return { added, skipped, failed, backupId: backup.id };
}

export async function applyReplace(selected: MigrationCandidate[], onProgress?: (progress: MigrationProgress) => void, shouldPause?: () => boolean) {
  await validateMigrationSelection(selected);
  const transition = await getJson<any>(keys.transition, null);
  if (!transition?.allowReplaceMode) throw new Error('Replace mode is disabled by the administrator. Use Add & Keep Old instead.');
  const job = await loadMigrationJob('replace_update', selected);
  const backup = job.backupId ? { id: job.backupId } : await createOldMigrationBackup('replace_update', selected);
  job.backupId = backup.id; await checkpointJob(job, true);
  let replaced = Number(job.succeeded || 0);
  let skipped = Number(job.skipped || 0);
  let failed = Number(job.failed || 0);
  const successKeys = new Set<string>();
  const completed = new Set<string>(job.completedKeys || []);

  for (const item of selected) {
    if (shouldPause?.()) { await checkpointJob(job, true); throw new Error('Migration paused safely. Re-select the same contacts to resume from this checkpoint.'); }
    const itemKey = migrationKey(item);
    if (completed.has(itemKey)) continue;
    if (!item.migratedNumber || item.status === 'Manual Review' || item.status === 'Unsafe') {
      skipped++;
      markJobComplete(job, completed, itemKey, replaced, skipped, failed);
      await checkpointJob(job); emitMigrationProgress(job, selected.length, onProgress);
      continue;
    }
    try {
      const { contact, phoneNumbers } = await readContactPhones(item.contactId);
      const newAlreadyExists = phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!));
      const oldCountBefore = phoneNumbers.filter((p) => sameNormalizedPhone(phoneText(p), item.originalNumber)).length;
      const oldIndex = phoneNumbers.findIndex((p, index) => isSelectedOldPhone(p, item, index));

      if (oldIndex < 0) {
        skipped++;
        markJobComplete(job, completed, itemKey, replaced, skipped, failed);
        await checkpointJob(job); emitMigrationProgress(job, selected.length, onProgress);
        continue;
      }

      const next = newAlreadyExists
        ? phoneNumbers.filter((_p, index) => index !== oldIndex)
        : phoneNumbers.map((p, index) => (index === oldIndex ? { ...p, number: formatMigratedLikeOriginal(phoneText(p), item.migratedNumber!) } : p));

      await Contacts.updateContactAsync({ ...contact, phoneNumbers: next } as any);
      if (shouldVerifyWrite(job.completedKeys.length)) {
        const verified = await readContactPhones(item.contactId);
        const oldCountAfter = verified.phoneNumbers.filter((p) => sameNormalizedPhone(phoneText(p), item.originalNumber)).length;
        if (!verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.migratedNumber!)) || oldCountAfter >= oldCountBefore) throw new Error('Contact replacement could not be verified.');
      }
      replaced++;
      successKeys.add(itemKey);
    } catch {
      failed++;
    }
    markJobComplete(job, completed, itemKey, replaced, skipped, failed);
    await checkpointJob(job); emitMigrationProgress(job, selected.length, onProgress);
    if (job.completedKeys.length % 50 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  await updateStoredScanAfterMigration(selected, successKeys, 'Already Updated', 'Old 7-digit number was replaced with the new 9-digit number during the latest migration.');

  await appendHistory({
    operationType: 'replace_update',
    numberReplaced: replaced,
    numberSkipped: skipped,
    numberFailed: failed,
    backupId: backup.id,
    status: failed ? 'partial' : 'success'
  });
  await setJson(keys.migrationJob, null);
  return { replaced, skipped, failed, backupId: backup.id };
}

export async function removeOldDuplicates(selected: CleanupCandidate[]) {
  if (!selected.length) throw new Error('Select at least one verified duplicate before continuing.');
  const rules = await currentApprovedRules();
  for (const item of selected) if (item.status !== 'Safe' || !verifyMigratedPair(item.oldNumber, item.newNumber, rules).matched) throw new Error(`Cleanup verification failed for ${item.contactName || item.oldNumber}. Scan again.`);
  const backup = await createOldMigrationBackup('duplicate_cleanup', selected);
  let removed = 0;
  let skipped = 0;
  let failed = 0;

  for (const item of selected) {
    if (item.status !== 'Safe') {
      skipped++;
      continue;
    }
    try {
      const verification = verifyMigratedPair(item.oldNumber, item.newNumber, rules);
      if (!verification.matched) {
        skipped++;
        continue;
      }

      const { contact, phoneNumbers } = await readContactPhones(item.contactId);
      const hasNew = phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.newNumber));
      const oldIndexes = phoneNumbers
        .map((p, index) => ({ index, matches: sameNormalizedPhone(phoneText(p), item.oldNumber) }))
        .filter((p) => p.matches)
        .map((p) => p.index);

      if (!hasNew || oldIndexes.length === 0) {
        skipped++;
        continue;
      }

      const next = phoneNumbers.filter((_p, index) => !oldIndexes.includes(index));
      await Contacts.updateContactAsync({ ...contact, phoneNumbers: next } as any);
      const verified = await readContactPhones(item.contactId);
      if (!verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.newNumber)) || verified.phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), item.oldNumber))) throw new Error('Duplicate cleanup could not be verified.');
      removed++;
    } catch {
      failed++;
    }
  }

  await appendHistory({
    operationType: 'duplicate_cleanup',
    numberRemoved: removed,
    numberSkipped: skipped,
    numberFailed: failed,
    backupId: backup.id,
    status: failed ? 'partial' : 'success'
  });
  await setJson(keys.scan, null);
  return { removed, skipped, failed, backupId: backup.id };
}

export async function restoreBackup(backupId: string) {
  const backups = await getBackupRecords();
  const backup = backups.find((b) => b.id === backupId);
  if (!backup) throw new Error('Backup not found on this device.');

  let restored = 0;
  let skipped = 0;
  let failed = 0;

  const backupItems = await loadBackupItems(backup);
  if (!backupItems.length) throw new Error('This backup contains no contact records and cannot be restored.');

  for (const item of backupItems) {
    try {
      const contact = await Contacts.getContactByIdAsync(item.contactId, [Contacts.Fields.PhoneNumbers]);
      if (!contact) {
        failed++;
        continue;
      }

      const phoneNumbers: ExpoPhone[] = [...((contact.phoneNumbers || []) as ExpoPhone[])];
      const savedSnapshot = Array.isArray(item.beforePhoneNumbers) ? item.beforePhoneNumbers : [];
      if (savedSnapshot.length) {
        await Contacts.updateContactAsync({ ...contact, phoneNumbers: savedSnapshot } as any);
        restored++;
        continue;
      }

      const oldNumber = item.normalizedOldNumber || item.oldNumber || item.originalNumber;
      const newNumber = item.migratedNumber || item.newNumber;

      if (backup.operationType === 'duplicate_cleanup') {
        const hasOld = phoneNumbers.some((p) => sameNormalizedPhone(phoneText(p), oldNumber));
        if (!hasOld && oldNumber) {
          phoneNumbers.push({ label: item.phoneLabel || 'mobile', number: oldNumber });
          await Contacts.updateContactAsync({ ...contact, phoneNumbers } as any);
          restored++;
        } else skipped++;
      } else if (backup.operationType === 'duplicate_add') {
        const next = phoneNumbers.filter((p) => !sameNormalizedPhone(phoneText(p), newNumber));
        if (next.length !== phoneNumbers.length) {
          await Contacts.updateContactAsync({ ...contact, phoneNumbers: next } as any);
          restored++;
        } else skipped++;
      } else if (backup.operationType === 'replace_update') {
        let changed = false;
        const next = phoneNumbers.map((p) => {
          if (newNumber && sameNormalizedPhone(phoneText(p), newNumber)) {
            changed = true;
            return { ...p, number: oldNumber };
          }
          return p;
        });
        if (!changed && oldNumber) {
          next.push({ label: item.phoneLabel || 'mobile', number: oldNumber });
          changed = true;
        }
        if (changed) {
          await Contacts.updateContactAsync({ ...contact, phoneNumbers: next } as any);
          restored++;
        } else skipped++;
      } else if (backup.operationType === 'manual_full_backup') {
        const savedPhones = Array.isArray(item.phoneNumbers) ? item.phoneNumbers : [];
        if (!savedPhones.length) {
          skipped++;
        } else {
          await Contacts.updateContactAsync({ ...contact, phoneNumbers: savedPhones } as any);
          restored++;
        }
      } else skipped++;
    } catch {
      failed++;
    }
  }

  await appendHistory({
    operationType: 'restore',
    numberRestored: restored,
    numberSkipped: skipped,
    numberFailed: failed,
    backupId,
    status: failed ? 'partial' : 'success'
  });
  await setJson(keys.scan, null);
  return { restored, skipped, failed };
}
