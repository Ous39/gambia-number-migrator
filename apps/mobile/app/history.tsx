import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, EmptyState, FilterChip, ListScreen, Pill, ProgressBar } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { getJson, keys } from '../src/services/storage';
import { type Tone, useAppTheme } from '../src/appTheme';

function toneFor(status?: string): Tone {
  return status === 'failed' ? 'danger' : status === 'partial' ? 'warning' : 'success';
}

function titleFor(type?: string) {
  const map: Record<string, string> = {
    scan: 'Contact scan',
    duplicate_add: 'Added new numbers',
    replace_update: 'Replaced old numbers',
    duplicate_cleanup: 'Removed old duplicates',
    manual_full_backup: 'Manual backup',
    restore: 'Backup restore',
  };
  return map[String(type || '')] || String(type || 'Activity').replace(/_/g, ' ');
}

function categoryFor(item: any): 'All' | 'Migrations' | 'Backups' | 'Cleanup' | 'Restores' | 'Scans' {
  const type = String(item.operationType || '');
  if (type === 'scan') return 'Scans';
  if (type.includes('backup')) return 'Backups';
  if (type.includes('restore')) return 'Restores';
  if (type.includes('cleanup')) return 'Cleanup';
  return 'Migrations';
}

function formatDate(value?: string) {
  if (!value) return 'Unknown date';
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

function countNumber(item: any, key: string) {
  return Number(item?.[key] || 0);
}

export default function History() {
  const { colors, styles } = useAppTheme();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<'All' | 'Migrations' | 'Backups' | 'Cleanup' | 'Restores' | 'Scans'>('All');

  async function load() {
    const list = await getJson<any[]>(keys.history, []);
    setItems(Array.isArray(list) ? list : []);
  }

  useEffect(() => { load().catch(() => undefined); }, []);

  const counts = useMemo(() => {
    const base: Record<string, number> = { All: items.length, Migrations: 0, Backups: 0, Cleanup: 0, Restores: 0, Scans: 0 };
    items.forEach((item) => { const cat = categoryFor(item); base[cat] = (base[cat] || 0) + 1; });
    return base;
  }, [items]);

  const filtered = useMemo(() => filter === 'All' ? items : items.filter((item) => categoryFor(item) === filter), [items, filter]);

  const totals = useMemo(() => items.reduce((acc, item) => {
    acc.scanned += countNumber(item, 'numberScanned');
    acc.updated += countNumber(item, 'numberAdded') + countNumber(item, 'numberReplaced');
    acc.copied += countNumber(item, 'numberCopied');
    acc.removed += countNumber(item, 'numberRemoved');
    acc.restored += countNumber(item, 'numberRestored');
    acc.failed += countNumber(item, 'numberFailed');
    return acc;
  }, { scanned: 0, updated: 0, copied: 0, removed: 0, restored: 0, failed: 0 }), [items]);

  const successCount = items.filter((item) => item.status === 'success').length;
  const successPercent = items.length ? Math.round((successCount / items.length) * 100) : 0;

  const header = (
    <>
      <Card elevated style={{ marginBottom: 14, overflow: 'hidden', backgroundColor: colors.brandTop, borderColor: colors.brandMid }}>
        <View style={{ position: 'absolute', right: -66, top: -74, width: 190, height: 190, borderRadius: 95, backgroundColor: colors.brandBubble }} />
        <View style={[styles.rowBetween, { gap: 12 }]}> 
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontWeight: '900', letterSpacing: 1.1, fontSize: 12 }}>LOCAL ACTIVITY</Text>
            <Text style={{ color: colors.white, fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: 5 }}>{items.length.toLocaleString()}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontWeight: '700' }}>saved scan, backup, migration and restore records</Text>
          </View>
          <View style={{ width: 62, height: 62, borderRadius: 22, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name="history" color={colors.primary} size={28} />
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <StatBox label="Updated" value={totals.updated} tone="success" />
        <StatBox label="Removed" value={totals.removed} tone="warning" />
        <StatBox label="Restored" value={totals.restored} tone="blue" />
      </View>

      <Card style={{ marginBottom: 14, gap: 10 }}>
        <View style={styles.rowBetween}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Success rate</Text>
          <Text style={{ color: colors.primary, fontWeight: '900' }}>{successPercent}%</Text>
        </View>
        <ProgressBar percent={successPercent} />
        <Text style={styles.small}>{totals.failed.toLocaleString()} failed · {totals.copied.toLocaleString()} restricted contacts safely copied. Contact details are not uploaded.</Text>
      </Card>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 14 }}>
        {(['All', 'Migrations', 'Backups', 'Cleanup', 'Restores', 'Scans'] as const).map((g) => (
          <FilterChip key={g} title={g} count={counts[g] || 0} active={filter === g} tone={g === 'Cleanup' ? 'warning' : g === 'Backups' ? 'teal' : g === 'Restores' ? 'blue' : g === 'Scans' ? 'violet' : 'primary'} onPress={() => setFilter(g)} />
        ))}
      </ScrollView>
    </>
  );

  return (
    <ListScreen
      data={filtered}
      keyExtractor={(item, index) => item.id || `${item.date}-${index}`}
      topHeader={<BackHeader title="History" subtitle="Scans, backups, migrations, cleanup and restores." compact />}
      header={items.length ? header : undefined}
      empty={<EmptyState icon="history" title={filter === 'All' ? 'No history yet' : `No ${filter.toLowerCase()} yet`} text="Your scan, backup, migration and cleanup records will appear here." action={<Button title="Start Scan" icon="scan" variant="secondary" onPress={() => router.replace('/dashboard')} />} />}
      renderItem={({ item }) => <HistoryCard item={item} />}
    />
  );
}

