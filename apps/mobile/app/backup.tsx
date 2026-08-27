import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, EmptyState, ListScreen, NoticeCard, Pill, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { createFullContactsBackup, restoreBackup } from '../src/services/contactsService';
import { deleteBackupRecord, getBackupRecords } from '../src/services/storage';
import { useAppTheme } from '../src/appTheme';
import { getAccessStatus, requirePaidFeature } from '../src/services/unlockService';
import { notifyLocalCompletion } from '../src/services/notificationService';
import { failOperation, finishOperation, getOperationJob, startOperation, updateOperation } from '../src/services/operationService';

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
  const [restoreProgress, setRestoreProgress] = useState<BackupProgress>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [savedJob, setSavedJob] = useState<any>(null);
  const load = () => getBackupRecords().then(setItems);
  useEffect(() => { Promise.all([getAccessStatus(), getOperationJob()]).then(([status, job]) => { setPaid(status.paid); if (job?.kind === 'backup') setSavedJob(job); if (status.paid) return load(); }).finally(() => setAccessLoading(false)); }, []);

  function confirmRestore(id: string, itemCount: number) {
    if (creating || restoringId) return;
    showDialog({
      title: 'Restore backup',
      message: `This restores contact numbers from this local backup (${itemCount.toLocaleString()} contact${itemCount === 1 ? '' : 's'}). Numbers added to a contact after this backup was taken are kept, not deleted.`,
      tone: 'blue',
      icon: 'backup',
      actions: [
        { text: 'Cancel', variant: 'secondary' },
        { text: 'Restore', tone: 'blue', onPress: async () => {
          try {
            await requirePaidFeature();
            setRestoringId(id);
            setRestoreProgress({ processed: 0, total: itemCount, percent: 0 });
            await startOperation('restore', 'Restoring backup', itemCount, '/backup');
            const r = await restoreBackup(id, (p) => { setRestoreProgress(p); void updateOperation(p); });
            await finishOperation(`Restored ${r.restored}, skipped ${r.skipped}, failed ${r.failed}.`);
            await load();
            router.push({ pathname: '/restore-complete', params: { restored: String(r.restored), skipped: String(r.skipped), failed: String(r.failed), backupId: id } });
          } catch (e: any) {
            await failOperation(e?.message || 'Restore failed.');
            showDialog({ title: 'Restore failed', message: e?.message || 'Could not restore backup.', tone: 'danger', icon: 'warning' });
          } finally {
            setRestoringId('');
            setRestoreProgress(null);
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
      await requirePaidFeature();
      setCreating(true);
      setProgress({ processed: 0, total: 0, percent: 0 });
      await startOperation('backup', 'Creating full contacts backup', 0, '/backup');
      const result = await createFullContactsBackup((p) => { setProgress(p); void updateOperation(p); });
      await finishOperation(`${result.itemCount} contacts saved locally.`);
      await load();
      await notifyLocalCompletion('Backup complete', `${Number(result.itemCount || 0).toLocaleString()} contacts saved privately on this device.`, { screen: 'backup' });
      router.replace({ pathname: '/backup-complete', params: { total: String(result.itemCount || 0), backupId: result.backupId } });
    } catch (e: any) {
      await failOperation(e?.message || 'Backup failed.');
      showDialog({ title: 'Backup failed', message: e?.message || 'Could not create a local backup. Check contacts permission and try again.', tone: 'danger', icon: 'warning' });
    } finally {
      setCreating(false);
      setProgress(null);
    }
  }

  const percent = Math.max(0, Math.min(100, progress?.percent || 0));
  const topHeader = <BackHeader title="Backups" subtitle="Create and restore local contact backups." right={creating ? <Pill text="Saving" tone="blue" /> : undefined} compact />;
  if (accessLoading) return <ListScreen data={[]} keyExtractor={() => 'loading'} topHeader={topHeader} empty={<Card><ActivityIndicator color={colors.primary} /><Text style={[styles.body, { textAlign: 'center', marginTop: 12 }]}>Checking access…</Text></Card>} renderItem={() => null} />;
  if (!paid) return <><ListScreen data={[]} keyExtractor={() => 'locked'} topHeader={topHeader} empty={<Card elevated style={{ alignItems: 'center', gap: 14, padding: 22 }}><View style={{ width: 74, height: 74, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="lock" color={colors.primary} size={30} /></View><Text style={{ color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>Backup is a premium feature</Text><Text style={[styles.body, { textAlign: 'center' }]}>Full Unlock is required to create, view, restore, or delete backups. A safety snapshot is still created automatically before each allowed free migration.</Text><Button title="Unlock Backup" icon="premium" onPress={() => router.push('/payment')} style={{ width: '100%', minHeight: 56 }} /><Button title="Back to Dashboard" variant="secondary" icon="home" onPress={() => router.back()} style={{ width: '100%' }} /></Card>} renderItem={() => null} /><Dialog /></>;
  const header = (
    <>
      <NoticeCard title="Protect your contacts" text="A local backup is created before every migration or cleanup. Nothing is uploaded to the backend. This device keeps your most recent 30 backups; older ones are removed automatically to save space." tone="blue" icon="backup" />
      {savedJob?.status === 'running' ? <Card style={{ marginTop: 12 }}><Text style={{ color: colors.text, fontWeight: '900' }}>Backup still running · {savedJob.percent}%</Text><Text style={styles.small}>{savedJob.total ? `${savedJob.processed} of ${savedJob.total} contacts saved.` : 'Preparing contacts…'} You may leave this page and return.</Text></Card> : null}
      {restoringId && restoreProgress ? (
        <Card style={{ marginTop: 12, gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>Restoring backup · {Math.max(0, Math.min(100, restoreProgress.percent || 0))}%</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, restoreProgress.percent || 0))}%` }]} /></View>
          <Text style={styles.small}>{restoreProgress.total ? `${restoreProgress.processed.toLocaleString()} of ${restoreProgress.total.toLocaleString()} contacts checked.` : 'Preparing restore…'} Keep the app open until it completes.</Text>
        </Card>
      ) : null}

      <Card elevated style={{ marginTop: 14, marginBottom: 18, gap: 14, borderColor: creating ? colors.primary : colors.line }}>
        <View style={[styles.row, { gap: 14 }]}> 
          <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            {creating ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="backup" color={colors.primary} size={24} />}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '900' }}>{creating ? 'Creating full backup...' : 'Create full backup'}</Text>
            <Text style={[styles.body, { marginTop: 3 }]}>{creating ? 'Backup continues while you use another page inside GNM. Keep the app open until it completes.' : 'Save your current contact numbers before testing migration or cleanup.'}</Text>
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
            <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 19, fontWeight: '800' }}>{backupTitle(latest)}</Text><Text style={styles.body}>{new Date(latest.date).toLocaleString()}</Text><Text style={styles.small}>{backupNote(latest)}</Text><Text style={styles.small}>{latest.itemCount || 0} contacts/items</Text></View>
          </View>
          <View style={styles.divider} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title={restoringId === latest.id ? 'Restoring...' : 'Restore'} icon="update" loading={restoringId === latest.id} disabled={creating || (!!restoringId && restoringId !== latest.id)} onPress={() => confirmRestore(latest.id, Number(latest.itemCount || 0))} style={{ flex: 1 }} />
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
      renderItem={({ item }) => <Card style={{ marginBottom: 10 }}><View style={styles.rowBetween}><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{backupTitle(item)}</Text><Text style={styles.body}>{new Date(item.date).toLocaleString()}</Text><Text style={styles.small}>{backupNote(item)}</Text><Text style={styles.small}>{item.itemCount || 0} contacts/items</Text></View><Pill text={String(item.backupScope || item.operationType || 'backup').replace(/_/g, ' ')} tone={backupTone(item) as any} /></View><View style={styles.divider} /><View style={{ flexDirection: 'row', gap: 10 }}><Button title={restoringId === item.id ? 'Restoring...' : 'Restore'} icon="update" variant="secondary" loading={restoringId === item.id} disabled={creating || (!!restoringId && restoringId !== item.id)} onPress={() => confirmRestore(item.id, Number(item.itemCount || 0))} style={{ flex: 1 }} /><Button title="Delete" variant="secondary" tone="danger" icon="cleanup" disabled={creating || !!restoringId} onPress={() => confirmDelete(item.id)} /></View></Card>}
    />
    <Dialog />
  </>;
}
