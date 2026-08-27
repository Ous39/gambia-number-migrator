import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, EmptyState, FloatingActionBar, ListScreen, NoticeCard, OperatorBadge, Pill, SearchBox, useAppDialog } from '../src/components/UI';
import { SCAN_SCHEMA_VERSION, removeOldDuplicates } from '../src/services/contactsService';
import { getJson, keys } from '../src/services/storage';
import { useAppTheme } from '../src/appTheme';
import { hasApprovedMigrationRules } from '@gnm/shared';
import { requirePaidFeature } from '../src/services/unlockService';
import { notifyLocalCompletion } from '../src/services/notificationService';
import { getLiveConfig } from '../src/services/api';
import { cleanupAvailability, failOperation, finishOperation, getOperationJob, startOperation, updateOperation } from '../src/services/operationService';

function cleanupKey(item: any, index: number) { return `${item.contactId}:${item.phoneIndex ?? 0}:${item.oldNumber}:${item.newNumber}:${index}`; }

export default function Cleanup() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const [scan, setScan] = useState<any>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<any>(null);
  const [availability, setAvailability] = useState({ available: false, reason: 'Checking cleanup availability…' });
  const [savedJob, setSavedJob] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getJson<any>(keys.scan, null), getJson<any>(keys.rules, null), getLiveConfig(), getOperationJob()]).then(([savedScan, rules, config, job]) => {
      if (!active) return;
      const current = Boolean(savedScan && hasApprovedMigrationRules(rules) && savedScan.rulesVersion === rules.versionNumber && savedScan.schemaVersion === SCAN_SCHEMA_VERSION);
      setScan(current ? savedScan : null);
      setSelected({});
      setAvailability(cleanupAvailability(config));
      setSavedJob(job?.kind === 'cleanup' ? job : null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const all = (scan?.cleanup || []) as any[];
  const filtered = useMemo(() => all.filter((item) => `${item.contactName} ${item.oldNumber} ${item.newNumber} ${item.operatorName}`.toLowerCase().includes(q.toLowerCase())), [all, q]);
  const keyed = useMemo(() => filtered.map((item, index) => ({ item, key: cleanupKey(item, index) })), [filtered]);
  const selectedItems = useMemo(() => keyed.filter(({ item, key }) => selected[key] && item.status === 'Safe').map(({ item }) => item), [keyed, selected]);

  function setVisible(value: boolean) { setSelected((current) => { const next = { ...current }; keyed.forEach(({ item, key }) => { if (item.status === 'Safe') next[key] = value; }); return next; }); }

  async function confirm() {
    if (!availability.available) { showDialog({ title: 'Cleanup unavailable', message: availability.reason, tone: 'warning', icon: 'lock' }); return; }
    if (!selectedItems.length) { showDialog({ title: 'Nothing selected', message: 'Select at least one safe duplicate pair first.', tone: 'warning', icon: 'warning' }); return; }
    try { await requirePaidFeature(); } catch (e: any) { showDialog({ title: 'Full unlock required', message: e?.message || 'Complete payment before removing old duplicate numbers.', tone: 'warning', icon: 'shield', actions: [{ text: 'Cancel', variant: 'secondary' }, { text: 'Go to Payment', tone: 'primary', onPress: () => router.push('/payment') }] }); return; }
    showDialog({
      title: 'Confirm cleanup',
      message: 'This removes old 7-digit numbers from selected contacts only when the matching new number is already saved in the same contact. A verified local backup will be created first.',
      tone: 'danger',
      icon: 'cleanup',
      actions: [
        { text: 'Cancel', variant: 'secondary' },
        { text: 'Remove Old Numbers', variant: 'danger', tone: 'danger', onPress: async () => {
          try {
            setBusy(true);
            setProgress({ processed: 0, total: selectedItems.length, percent: 0 });
            await startOperation('cleanup', 'Removing verified old duplicates', selectedItems.length, '/cleanup');
            const r = await removeOldDuplicates(selectedItems, (p) => { setProgress(p); void updateOperation(p); });
            await finishOperation(`${r.removed} old numbers removed safely.`);
            await notifyLocalCompletion(r.failed ? 'Cleanup completed with issues' : 'Cleanup complete', `${r.removed.toLocaleString()} verified old numbers removed.`, { screen: 'cleanup' });
            router.replace({ pathname: '/complete', params: { kind: 'cleanup', updated: String(r.removed || 0), skipped: String(r.skipped || 0), failed: String(r.failed || 0), total: String(selectedItems.length), backupId: String(r.backupId || '') } });
          }
          catch (e: any) { await failOperation(e?.message || 'Cleanup failed.'); showDialog({ title: 'Cleanup failed', message: e?.message || 'Could not cleanup contacts.', tone: 'danger', icon: 'warning' }); }
          finally { setBusy(false); setProgress(null); }
        } }
      ]
    });
  }

  const topHeader = <BackHeader title="Remove Old Duplicates" subtitle="Clean old numbers only after safe verification." />;
  const header = (
    <>
<<<<<<< HEAD
      <View style={{ marginBottom: 10 }}><NoticeCard title={availability.available ? 'Verified pairs only' : 'Availability schedule'} text={availability.available ? 'Old numbers are removed only when the matching new number is saved. A backup is created and the new number is verified again after writing.' : availability.reason} tone="warning" icon="warning" /></View>
      <View style={{ marginBottom: 10 }}><NoticeCard title="Cleanup happens on this device" text="Cleanup availability may be scheduled by the service, but contact scanning and cleanup happen entirely on this device. Administrators cannot view, access or delete your contacts." tone="primary" icon="lock" /></View>
      {savedJob?.status === 'running' ? <Card style={{ marginBottom: 10 }}><Text style={{ color: colors.text, fontWeight: '900' }}>Cleanup still running · {savedJob.percent}%</Text><Text style={styles.small}>{savedJob.processed} of {savedJob.total} processed. You may use another page and return here.</Text></Card> : null}
=======
      <View style={{ marginBottom: 10 }}><NoticeCard title="Verified cleanup only" text="Old numbers are removed only when the matching new number is saved." tone="warning" icon="warning" /></View>
>>>>>>> caf642300d18bdafaf97e0019a2a51dfed96b56c
      <SearchBox value={q} onChangeText={setQ} placeholder="Search contact or number" />
      <View style={[styles.rowBetween, { marginTop: 12, marginBottom: 10 }]}> 
        <Text style={styles.body}><Text style={{ color: colors.text, fontWeight: '800' }}>{selectedItems.length}</Text> selected · {filtered.length} shown</Text>
        <View style={[styles.row, { gap: 6 }]}><TouchableOpacity accessibilityRole="button" accessibilityLabel="Select all visible safe duplicates" onPress={() => setVisible(true)} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontWeight: '900' }}>Select all</Text></TouchableOpacity><TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear selected duplicates" onPress={() => setVisible(false)} style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' }}><Text style={{ color: colors.softText, fontWeight: '900' }}>Clear</Text></TouchableOpacity></View>
      </View>
    </>
  );
<<<<<<< HEAD
  const footer = <View style={{ height: 116 }} />;
  const actionBar = all.length ? <FloatingActionBar><View style={{ borderRadius: 28, padding: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.warning, shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}><View style={[styles.rowBetween, { gap: 12 }]}><View style={{ minWidth: 72, paddingLeft: 4 }}><Text style={{ color: colors.text, fontSize: 25, lineHeight: 29, fontWeight: '900' }}>{selectedItems.length}</Text><Text style={styles.small}>Selected</Text></View><Button title={busy && progress ? `${progress.percent}% · ${progress.processed}/${progress.total}` : availability.available ? 'Remove old numbers' : 'Cleanup unavailable'} loading={busy} disabled={busy || !selectedItems.length || !availability.available} variant="danger" icon="cleanup" onPress={confirm} style={{ flex: 1, minHeight: 58, borderRadius: 20 }} /></View></View></FloatingActionBar> : null;
=======
  const footer = <Button title={`Remove Selected (${selectedItems.length})`} loading={busy} disabled={busy || !selectedItems.length} variant="danger" icon="cleanup" onPress={confirm} style={{ marginTop: 2 }} />;
>>>>>>> caf642300d18bdafaf97e0019a2a51dfed96b56c

  return <>
    <ListScreen data={keyed} keyExtractor={(entry) => entry.key} topHeader={topHeader} header={header} footer={footer} empty={loading ? <Card><Text style={styles.body}>Loading cleanup results...</Text></Card> : <EmptyState icon="cleanup" title={scan ? 'No safe duplicate pairs' : 'Scan required'} text={scan ? 'No verified old/new pairs match this search.' : 'Scan your contacts first. Only verified old/new pairs will appear here.'} />} renderItem={({ item: entry }) => {
    const { item, key } = entry; const active = !!selected[key];
    return (
<<<<<<< HEAD
      <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={`${item.contactName || 'Unnamed contact'}, remove ${item.oldNumber} and keep ${item.newNumber}`} accessibilityState={{ checked: active, disabled: busy || item.status !== 'Safe' }} activeOpacity={0.85} disabled={busy} onPress={() => item.status === 'Safe' && setSelected((current) => ({ ...current, [key]: !current[key] }))} style={[styles.card, { marginBottom: 8, padding: 14, minHeight: 92, borderColor: active ? colors.warning : colors.line }]}>
=======
      <TouchableOpacity activeOpacity={0.85} disabled={busy} onPress={() => item.status === 'Safe' && setSelected((current) => ({ ...current, [key]: !current[key] }))} style={[styles.card, { marginBottom: 8, padding: 12, borderColor: active ? colors.warning : colors.line }]}>
>>>>>>> caf642300d18bdafaf97e0019a2a51dfed96b56c
        <View style={styles.rowBetween}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{item.contactName || 'Unnamed contact'}</Text>{item.status === 'Safe' ? <OperatorBadge operator={item.operatorName} /> : <Pill text={item.status || 'Review'} tone="danger" />}</View>
        <View style={[styles.rowBetween, { marginTop: 8, gap: 8 }]}><Text style={{ color: colors.danger, fontWeight: '800' }}>− {item.oldNumber}</Text><Text style={{ color: colors.success, fontWeight: '800' }}>Keep {item.newNumber}</Text></View>
      </TouchableOpacity>
    );
  }} />
    {actionBar}
    <Dialog />
  </>;
}
