import AsyncStorage from '@react-native-async-storage/async-storage';

export const keys = {
  onboarded: 'gnm_onboarded', notificationPermissionPrompted: 'gnm_notification_permission_prompted', rules: 'gnm_rules', transition: 'gnm_transition', config: 'gnm_config', scan: 'gnm_scan', history: 'gnm_history', backups: 'gnm_backups', unlocks: 'gnm_unlocks', accessStatus: 'gnm_access_status', preferences: 'gnm_preferences', notifications: 'gnm_notifications', notificationStatus: 'gnm_notification_status', migrationJob: 'gnm_migration_job', writableContactCopies: 'gnm_writable_contact_copies'
};
export async function getJson<T>(key: string, fallback: T): Promise<T> { const raw = await AsyncStorage.getItem(key); if (!raw) return fallback; try { return JSON.parse(raw) as T; } catch { return fallback; } }
export async function setJson(key: string, value: unknown) { await AsyncStorage.setItem(key, JSON.stringify(value)); }
export async function clearLocalData() { const all = await AsyncStorage.getAllKeys(); await AsyncStorage.multiRemove([...Object.values(keys), ...all.filter((key) => key.startsWith('gnm_backup_BKP-'))]); }
export async function appendHistory(item: any) { const list = await getJson<any[]>(keys.history, []); list.unshift({ id: `${Date.now()}`, date: new Date().toISOString(), ...item }); await setJson(keys.history, list.slice(0, 200)); }

const BACKUP_CHUNK_SIZE = 100;
const backupChunkKey = (backupId: string, index: number) => `gnm_backup_${backupId}_${index}`;

export async function getBackupRecords() {
  const index = await getJson<any[]>(keys.backups, []);
  let changed = false;
  const migrated: any[] = [];
  for (const backup of index) {
    if (!Array.isArray(backup.items)) { migrated.push(backup); continue; }
    const chunks = Math.max(1, Math.ceil(backup.items.length / BACKUP_CHUNK_SIZE));
    for (let i = 0; i < chunks; i++) await setJson(backupChunkKey(backup.id, i), backup.items.slice(i * BACKUP_CHUNK_SIZE, (i + 1) * BACKUP_CHUNK_SIZE));
    migrated.push({ ...backup, items: undefined, itemCount: backup.itemCount ?? backup.items.length, storageVersion: 2, chunkCount: chunks });
    changed = true;
  }
  if (changed) await setJson(keys.backups, migrated);
  return migrated;
}

export async function saveBackupRecord(backup: any) {
  const chunks = Math.max(1, Math.ceil((backup.items?.length || 0) / BACKUP_CHUNK_SIZE));
  const writtenKeys: string[] = [];
  try {
    for (let index = 0; index < chunks; index++) {
      const key = backupChunkKey(backup.id, index);
      await setJson(key, (backup.items || []).slice(index * BACKUP_CHUNK_SIZE, (index + 1) * BACKUP_CHUNK_SIZE));
      writtenKeys.push(key);
    }
    const metadata = { ...backup, items: undefined, storageVersion: 2, chunkCount: chunks };
    let verifiedCount = 0;
    for (let i = 0; i < chunks; i++) verifiedCount += (await getJson<any[]>(backupChunkKey(backup.id, i), [])).length;
    if (verifiedCount !== (backup.items?.length || 0)) throw new Error('Backup verification failed. No contacts were changed.');
    const index = await getBackupRecords();
    const nextIndex = [metadata, ...index.filter((item) => item.id !== backup.id)].slice(0, 30);
    await setJson(keys.backups, nextIndex);
    const evicted = index.filter((item) => !nextIndex.some((kept) => kept.id === item.id));
    const evictedKeys = evicted.flatMap((item) => Array.from({ length: Number(item.chunkCount || 0) }, (_, i) => backupChunkKey(item.id, i)));
    if (evictedKeys.length) await AsyncStorage.multiRemove(evictedKeys);
    return metadata;
  } catch (error) {
    if (writtenKeys.length) await AsyncStorage.multiRemove(writtenKeys).catch(() => undefined);
    throw error;
  }
}

export async function loadBackupItems(backup: any): Promise<any[]> {
  if (Array.isArray(backup.items)) return backup.items;
  const chunks = Number(backup.chunkCount || 0);
  const items: any[] = [];
  for (let index = 0; index < chunks; index++) items.push(...await getJson<any[]>(backupChunkKey(backup.id, index), []));
  if (Number(backup.itemCount || 0) > 0 && items.length !== Number(backup.itemCount)) throw new Error('This backup is incomplete or corrupted and was not restored.');
  return items;
}

export async function deleteBackupRecord(backupId: string) {
  const index = await getBackupRecords();
  const backup = index.find((item) => item.id === backupId);
  if (!backup) return;
  const chunkKeys = Array.from({ length: Number(backup.chunkCount || 0) }, (_, i) => backupChunkKey(backupId, i));
  if (chunkKeys.length) await AsyncStorage.multiRemove(chunkKeys);
  await setJson(keys.backups, index.filter((item) => item.id !== backupId));
}
