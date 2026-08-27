import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockPhoneNumber = { id?: string; label?: string; number?: string; digits?: string };
type MockDeviceContact = { id: string; name?: string; firstName?: string; lastName?: string; company?: string; phoneNumbers?: MockPhoneNumber[] };

const { db, contactsDb, contactsMock } = vi.hoisted(() => {
  const db = { json: new Map<string, any>(), backups: [] as any[] };
  const contactsDb = new Map<string, any>();
  const contactsMock = {
    getPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
    requestPermissionsAsync: vi.fn(async () => ({ status: 'granted' })),
    getContactByIdAsync: vi.fn(async (id: string) => contactsDb.get(id) || null),
    updateContactAsync: vi.fn(async (input: any) => {
      const existing = contactsDb.get(input.id);
      if (!existing) throw new Error('not found');
      contactsDb.set(input.id, { ...existing, phoneNumbers: input.phoneNumbers });
      return { id: input.id };
    }),
    addContactAsync: vi.fn(async (input: any) => {
      const id = `new-${contactsDb.size + 1}`;
      contactsDb.set(id, { id, ...input });
      return id;
    }),
    getContactsAsync: vi.fn(async (): Promise<{ data: MockDeviceContact[] }> => ({ data: [] })),
    Fields: { PhoneNumbers: 'phoneNumbers', FirstName: 'firstName', LastName: 'lastName', Company: 'company' },
  };
  return { db, contactsDb, contactsMock };
});

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-contacts', () => contactsMock);

vi.mock('./storage', () => ({
  keys: {
    migrationJob: 'gnm_migration_job', operationJob: 'gnm_operation_job', writableContactCopies: 'gnm_writable_contact_copies',
    scan: 'gnm_scan', history: 'gnm_history', transition: 'gnm_transition', rules: 'gnm_rules',
  },
  getJson: vi.fn(async (key: string, fallback: any) => (db.json.has(key) ? db.json.get(key) : fallback)),
  setJson: vi.fn(async (key: string, value: any) => { db.json.set(key, value); }),
  appendHistory: vi.fn(async (item: any) => { db.json.set('gnm_history', [item, ...(db.json.get('gnm_history') || [])]); }),
  getBackupRecords: vi.fn(async () => db.backups),
  saveBackupRecord: vi.fn(async (backup: any) => {
    if (!backup.items?.length) throw new Error('Refusing to save an empty backup. No contacts were changed.');
    const metadata = { ...backup, storageVersion: 2 };
    db.backups = [metadata, ...db.backups.filter((b: any) => b.id !== backup.id)];
    return metadata;
  }),
  loadBackupItems: vi.fn(async (backup: any) => backup.items || []),
}));

import { SCAN_SCHEMA_VERSION, createFullContactsBackup, restoreBackup, scanContacts } from './contactsService';

const testRules = {
  versionNumber: 1,
  publishedAt: '2026-01-01T00:00:00Z',
  operators: [{ id: 'op1', name: 'Comium', code: 'CM', newPrefix: '29', status: 'active' }],
  rules: [{ id: 'r1', operatorId: 'op1', operatorName: 'Comium', ruleName: 'Comium 9-prefix', ruleType: 'prefix', prefixValue: '9', newPrefix: '29', priority: 10, status: 'active' }],
} as any;

beforeEach(() => {
  db.json.clear();
  db.backups = [];
  contactsDb.clear();
  vi.clearAllMocks();
  contactsMock.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  contactsMock.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
});

function seedBackup(overrides: Partial<any> = {}) {
  const backup = {
    id: 'BKP-1',
    operationType: 'duplicate_add',
    backupScope: 'old_migration',
    date: new Date().toISOString(),
    itemCount: 1,
    items: [{
      contactId: 'contact-1',
      contactName: 'Amie Jallow',
      normalizedOldNumber: '9123456',
      oldNumber: '9123456',
      migratedNumber: '291234567',
      newNumber: '291234567',
      phoneLabel: 'mobile',
      beforePhoneNumbers: [{ label: 'mobile', number: '9123456' }],
    }],
    ...overrides,
  };
  db.backups = [backup];
  return backup;
}

