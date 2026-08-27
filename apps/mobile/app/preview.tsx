import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, EmptyState, FilterChip, FixedBottomTabs, FloatingActionBar, OperatorBadge, Pill, SearchBox, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { SCAN_SCHEMA_VERSION, applyDuplicateAdd, applyReplace } from '../src/services/contactsService';
import { getJson, keys } from '../src/services/storage';
import { authorizeMigration, getAccessStatus, settleMigrationAllowance, type AccessStatus } from '../src/services/unlockService';
import { getTone, radius, type Tone, useAppTheme, useResponsive } from '../src/appTheme';
import { hasApprovedMigrationRules } from '@gnm/shared';
import { notifyLocalCompletion } from '../src/services/notificationService';
import { failOperation, finishOperation, startOperation, updateOperation } from '../src/services/operationService';

function candidateKey(item: any) { return `${item.contactId}:${item.phoneIndex}:${item.originalNumber}:${item.migratedNumber || 'review'}`; }
function operatorTone(name?: string): Tone { const n = String(name || '').toLowerCase(); return n.includes('qcell') ? 'violet' : n.includes('comium') ? 'blue' : n.includes('africell') ? 'gold' : 'muted'; }
function statusTone(status?: string): Tone { return status === 'Ready' ? 'success' : status?.includes('Unsafe') ? 'danger' : status?.includes('Review') || status?.includes('Risk') ? 'warning' : status?.includes('Updated') || status?.includes('Added') || status?.includes('Duplicate Pair') ? 'blue' : 'muted'; }
function belongsToOperator(item: any, filter: string) {
  if (filter === 'All') return true;
  if (filter === 'Needs Update') return item.status === 'Ready';
  if (filter === 'Updated') return ['Duplicate Pair Found', 'Already Added', 'Already Updated'].includes(item.status);
  if (filter === 'Review') return ['Manual Review', 'Duplicate Risk', 'Invalid', 'Unsafe'].includes(item.status);
  return String(item.operatorName || '').toLowerCase().includes(filter.toLowerCase());
}

