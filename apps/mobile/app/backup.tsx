import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, EmptyState, ListScreen, NoticeCard, Pill, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { createFullContactsBackup, restoreBackup } from '../src/services/contactsService';
import { deleteBackupRecord, getBackupRecords } from '../src/services/storage';
import { useAppTheme } from '../src/appTheme';

type BackupProgress = { processed: number; total: number; percent: number } | null;

function backupTitle(item: any) {
  if (item?.backupTitle) return item.backupTitle;
  const type = String(item?.operationType || 'backup');
  if (type === 'manual_full_backup') return 'Full contacts backup';
  if (type === 'duplicate_add') return 'Old migration backup - add';
  if (type === 'replace_update') return 'Old migration backup - replace';
  if (type === 'duplicate_cleanup') return 'Old migration backup - cleanup';
  return type.replace(/_/g, ' ');
}

function backupNote(item: any) {
  const scope = String(item?.backupScope || '');
  if (scope === 'old_migration') return 'Saved old numbers before migration so you can restore them later.';
  if (scope === 'full_contacts') return 'Full local contact snapshot saved on this phone.';
  return 'Local backup saved on this device.';
}

function backupTone(item: any) {
  return item?.backupScope === 'old_migration' ? 'warning' : 'blue';
}

export default function Backup() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const [items, setItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<BackupProgress>(null);
  const [restoringId, setRestoringId] = useState('');
  const load = () => getBackupRecords().then(setItems);
  useEffect(() => { load(); }, []);

  function confirmRestore(id: string) {
    if (creating || restoringId) return;
    showDialog({
      title: 'Restore backup',
      message: 'This will restore contact numbers from the selected local backup. Current contact details will be preserved where possible.',
      tone: 'blue',
      icon: 'backup',
      actions: [
        { text: 'Cancel', variant: 'secondary' },
        { text: 'Restore', tone: 'blue', onPress: async () => {
          try {
            setRestoringId(id);
            const r = await restoreBackup(id);
            showDialog({ title: 'Restore complete', message: `Restored ${r.restored}, skipped ${r.skipped}, failed ${r.failed}`, tone: 'success', icon: 'success' });
            await load();
          } catch (e: any) {
            showDialog({ title: 'Restore failed', message: e?.message || 'Could not restore backup.', tone: 'danger', icon: 'warning' });
          } finally {
            setRestoringId('');
          }
        } }
      ]
    });
  }

  function confirmDelete(id: string) {
    if (creating || restoringId) return;
    showDialog({ title: 'Delete backup', message: 'This permanently removes the selected local backup from this phone.', tone: 'danger', icon: 'cleanup', actions: [
      { text: 'Cancel', variant: 'secondary' },
      { text: 'Delete', tone: 'danger', onPress: async () => { await deleteBackupRecord(id); await load(); } }
    ] });
  }

  const latest = items[0];
  const older = items.slice(1);

  async function createManualBackup() {
    if (creating) return;
    try {
      setCreating(true);
      setProgress({ processed: 0, total: 0, percent: 0 });
      const result = await createFullContactsBackup((p) => setProgress(p));
      await load();
      router.replace({ pathname: '/backup-complete', params: { total: String(result.itemCount || 0), backupId: result.backupId } });
    } catch (e: any) {
      showDialog({ title: 'Backup failed', message: e?.message || 'Could not create a local backup. Check contacts permission and try again.', tone: 'danger', icon: 'warning' });
    } finally {
      setCreating(false);
      setProgress(null);
    }
  }

  const percent = Math.max(0, Math.min(100, progress?.percent || 0));
  const topHeader = <BackHeader title="Backups" subtitle="Create and restore local contact backups." right={creating ? <Pill text="Saving" tone="blue" /> : undefined} compact />;
  const header = (
    <>
      <NoticeCard title="Protect your contacts" text="A local backup is created before every migration or cleanup. Nothing is uploaded to the backend." tone="blue" icon="backup" />

      <Card elevated style={{ marginTop: 14, marginBottom: 18, gap: 14, borderColor: creating ? colors.primary : colors.line }}>
        <View style={[styles.row, { gap: 14 }]}> 
          <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            {creating ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="backup" color={colors.primary} size={24} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '900' }}>{creating ? 'Creating full backup...' : 'Create full backup'}</Text>
            <Text style={[styles.body, { marginTop: 3 }]}>{creating ? 'Please keep this page open while contacts are being saved locally.' : 'Save your current contact numbers before testing migration or cleanup.'}</Text>
          </View>
        </View>

        {creating ? (
          <View style={{ gap: 8 }}>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${percent}%` }]} /></View>
            <Text style={styles.small}>{progress?.total ? `${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} contacts scanned · ${percent}%` : 'Preparing contacts backup...'}</Text>
          </View>
        ) : null}

        <Button
          title={creating ? 'Creating Backup...' : 'Create Full Backup'}
          icon="backup"
          loading={creating}
          disabled={creating || !!restoringId}
          onPress={createManualBackup}
          style={{ minHeight: 58, borderRadius: 20 }}
        />
      </Card>

      <Text style={styles.sectionTitle}>Latest Backup</Text>
      {latest ? (
        <Card elevated style={{ marginBottom: 18 }}>
          <View style={[styles.row, { gap: 14 }]}> 
            <View style={{ width: 54, height: 54, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}><AppIcon name="backup" color={colors.primary} size={22} /></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{backupTitle(latest)}</Text><Text style={styles.body}>{new Date(latest.date).toLocaleString()}</Text><Text style={styles.small}>{backupNote(latest)}</Text><Text style={styles.small}>{latest.items?.length || latest.itemCount || 0} contacts/items</Text></View>
          </View>
          <View style={styles.divider} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={restoringId === latest.id ? 'Restoring...' : 'Restore'} icon="update" loading={restoringId === latest.id} disabled={creating || (!!restoringId && restoringId !== latest.id)} onPress={() => confirmRestore(latest.id)} style={{ flex: 1 }} />
            <Button title="Delete" variant="secondary" tone="danger" icon="cleanup" disabled={creating || !!restoringId} onPress={() => confirmDelete(latest.id)} />
          </View>
        </Card>
      ) : <EmptyState icon="backup" title="No backups yet" text="Backups will appear here after you create a full backup or migrate contacts. Old migration backups are saved before add, replace, and cleanup actions." />}
      <Text style={styles.sectionTitle}>All Backups</Text>
    </>
  );

  return <>
    <ListScreen
      data={older}
      keyExtractor={(item) => item.id}
      topHeader={topHeader}
      header={header}
      empty={items.length > 1 ? undefined : <Card style={{ alignItems: 'center' }}><Text style={styles.body}>No older backups yet.</Text></Card>}
      renderItem={({ item }) => <Card style={{ marginBottom: 10 }}><View style={styles.rowBetween}><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{backupTitle(item)}</Text><Text style={styles.body}>{new Date(item.date).toLocaleString()}</Text><Text style={styles.small}>{backupNote(item)}</Text><Text style={styles.small}>{item.items?.length || item.itemCount || 0} contacts/items</Text></View><Pill text={String(item.backupScope || item.operationType || 'backup').replace(/_/g, ' ')} tone={backupTone(item) as any} /></View><View style={styles.divider} /><View style={{ flexDirection: 'row', gap: 10 }}><Button title={restoringId === item.id ? 'Restoring...' : 'Restore'} icon="update" variant="secondary" loading={restoringId === item.id} disabled={creating || (!!restoringId && restoringId !== item.id)} onPress={() => confirmRestore(item.id)} style={{ flex: 1 }} /><Button title="Delete" variant="secondary" tone="danger" icon="cleanup" disabled={creating || !!restoringId} onPress={() => confirmDelete(item.id)} /></View></Card>}
    />
    <Dialog />
  </>;
}