describe('scanContacts - schema versioning', () => {
  it('stamps the saved scan with the current schema version', async () => {
    contactsMock.getContactsAsync.mockResolvedValueOnce({
      data: [{ id: 'c1', name: 'Test User', phoneNumbers: [{ number: '9123456' }] }],
    });

    const result = await scanContacts(testRules, 'duplicate');

    expect(result.schemaVersion).toBe(SCAN_SCHEMA_VERSION);
    expect(db.json.get('gnm_scan').schemaVersion).toBe(SCAN_SCHEMA_VERSION);
  });

  it('every generated cleanup candidate carries a phoneIndex, so duplicate old-number rows on one contact get distinct list keys', async () => {
    contactsMock.getContactsAsync.mockResolvedValueOnce({
      data: [{
        id: 'c1',
        name: 'Duplicate Rows',
        phoneNumbers: [{ number: '9123456' }, { number: '9123456' }, { number: '299123456' }],
      }],
    });

    const result = await scanContacts(testRules, 'duplicate');

    expect(result.cleanup.length).toBeGreaterThanOrEqual(2);
    const keys = result.cleanup.map((item: any) => `${item.contactId}:${item.phoneIndex}:${item.oldNumber}:${item.newNumber}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('restoreBackup - duplicate_add reversal', () => {
  it('removes only the number GNM added, leaving unrelated numbers untouched', async () => {
    seedBackup();
    contactsDb.set('contact-1', { id: 'contact-1', phoneNumbers: [{ id: 'p1', label: 'mobile', number: '9123456' }, { id: 'p2', label: 'mobile', number: '291234567' }, { id: 'p3', label: 'work', number: '2203009999' }] });

    const result = await restoreBackup('BKP-1');

    expect(result).toMatchObject({ restored: 1, skipped: 0, failed: 0 });
    const after = contactsDb.get('contact-1');
    const numbers = after.phoneNumbers.map((p: any) => p.number);
    expect(numbers).toContain('9123456');
    expect(numbers).toContain('2203009999');
    expect(numbers).not.toContain('291234567');
  });

  it('is idempotent: restoring twice does not fail or duplicate the old number', async () => {
    seedBackup();
    contactsDb.set('contact-1', { id: 'contact-1', phoneNumbers: [{ id: 'p1', label: 'mobile', number: '9123456' }, { id: 'p2', label: 'mobile', number: '291234567' }] });

    await restoreBackup('BKP-1');
    const second = await restoreBackup('BKP-1');

    expect(second.restored).toBe(0);
    expect(second.skipped).toBe(1);
    const after = contactsDb.get('contact-1');
    expect(after.phoneNumbers.filter((p: any) => p.number === '9123456')).toHaveLength(1);
  });

  it('does not delete a number the user added to the contact after the backup was taken', async () => {
    seedBackup();
    contactsDb.set('contact-1', {
      id: 'contact-1',
      phoneNumbers: [
        { id: 'p1', label: 'mobile', number: '9123456' },
        { id: 'p2', label: 'mobile', number: '291234567' },
        { id: 'p3', label: 'mobile', number: '2207005555' }, // added by the user after the backup
      ],
    });

    await restoreBackup('BKP-1');
    const after = contactsDb.get('contact-1');
    expect(after.phoneNumbers.map((p: any) => p.number)).toContain('2207005555');
  });
});

describe('restoreBackup - replace_update reversal', () => {
  it('swaps the new number back to the old number', async () => {
    seedBackup({ operationType: 'replace_update', items: [{
      contactId: 'contact-2', contactName: 'Lamin Sanneh', normalizedOldNumber: '9123456', oldNumber: '9123456',
      migratedNumber: '291234567', newNumber: '291234567', beforePhoneNumbers: [{ label: 'mobile', number: '9123456' }],
    }] });
    contactsDb.set('contact-2', { id: 'contact-2', phoneNumbers: [{ id: 'p1', label: 'mobile', number: '291234567' }] });

    const result = await restoreBackup('BKP-1');

    expect(result.restored).toBe(1);
    expect(contactsDb.get('contact-2').phoneNumbers.map((p: any) => p.number)).toEqual(['9123456']);
  });
});

describe('restoreBackup - failure handling', () => {
  it('records a failure reason and continues instead of throwing when a contact no longer exists', async () => {
    seedBackup();
    // contact-1 intentionally absent from contactsDb

    const result = await restoreBackup('BKP-1');

    expect(result).toMatchObject({ restored: 0, skipped: 0, failed: 1 });
    expect(result.failureDetails).toHaveLength(1);
    expect(result.failureDetails[0]).toMatchObject({ contactName: 'Amie Jallow', reason: expect.stringMatching(/no longer exists/i) });
  });

  it('throws when the backup id does not exist on this device', async () => {
    db.backups = [];
    await expect(restoreBackup('MISSING')).rejects.toThrow(/not found/i);
  });

  it('throws instead of restoring an empty backup', async () => {
    seedBackup({ itemCount: 0, items: [] });
    await expect(restoreBackup('BKP-1')).rejects.toThrow(/no contact records/i);
  });
});

describe('restoreBackup - permission and conflicting operations', () => {
  it('refuses to restore without contacts permission', async () => {
    contactsMock.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    contactsMock.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });
    seedBackup();
    await expect(restoreBackup('BKP-1')).rejects.toThrow(/permission is required/i);
  });

  it('refuses to restore while a migration is still running', async () => {
    seedBackup();
    db.json.set('gnm_migration_job', { status: 'running' });
    await expect(restoreBackup('BKP-1')).rejects.toThrow(/migration is still in progress/i);
  });

  it('refuses to start a full backup while a restore is still running', async () => {
    db.json.set('gnm_operation_job', { status: 'running', kind: 'restore', title: 'Restoring backup' });
    await expect(createFullContactsBackup()).rejects.toThrow(/still in progress/i);
  });
});
