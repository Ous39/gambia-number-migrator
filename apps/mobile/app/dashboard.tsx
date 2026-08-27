import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { getRecommendedUpdateMode, getTransitionStatus, hasApprovedMigrationRules } from '@gnm/shared';
import { Button } from '../src/components/Button';
import { Card, FixedBottomTabs, MetricCard, NoticeCard, ProgressBar, ResponsiveGrid, Section, TopNav, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { syncConfig, syncRules, syncTransition } from '../src/services/api';
import { SCAN_SCHEMA_VERSION, scanContacts } from '../src/services/contactsService';
import { getJson, keys, setJson } from '../src/services/storage';
import { getTone, useAppTheme, useResponsive } from '../src/appTheme';
import { getAccessStatus, type AccessStatus } from '../src/services/unlockService';
import { cleanupAvailability, failOperation, finishOperation, getOperationJob, startOperation, updateOperation } from '../src/services/operationService';

function formatNumber(n: number) {
  return Number(n || 0).toLocaleString();
}

export default function Dashboard() {
  const { colors, styles } = useAppTheme();
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  const { showDialog, Dialog } = useAppDialog();
  const [rules, setRules] = useState<any>(null);
  const [transition, setTransition] = useState<any>(null);
  const [scan, setScan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [operation, setOperation] = useState<any>(null);
  const [cleanupAccess, setCleanupAccess] = useState({ available: false, reason: 'Cleanup is unavailable.' });

  async function load() {
    const [syncedRules, syncedTransition, config, savedScan, accessStatus, savedOperation] = await Promise.all([
      syncRules(),
      syncTransition(),
      syncConfig(),
      getJson<any>(keys.scan, null),
      getAccessStatus(),
      getOperationJob(),
    ]);
    setRules(syncedRules);
    setTransition(syncedTransition);
    setAccess(accessStatus);
    setOperation(savedOperation);
    setCleanupAccess(cleanupAvailability(config));
    const scanIsCurrent = Boolean(savedScan && hasApprovedMigrationRules(syncedRules) && savedScan.rulesVersion === syncedRules.versionNumber && savedScan.schemaVersion === SCAN_SCHEMA_VERSION);
    setScan(scanIsCurrent ? savedScan : null);
    if (savedScan && !scanIsCurrent) await setJson(keys.scan, null);
  }

  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, []));

  useEffect(() => {
    if (operation?.status !== 'running') return;
    const timer = setInterval(() => {
      getOperationJob().then(setOperation).catch(() => undefined);
    }, 750);
    return () => clearInterval(timer);
  }, [operation?.status]);

  const recommended = transition ? getRecommendedUpdateMode(transition) : 'duplicate';
  const status = transition ? getTransitionStatus(transition) : 'before_transition';
  const statusLabel = status === 'after_transition' ? 'Cleanup phase' : status === 'during_transition' ? 'Transition active' : 'Ready to prepare';
  const metrics = useMemo(() => {
    const candidates = scan?.candidates || [];
    const cleanup = scan?.cleanup || [];
    const ready = candidates.filter((c: any) => c.status === 'Ready').length;
    const updated = candidates.filter((c: any) => ['Duplicate Pair Found', 'Already Added', 'Already Updated'].includes(c.status)).length;
    const review = candidates.filter((c: any) => ['Manual Review', 'Duplicate Risk', 'Invalid', 'Unsafe'].includes(c.status)).length;
    return {
      total: scan?.contactsCount || 0,
      pending: ready,
      updated,
      review,
      cleanup: cleanup.filter((c: any) => c.status === 'Safe').length,
    };
  }, [scan]);
  const actionableTotal = metrics.pending + metrics.updated;
  const completion = actionableTotal > 0 ? Math.round((metrics.updated / actionableTotal) * 100) : 0;
  const rulesCount = rules?.rules?.length || 0;
  const flowTone = getTone(colors, recommended === 'duplicate' ? 'primary' : 'warning');

  async function doScan(force = false) {
    try {
      if (scan && !force) {
        router.push({ pathname: '/preview', params: { filter: 'All', source: 'saved-scan' } });
        return;
      }
      if (!hasApprovedMigrationRules(rules)) {
        showDialog({
          title: 'Rules not synced',
          message: 'No verified official migration rules are available. Publish the approved operator ranges in Admin, then refresh the app.',
          tone: 'warning',
          icon: 'warning',
        });
        return;
      }
      setLoading(true);
      setScanProgress(1);
      await startOperation('scan', force ? 'Refreshing contact scan' : 'Scanning contacts', 0, '/dashboard');
      const result = await scanContacts(rules, recommended, (p) => { setScanProgress(p.percent); void updateOperation(p); });
      await finishOperation(`${result.contactsCount} contacts scanned locally.`);
      setScan(result);
      router.push({ pathname: '/scan-complete', params: { total: String(result.contactsCount || 0), pending: String(result.summary.ready), updated: String(result.summary.alreadyUpdated), review: String(result.summary.review), unchanged: String(result.summary.unchangedContacts), duration: String(result.durationMs || 0) } });
    } catch (e: any) {
      await failOperation(e?.message || 'Contact scan failed.');
      showDialog({ title: 'Scan failed', message: e?.message || 'Could not scan contacts. Please check contact permission and try again.', tone: 'danger', icon: 'warning' });
    } finally {
      setLoading(false);
      setScanProgress(0);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load().catch(() => undefined);
    setRefreshing(false);
  }

  function openPreview(filter: 'All' | 'Needs Update' | 'Review' | 'Updated' = 'All') {
    if (!scan) {
      showDialog({ title: 'Scan contacts first', message: 'Run a contact scan before opening Preview so the results are current and accurate.', tone: 'blue', icon: 'scan', actions: [{ text: 'Cancel', variant: 'secondary' }, { text: 'Scan Now', tone: 'primary', onPress: () => { void doScan(); } }] });
      return;
    }
    router.push({ pathname: '/preview', params: { filter, source: 'overview' } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <TopNav
        title="Dashboard"
        eyebrow="GAMBIA NUMBER MIGRATOR"
        right={<>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open notifications" activeOpacity={0.85} onPress={() => router.push('/notifications')} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="notification" color={colors.primary} size={21} /></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Refresh dashboard" accessibilityState={{ busy: refreshing }} activeOpacity={0.85} onPress={refresh} style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="refresh" color={colors.primary} size={21} /></TouchableOpacity>
        </>}
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: r.horizontalPadding, paddingTop: 12, paddingBottom: 126 + insets.bottom, width: '100%', maxWidth: r.maxWidth as any, alignSelf: 'center' }]}
      >
        <Card elevated style={{ padding: r.compact ? 16 : 20, marginBottom: 12, overflow: 'hidden', backgroundColor: colors.brandTop, borderColor: colors.brandMid }}>
          <View style={{ position: 'absolute', right: -58, top: -68, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.brandBubble }} />
          <View style={[styles.rowBetween, { gap: 14, alignItems: 'flex-start' }]}> 
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: 'rgba(255,255,255,0.76)', fontWeight: '800', fontSize: 12, letterSpacing: 1.1 }}>SAFE MIGRATION STATUS</Text>
              <Text style={{ color: colors.white, fontSize: r.compact ? 36 : 42, lineHeight: r.compact ? 42 : 48, fontWeight: '900', marginTop: 3 }}>{formatNumber(metrics.pending)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontWeight: '700' }}>{scan ? 'contacts ready to migrate' : 'Run a private on-device scan'}</Text>
            </View>
            <View style={{ width: r.compact ? 62 : 72, height: r.compact ? 62 : 72, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="contacts" color={colors.primary} size={30} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <MiniBlueStat label="Scanned" value={formatNumber(metrics.total)} icon="scan" />
            <MiniBlueStat label="Updated" value={formatNumber(metrics.updated)} icon="check" />
            <MiniBlueStat label="Cleanup" value={formatNumber(metrics.cleanup)} icon="cleanup" />
          </View>
        </Card>

        <View style={{ flexDirection: r.contentWidth > 340 ? 'row' : 'column', gap: 10, marginBottom: 14 }}>
          <Button title={loading ? 'Scanning...' : scan ? 'View Saved Scan' : 'Scan Contacts'} icon={scan ? 'preview' : 'scan'} loading={loading} disabled={loading} onPress={() => { void doScan(); }} style={{ flex: 1, minHeight: 56, borderRadius: 18 }} />
          <Button title="Preview" icon="preview" variant="secondary" tone="blue" onPress={() => openPreview('Needs Update')} style={{ flex: 1, minHeight: 56, borderRadius: 18 }} />
        </View>
        {scan && !loading ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Scan again for newly added or changed contacts" activeOpacity={0.82} onPress={() => { void doScan(true); }} style={{ minHeight: 48, marginTop: -6, marginBottom: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <AppIcon name="refresh" color={colors.primary} size={18} />
            <Text style={{ color: colors.primary, fontWeight: '900' }}>Scan again for new or changed contacts</Text>
          </TouchableOpacity>
        ) : null}

        {loading ? (
          <Card style={{ marginBottom: 18, gap: 12 }} elevated>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Scanning contacts</Text>
                <Text style={styles.small}>Processing locally on your phone</Text>
              </View>
              <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 18 }}>{scanProgress}%</Text>
            </View>
            <ProgressBar percent={scanProgress} />
          </Card>
        ) : null}
        {operation?.status === 'running' ? <Card elevated style={{ marginBottom: 14, gap: 8 }}><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>{operation.title}</Text><Text style={styles.small}>This continues while you use another page inside GNM. Keep the app open.</Text></View><Text style={{ color: colors.primary, fontWeight: '900' }}>{operation.percent}%</Text></View><ProgressBar percent={operation.percent} /></Card> : null}

        <Section title="Overview" right={<Text style={styles.small}>Tap a card to open</Text>} style={{ marginTop: 0 }}>
          <ResponsiveGrid minItemWidth={142} gap={12}>
            <MetricCard icon="contacts" value={formatNumber(metrics.total)} label="Total contacts" tone="secondary" helper={metrics.total ? 'All' : undefined} onPress={() => openPreview('All')} />
            <MetricCard icon="update" value={formatNumber(metrics.pending)} label="Ready to update" tone="primary" helper={metrics.pending ? 'Update' : 'Scan'} onPress={() => openPreview('Needs Update')} />
            <MetricCard icon="check" value={formatNumber(metrics.updated)} label="Already updated" tone="success" helper={metrics.updated ? 'View' : undefined} onPress={() => openPreview('Updated')} />
            <MetricCard icon="cleanup" value={formatNumber(metrics.cleanup)} label="Safe cleanup" tone="warning" helper={cleanupAccess.available && metrics.cleanup ? 'Clean' : 'Scheduled'} onPress={() => router.push('/cleanup')} />
          </ResponsiveGrid>
        </Section>

        <Section title="Recommended Flow" right={<Text style={styles.small}>{rulesCount} active rules</Text>}>
          <Card elevated style={{ gap: 14, borderColor: flowTone.border }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>{recommended === 'duplicate' ? 'Add & Keep Old' : 'Cleanup Mode'}</Text>
                <Text style={[styles.body, { marginTop: 4 }]}>{recommended === 'duplicate' ? 'Safest for the transition period. The app adds the new 9-digit number and keeps the 7-digit number.' : 'Remove old numbers only when the new number already exists in the same contact.'}</Text>
              </View>
              <View style={{ width: 58, height: 58, borderRadius: 21, backgroundColor: flowTone.bg, borderColor: flowTone.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
                <AppIcon name={recommended === 'duplicate' ? 'plus' : 'cleanup'} color={flowTone.fg} size={24} />
              </View>
            </View>
            <ProgressBar percent={completion} />
            <View style={styles.rowBetween}>
              <Text style={styles.small}>{statusLabel} · {completion}% already updated</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open backups" onPress={() => router.push('/backup')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ color: colors.primary, fontWeight: '900' }}>Backups</Text></TouchableOpacity>
            </View>
          </Card>
        </Section>

        <Section title="More tools">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Button title="Backups" icon="backup" variant="secondary" tone="teal" onPress={() => router.push('/backup')} style={{ flexGrow: 1, minWidth: 104 }} />
            <Button title="History" icon="history" variant="secondary" tone="violet" onPress={() => router.push('/history')} style={{ flexGrow: 1, minWidth: 104 }} />
            <Button title={cleanupAccess.available ? 'Cleanup' : 'Cleanup locked'} icon={cleanupAccess.available ? 'cleanup' : 'lock'} variant="secondary" tone="warning" onPress={() => router.push('/cleanup')} style={{ flexGrow: 1, minWidth: 104 }} />
          </View>
        </Section>

        <View style={{ marginTop: 18 }}>
          <NoticeCard
            title={access?.paid ? 'Contact migration unlocked' : 'Free access'}
            text={access?.paid ? 'Payment is confirmed on this device. Unlimited migration and premium backup tools are available.' : `You can migrate up to ${access?.freeTrialLimit ?? 10} contacts for free. ${access?.remaining ?? 10} remain. Backup management, restore, replace, and cleanup require Full Unlock.`}
            tone={access?.paid ? 'success' : 'gold'}
            icon={access?.paid ? 'check' : 'premium'}
          />
        </View>

        <Text style={[styles.small, { textAlign: 'center', marginTop: 18, paddingHorizontal: 8 }]}>Your contacts stay on this phone. Only verified migration rules are downloaded.</Text>
      </ScrollView>
      <FixedBottomTabs />
      <Dialog />
    </SafeAreaView>
  );
}

function MiniBlueStat({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <View style={{ flex: 1, minHeight: 58, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 10, justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <AppIcon name={icon} color="#FFFFFF" size={13} />
        <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', flex: 1 }}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 4 }}>{value}</Text>
    </View>
  );
}