function StatBox({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const { colors, styles, tone: toneGetter } = useAppTheme();
  const t = toneGetter(tone);
  return (
    <View style={[styles.card, { flex: 1, padding: 12, borderColor: t.border, backgroundColor: t.bg }]}> 
      <Text style={{ color: t.fg, fontSize: 21, fontWeight: '900' }}>{value.toLocaleString()}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

function HistoryCard({ item }: { item: any }) {
  const { colors, styles } = useAppTheme();
  const type = String(item.operationType || 'activity');
  const statusTone = toneFor(item.status);
  const updated = countNumber(item, 'numberAdded') + countNumber(item, 'numberReplaced');
  const scanned = countNumber(item, 'numberScanned');
  const removed = countNumber(item, 'numberRemoved');
  const restored = countNumber(item, 'numberRestored');
  const skipped = countNumber(item, 'numberSkipped');
  const failed = countNumber(item, 'numberFailed');
  const icon = type.includes('backup') ? 'backup' : type.includes('restore') ? 'update' : type.includes('cleanup') ? 'cleanup' : type === 'scan' ? 'scan' : 'check';
  const mainValue = updated || removed || restored || scanned || 0;
  const mainLabel = updated ? 'updated' : removed ? 'removed' : restored ? 'restored' : scanned ? 'scanned' : 'items';

  return (
    <Card style={{ marginBottom: 10 }} pressable onPress={() => undefined}>
      <View style={[styles.row, { gap: 12, alignItems: 'flex-start' }]}> 
        <View style={{ width: 46, height: 46, borderRadius: 17, backgroundColor: colors.primarySoft, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={icon} color={colors.primary} size={21} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={[styles.rowBetween, { gap: 8 }]}> 
            <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontWeight: '900', fontSize: 16 }}>{titleFor(type)}</Text>
            <Pill text={item.status || 'saved'} tone={statusTone} />
          </View>
          <Text style={[styles.small, { marginTop: 3 }]}>{formatDate(item.date)}</Text>
          <View style={styles.divider} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <MiniStat label={mainLabel} value={mainValue} tone={statusTone} />
            <MiniStat label="skipped" value={skipped} tone="muted" />
            <MiniStat label="failed" value={failed} tone={failed ? 'danger' : 'muted'} />
          </View>
          {item.backupId ? <Text numberOfLines={1} style={[styles.small, { marginTop: 10 }]}>Backup: {String(item.backupId)}</Text> : null}
        </View>
      </View>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const { colors, tone: toneGetter } = useAppTheme();
  const t = toneGetter(tone);
  return (
    <View style={{ flex: 1, minHeight: 54, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, justifyContent: 'center' }}>
      <Text style={{ color: t.fg, fontSize: 16, fontWeight: '900' }}>{value.toLocaleString()}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}
