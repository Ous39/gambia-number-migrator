import { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, EmptyState, ListScreen, NoticeCard, OperatorBadge, Pill, SearchBox, useAppDialog } from '../src/components/UI';
import { removeOldDuplicates } from '../src/services/contactsService';
import { getJson, keys } from '../src/services/storage';
import { useAppTheme } from '../src/appTheme';
import { hasApprovedMigrationRules } from '@gnm/shared';
import { requirePaidFeature } from '../src/services/unlockService';

function cleanupKey(item: any) { return `${item.contactId}:${item.oldNumber}:${item.newNumber}`; }

export default function Cleanup() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const [scan, setScan] = useState<any>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getJson<any>(keys.scan, null), getJson<any>(keys.rules, null)]).then(([savedScan, rules]) => {
      if (!active) return;
      const current = Boolean(savedScan && hasApprovedMigrationRules(rules) && savedScan.rulesVersion === rules.versionNumber);
      setScan(current ? savedScan : null);
      setSelected({});
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const all = (scan?.cleanup || []) as any[];
  const filtered = useMemo(() => all.filter((item) => `${item.contactName} ${item.oldNumber} ${item.newNumber} ${item.operatorName}`.toLowerCase().includes(q.toLowerCase())), [all, q]);
  const selectedItems = useMemo(() => filtered.filter((item) => selected[cleanupKey(item)] && item.status === 'Safe'), [filtered, selected]);

  function setVisible(value: boolean) { setSelected((current) => { const next = { ...current }; filtered.forEach((item) => { if (item.status === 'Safe') next[cleanupKey(item)] = value; }); return next; }); }

  async function confirm() {
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
          try { setBusy(true); const r = await removeOldDuplicates(selectedItems); router.replace({ pathname: '/complete', params: { updated: String(r.removed || 0), skipped: String(r.skipped || 0), failed: String(r.failed || 0), total: String(selectedItems.length), backupId: String(r.backupId || '') } }); }
          catch (e: any) { showDialog({ title: 'Cleanup failed', message: e?.message || 'Could not cleanup contacts.', tone: 'danger', icon: 'warning' }); }
          finally { setBusy(false); }
        } }
      ]
    });
  }

  const topHeader = <BackHeader title="Remove Old Duplicates" subtitle="Clean old numbers only after safe verification." />;
  const header = (
    <>
      <NoticeCard title="Safety rule" text="The app never removes an old number unless the matching new number exists in the same contact and the pair is verified by the rules engine." tone="warning" icon="warning" />
      <SearchBox value={q} onChangeText={setQ} placeholder="Search contact or number" />
      <View style={[styles.rowBetween, { marginVertical: 14 }]}> 
        <Text style={styles.body}><Text style={{ color: colors.text, fontWeight: '800' }}>{selectedItems.length}</Text> selected · {filtered.length} shown</Text>
        <View style={[styles.row, { gap: 8 }]}><TouchableOpacity onPress={() => setVisible(true)}><Text style={{ color: colors.primary, fontWeight: '800' }}>All</Text></TouchableOpacity><Text style={{ color: colors.softText }}>/</Text><TouchableOpacity onPress={() => setVisible(false)}><Text style={{ color: colors.softText, fontWeight: '800' }}>None</Text></TouchableOpacity></View>
      </View>
    </>
  );
  const footer = <Card style={{ marginTop: 10 }}><Button title={`Remove Selected (${selectedItems.length})`} loading={busy} disabled={busy || !selectedItems.length} variant="danger" icon="cleanup" onPress={confirm} /></Card>;

  return <>
    <ListScreen data={filtered} keyExtractor={(item) => cleanupKey(item)} topHeader={topHeader} header={header} footer={footer} empty={loading ? <Card><Text style={styles.body}>Loading cleanup results...</Text></Card> : <EmptyState icon="cleanup" title={scan ? 'No safe duplicate pairs' : 'Scan required'} text={scan ? 'No verified old/new pairs match this search.' : 'Scan your contacts first. Only verified old/new pairs will appear here.'} />} renderItem={({ item }) => {
    const key = cleanupKey(item); const active = !!selected[key];
    return (
      <TouchableOpacity activeOpacity={0.85} disabled={busy} onPress={() => item.status === 'Safe' && setSelected((current) => ({ ...current, [key]: !current[key] }))} style={[styles.card, { marginBottom: 10, borderColor: active ? colors.warning : colors.line }]}> 
        <View style={styles.rowBetween}><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: 16, flex: 1 }}>{item.contactName || 'Unnamed contact'}</Text>{item.status === 'Safe' ? <OperatorBadge operator={item.operatorName} /> : <Pill text={item.status || 'Review'} tone="danger" />}</View>
        <View style={styles.divider} />
        <Text style={{ color: colors.danger, fontWeight: '800' }}>Remove old: {item.oldNumber}</Text>
        <Text style={{ color: colors.success, fontWeight: '800', marginTop: 6 }}>Keep new: {item.newNumber}</Text>
        <Text style={[styles.small, { marginTop: 8 }]}>{item.reason}</Text>
      </TouchableOpacity>
    );
  }} />
    <Dialog />
  </>;
}