export default function Preview() {
  const { colors, styles } = useAppTheme();
  const params = useLocalSearchParams<{ filter?: string; mode?: string }>();
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const { showDialog, Dialog } = useAppDialog();
  const [scan, setScan] = useState<any>(null);
  const [q, setQ] = useState('');
  const [filter, setFilterState] = useState('All');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<'duplicate' | 'replace'>('duplicate');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowReplace, setAllowReplace] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<any>(null);
  const pauseRequested = useRef(false);
  const [access, setAccess] = useState<AccessStatus | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.all([getJson<any>(keys.scan, null), getJson<any>(keys.transition, null), getJson<any>(keys.rules, null), getAccessStatus()]).then(([savedScan, transition, rules, accessStatus]) => {
      if (!active) return;
      const scanIsCurrent = Boolean(savedScan && hasApprovedMigrationRules(rules) && savedScan.rulesVersion === rules.versionNumber && savedScan.schemaVersion === SCAN_SCHEMA_VERSION);
      setScan(scanIsCurrent ? savedScan : null);
      setAllowReplace(Boolean(transition?.allowReplaceMode));
      const savedMode = scanIsCurrent ? savedScan?.candidates?.[0]?.updateMode : undefined;
      setMode(transition?.allowReplaceMode && (params.mode === 'replace' || savedMode === 'replace') ? 'replace' : 'duplicate');
      setSelected({});
      setAccess(accessStatus);
    }).catch(() => { if (active) setScan(null); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.mode]));

  useEffect(() => {
    const requestedFilter = typeof params.filter === 'string' ? params.filter : '';
    if (['All', 'Needs Update', 'Updated', 'QCell', 'Comium', 'Africell', 'Review'].includes(requestedFilter)) setFilterState(requestedFilter);
    if (params.mode === 'duplicate') setMode('duplicate');
  }, [params.filter, params.mode]);

  const all = (scan?.candidates || []) as any[];
  const groups = ['All', 'Needs Update', 'Updated', 'QCell', 'Comium', 'Africell', 'Review'];
  const operatorCounts: Record<string, number> = useMemo(() => ({
    All: all.length,
    'Needs Update': all.filter((x) => x.status === 'Ready').length,
    Updated: all.filter((x) => belongsToOperator(x, 'Updated')).length,
    QCell: all.filter((x) => belongsToOperator(x, 'QCell')).length,
    Comium: all.filter((x) => belongsToOperator(x, 'Comium')).length,
    Africell: all.filter((x) => belongsToOperator(x, 'Africell')).length,
    Review: all.filter((x) => belongsToOperator(x, 'Review')).length,
  }), [all]);

  const filtered = useMemo(() => all.filter((item) => {
    const needle = q.trim().toLowerCase();
    const hay = `${item.contactName} ${item.originalNumber} ${item.migratedNumber} ${item.operatorName} ${item.status}`.toLowerCase();
    return (!needle || hay.includes(needle)) && belongsToOperator(item, filter);
  }), [all, q, filter]);

  const visibleReady = filtered.filter((item) => item.status === 'Ready');
  // Selection belongs to the whole scan, not the current search/operator view.
  // A filter change must never silently remove contacts from the migration job.
  const selectedItems = useMemo(() => all.filter((item) => item.status === 'Ready' && selected[candidateKey(item)]), [all, selected]);
  const visibleSelectedCount = useMemo(() => visibleReady.filter((item) => selected[candidateKey(item)]).length, [visibleReady, selected]);
  const readyCount = all.filter((item) => item.status === 'Ready').length;

  function setFilter(nextFilter: string) {
    setFilterState(nextFilter);
    setQ('');
  }

  function setVisible(value: boolean) {
    setSelected((current) => {
      const next = { ...current };
      let slots = access?.paid ? Number.MAX_SAFE_INTEGER : Math.max(0, access?.remaining ?? 10);
      filtered.forEach((item) => { if (item.status === 'Ready') { const key = candidateKey(item); next[key] = value && slots > 0; if (next[key]) slots--; } });
      return next;
    });
  }

  function toggleItem(item: any) {
    const key = candidateKey(item);
    if (!selected[key] && !access?.paid && selectedItems.length >= (access?.remaining ?? 10)) {
      showDialog({ title: 'Free limit reached', message: `You can select ${access?.remaining ?? 10} more contact migrations. Unlock the app for unlimited migration.`, tone: 'warning', icon: 'premium', actions: [{ text: 'Not now', variant: 'secondary' }, { text: 'Full Unlock', onPress: () => router.push('/payment') }] });
      return;
    }
    setSelected((current) => ({ ...current, [key]: !current[key] }));
  }

  async function apply() {
    if (!selectedItems.length) {
      showDialog({ title: 'Nothing selected', message: 'Select at least one ready number from the current operator filter first.', tone: 'warning', icon: 'warning' });
      return;
    }
    if (mode === 'replace' && !allowReplace) {
      showDialog({ title: 'Replace mode unavailable', message: 'The administrator has disabled replacement. Use Add & Keep Old for this migration.', tone: 'warning', icon: 'warning' });
      setMode('duplicate');
      return;
    }
    const action = mode === 'replace' ? 'replace the selected old numbers' : 'add the selected new numbers while keeping old numbers';
    showDialog({
      title: 'Confirm migration',
      message: `This will ${action} for ${selectedItems.length} visible selected contact${selectedItems.length === 1 ? '' : 's'}. A local backup will be created first.`,
      tone: mode === 'replace' ? 'warning' : 'primary',
      icon: mode === 'replace' ? 'warning' : 'shield',
      actions: [
        { text: 'Cancel', variant: 'secondary' },
        { text: 'Continue', tone: mode === 'replace' ? 'warning' : 'primary', onPress: async () => {
          try {
            setBusy(true);
            pauseRequested.current = false;
            setMigrationProgress({ processed: 0, total: selectedItems.length, percent: 0, succeeded: 0, skipped: 0, failed: 0 });
            const existingJob = await getJson<any>(keys.migrationJob, null);
            const operation = mode === 'replace' ? 'replace_update' : 'duplicate_add';
            const sameResumableJob = existingJob?.status === 'running' && existingJob?.operation === operation && selectedItems.every((item) => existingJob.selectedKeys?.includes(candidateKey(item)));
            const authorization = sameResumableJob ? null : await authorizeMigration(selectedItems.length, mode);
            await startOperation('migration', mode === 'replace' ? 'Replacing selected contact numbers' : 'Adding new contact numbers', selectedItems.length, '/preview');
            const onProgress = (progress: any) => { setMigrationProgress(progress); void updateOperation(progress); };
            const shouldPause = () => pauseRequested.current;
            const result = mode === 'replace' ? await applyReplace(selectedItems, onProgress, shouldPause) : await applyDuplicateAdd(selectedItems, onProgress, shouldPause);
            const succeeded = Number((result as any).added || (result as any).replaced || 0);
            await finishOperation(`${succeeded} contact numbers updated.`);
            // Successful writes are recorded as a local pending allowance debt
            // before network settlement, so an interrupted request is retried
            // before the next free migration.
            if (authorization?.access === 'trial') await settleMigrationAllowance(selectedItems.length, succeeded).catch(() => undefined);
            const failureSummary = ((result as any).failureDetails || []).slice(0, 3).map((item: any) => `${item.contactName}: ${item.reason}`).join(' | ');
            await notifyLocalCompletion(
              (result as any).failed ? 'Migration completed with issues' : 'Migration complete',
              `${succeeded.toLocaleString()} updated · ${Number((result as any).failed || 0).toLocaleString()} failed`,
              { screen: 'history' },
            );
            router.replace({ pathname: '/complete', params: { total: String(selectedItems.length), updated: String((result as any).added || (result as any).replaced || 0), copied: String((result as any).copied || 0), skipped: String((result as any).skipped || 0), failed: String((result as any).failed || 0), backupId: String((result as any).backupId || ''), failureSummary } });
          } catch (e: any) {
            await failOperation(e?.message || 'Migration paused or failed.');
            const paymentNeeded = /premium|payment|trial/i.test(e?.message || '');
            showDialog({ title: paymentNeeded ? 'Full unlock required' : 'Migration paused safely', message: e?.message || 'Could not update contacts. Re-select the same contacts to resume from the last checkpoint.', tone: paymentNeeded ? 'warning' : 'danger', icon: paymentNeeded ? 'shield' : 'warning', actions: paymentNeeded ? [{ text: 'Cancel', variant: 'secondary' }, { text: 'Go to Payment', onPress: () => router.push('/payment') }] : [{ text: 'OK' }] });
          } finally { setBusy(false); setMigrationProgress(null); }
        } },
      ],
    });
  }

  const activeTone = filter === 'QCell' ? 'violet' : filter === 'Comium' ? 'blue' : filter === 'Africell' ? 'gold' : filter === 'Review' ? 'warning' : filter === 'Updated' ? 'blue' : filter === 'Needs Update' ? 'success' : 'primary';
  const activeToneValue = getTone(colors, activeTone as Tone);

  const stickyHeader = (
    <View style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 10 }}>
      <View style={{ width: '100%', maxWidth: r.maxWidth as any, alignSelf: 'center', paddingHorizontal: r.horizontalPadding }}>
        <BackHeader
          title="Preview Changes"
          subtitle={`${readyCount.toLocaleString()} ready · ${visibleReady.length.toLocaleString()} ready in view`}
          compact
          right={<Pill text={filter === 'All' ? 'All operators' : filter} tone={activeTone as Tone} />}
        />
        <SearchBox value={q} onChangeText={setQ} placeholder="Search contact name or phone number" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: 10 }}>
          {groups.map((g) => {
            const tone = g === 'QCell' ? 'violet' : g === 'Comium' ? 'blue' : g === 'Africell' ? 'gold' : g === 'Review' ? 'warning' : g === 'Updated' ? 'blue' : g === 'Needs Update' ? 'success' : 'primary';
            return <FilterChip key={g} title={g} count={operatorCounts[g] || 0} active={filter === g} tone={tone as Tone} onPress={() => setFilter(g)} />;
          })}
        </ScrollView>
        <View style={{ gap: 10 }}>
          <View style={[styles.rowBetween, { gap: 10 }]}> 
            <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.label}>Selection</Text><Text style={styles.small}>{selectedItems.length.toLocaleString()} selected in total · {visibleSelectedCount.toLocaleString()} in this view</Text></View>
            <Pill text={mode === 'duplicate' ? 'Keep old number' : 'Replace old number'} tone={mode === 'duplicate' ? 'primary' : 'warning'} />
          </View>
          {!access?.paid ? <Text style={[styles.small, { color: colors.warning }]}>Free access: {access?.remaining ?? 10} migrations remaining. Select All is limited automatically.</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SelectionButton title="Select all ready" icon="check" active onPress={() => setVisible(true)} />
            <SelectionButton title="Clear selection" icon="close" onPress={() => setVisible(false)} />
          </View>
        </View>
      </View>
    </View>
  );

  const actionBar = all.length ? (
    <FloatingActionBar>
      <View style={{ borderRadius: 28, padding: 10, backgroundColor: colors.isDark ? 'rgba(16,43,86,0.96)' : 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: activeToneValue.border, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.35 : 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}>
        <View style={[styles.rowBetween, { gap: 12 }]}> 
          <View style={{ minWidth: 82, paddingLeft: 4 }}>
            <Text style={{ color: colors.text, fontSize: 25, lineHeight: 29, fontWeight: '900' }}>{selectedItems.length}</Text>
            <Text style={styles.small}>Selected</Text>
          </View>
          {busy ? <><Button title="Pause" variant="secondary" tone="warning" icon="warning" onPress={() => { pauseRequested.current = true; }} /><Button title={migrationProgress ? `${migrationProgress.percent}% · ${migrationProgress.processed}/${migrationProgress.total}` : 'Preparing…'} loading style={{ flex: 1, borderRadius: 20, minHeight: 58 }} /></> : <Button title={mode === 'replace' ? 'Replace Selected' : 'Migrate Selected'} icon="right" disabled={!selectedItems.length} onPress={apply} style={{ flex: 1, borderRadius: 20, minHeight: 58 }} />}
        </View>
      </View>
    </FloatingActionBar>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {stickyHeader}
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={filtered}
        keyExtractor={(item) => candidateKey(item)}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        updateCellsBatchingPeriod={40}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 230 + insets.bottom }}
        ListEmptyComponent={<View style={{ width: '100%', maxWidth: r.maxWidth as any, alignSelf: 'center', paddingHorizontal: r.horizontalPadding }}>{loading ? <Card><Text style={styles.body}>Loading scan results...</Text></Card> : !scan ? <EmptyState icon="scan" title="Scan required" text="Scan your contacts first to create a current preview." action={<Button title="Go to Dashboard" onPress={() => router.replace('/dashboard')} />} /> : <EmptyState icon="scan" title="No numbers in this view" text="Try another filter or search, or scan contacts again to refresh the results." action={<Button title="Clear Filters" onPress={() => { setQ(''); setFilter('All'); }} />} />}</View>}
        ListHeaderComponent={all.length ? <View style={{ width: '100%', maxWidth: r.maxWidth as any, alignSelf: 'center', paddingHorizontal: r.horizontalPadding, marginBottom: 8 }}>
          <Card style={{ padding: 12, marginBottom: 8 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 9 }}>Save selected numbers as</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ModeButton title="Add new · keep old" active={mode === 'duplicate'} tone="primary" onPress={() => setMode('duplicate')} />
              <ModeButton title={allowReplace ? 'Replace old number' : 'Replace disabled'} active={mode === 'replace'} tone="warning" disabled={!allowReplace} onPress={() => setMode('replace')} />
            </View>
            <Text style={[styles.small, { marginTop: 9 }]}>Tap a contact row to select it. No contact changes until you confirm.</Text>
          </Card>
        </View> : null}
        renderItem={({ item }) => {
          const key = candidateKey(item);
          const active = !!selected[key] && item.status === 'Ready';
          const tone = operatorTone(item.operatorName);
          const t = getTone(colors, tone);
          const selectable = item.status === 'Ready';
          const alreadyCurrent = item.status === 'Already Updated' && (
            item.originalNumber === item.migratedNumber
            || String(item.originalNumber || '').replace(/\D/g, '').endsWith(String(item.migratedNumber || ''))
          );
          return (
            <View style={{ width: '100%', maxWidth: r.maxWidth as any, alignSelf: 'center', paddingHorizontal: r.horizontalPadding }}>
              <TouchableOpacity accessibilityRole="checkbox" accessibilityLabel={`${item.contactName || 'Unnamed contact'}, ${item.originalNumber} to ${item.migratedNumber || 'manual review'}`} accessibilityState={{ checked: active, disabled: !selectable || busy }} activeOpacity={0.76} disabled={!selectable || busy} onPress={() => toggleItem(item)} style={{ minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10, paddingHorizontal: 6, opacity: selectable ? 1 : 0.6, backgroundColor: active ? colors.primarySoft : 'transparent' }}>
                <View style={[styles.row, { gap: 12 }]}> 
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: t.fg, fontWeight: '900', fontSize: 17 }}>{String(item.contactName || '?').trim()[0]?.toUpperCase() || '?'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={[styles.rowBetween, { gap: 8 }]}> 
                      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '900', fontSize: 16, flex: 1 }}>{item.contactName || 'Unnamed contact'}</Text>
                      {item.status === 'Ready' ? <OperatorBadge operator={item.operatorName} /> : <Pill text={item.status || 'Review'} tone={statusTone(item.status)} />}
                    </View>
                    {alreadyCurrent ? (
                      <View style={[styles.row, { gap: 7, marginTop: 5 }]}>
                        <AppIcon name="check" color={colors.success} size={15} />
                        <Text numberOfLines={1} style={{ color: colors.success, fontWeight: '800', flexShrink: 1 }}>{item.originalNumber} · current 9-digit format</Text>
                      </View>
                    ) : (
                      <View style={[styles.row, { gap: 7, marginTop: 5 }]}> 
                        <Text numberOfLines={1} style={{ color: colors.muted, fontWeight: '700', flexShrink: 1 }}>{item.originalNumber}</Text>
                        <AppIcon name="right" color={colors.primary} size={15} />
                        <Text numberOfLines={1} style={{ color: t.fg, fontWeight: '800', flexShrink: 1 }}>{item.migratedNumber || 'Manual review'}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primary : colors.card, alignItems: 'center', justifyContent: 'center' }}>
                    {active ? <AppIcon name="check" color={colors.white} size={15} /> : null}
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />
      {actionBar}
      <FixedBottomTabs />
      <Dialog />
    </SafeAreaView>
  );
}

function ModeButton({ title, active, tone, disabled = false, onPress }: { title: string; active: boolean; tone: Tone; disabled?: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <TouchableOpacity activeOpacity={0.84} disabled={disabled} onPress={onPress} style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: active ? t.fg : colors.line, backgroundColor: active ? t.bg : colors.surface2, opacity: disabled ? 0.45 : 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text numberOfLines={2} style={{ color: active ? t.fg : colors.muted, fontWeight: '900', fontSize: 12, textAlign: 'center' }}>{title}</Text>
    </TouchableOpacity>
  );
}

function SelectionButton({ title, icon, active = false, onPress }: { title: string; icon: string; active?: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return <TouchableOpacity activeOpacity={0.82} onPress={onPress} style={{ flex: 1, minHeight: 42, borderRadius: radius.lg, borderWidth: 1, borderColor: active ? colors.primary : colors.line, backgroundColor: active ? colors.primarySoft : colors.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8 }}><AppIcon name={icon} color={active ? colors.primary : colors.muted} size={15} /><Text numberOfLines={1} style={{ color: active ? colors.primary : colors.muted, fontWeight: '900', fontSize: 12 }}>{title}</Text></TouchableOpacity>;
}
