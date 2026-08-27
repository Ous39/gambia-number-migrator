import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, Screen } from '../src/components/UI';
import { useAppTheme, useResponsive } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

export default function Complete() {
  const { colors, styles } = useAppTheme();
  const r = useResponsive();
  const params = useLocalSearchParams();
  const total = Number(params.total || 0);
  const updated = Number(params.updated || 0);
  const copied = Number(params.copied || 0);
  const skipped = Number(params.skipped || 0);
  const failed = Number(params.failed || 0);
  const backupId = String(params.backupId || '');
  const failureSummary = String(params.failureSummary || '');
  const isCleanup = String(params.kind || '') === 'cleanup';
  const size = r.compact ? 72 : 88;
  return (
    <Screen scroll={false}>
      <BackHeader title={isCleanup ? 'Cleanup Complete' : 'Migration Complete'} subtitle={isCleanup ? 'Your verified duplicate cleanup summary.' : 'Your contact update summary.'} compact />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 10 : 16 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={failed ? 'warning' : 'check'} color={colors.success} size={34} />
        </View>
        <Text style={[styles.heading, { marginTop: 10, textAlign: 'center' }]}>{failed ? 'Completed with issues' : isCleanup ? 'Cleanup complete' : 'Migration complete'}</Text>
        <Text style={[styles.small, { marginTop: 4, textAlign: 'center' }]}>{failed ? 'Some contacts need attention.' : isCleanup ? 'Verified old duplicate numbers were removed.' : 'Selected numbers were updated.'}</Text>
      </View>
      <Card elevated style={{ marginTop: 14, padding: 14 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <SummaryTile label="Selected" value={total} color={colors.primary} soft={colors.primarySoft} />
          <SummaryTile label={isCleanup ? 'Removed' : 'Updated'} value={updated} color={colors.success} soft={colors.successSoft} />
          <SummaryTile label="Skipped" value={skipped} color={colors.warning} soft={colors.warningSoft} />
          <SummaryTile label="Failed" value={failed} color={colors.danger} soft={colors.dangerSoft} />
        </View>
        {backupId ? <Text numberOfLines={1} ellipsizeMode="middle" style={[styles.small, { marginTop: 10, textAlign: 'center' }]}>Backup: {backupId}</Text> : null}
      </Card>
      {failureSummary ? <Card style={{ marginTop: 10, borderColor: colors.danger, padding: 12 }}><Text style={{ color: colors.danger, fontWeight: '900' }}>Contacts needing attention</Text><Text numberOfLines={2} style={[styles.small, { marginTop: 6, lineHeight: 18 }]}>{failureSummary}</Text><Text style={[styles.small, { marginTop: 6, color: colors.primary }]}>Full details are available in History.</Text></Card> : null}
      {copied ? <Card style={{ marginTop: 10, borderColor: colors.primary, padding: 12 }}><Text style={{ color: colors.primary, fontWeight: '900' }}>{copied} restricted contact{copied === 1 ? '' : 's'} handled</Text><Text style={[styles.small, { marginTop: 4 }]}>Android protected the original SIM or app-owned record, so GNM created one controlled writable copy with the migrated number.</Text></Card> : null}
      <View style={{ flex: 1, minHeight: 8 }} />
      <Button title="Done" icon="right" onPress={() => router.replace('/dashboard')} style={{ marginTop: 10 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Button title="Backups" variant="secondary" icon="backup" onPress={() => router.replace('/backup')} style={{ flex: 1 }} />
        <Button title="History" variant="secondary" icon="history" onPress={() => router.replace('/history')} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}
function SummaryTile({ label, value, color, soft }: { label: string; value: number; color: string; soft: string }) { const { styles } = useAppTheme(); return <View style={{ width: '47%', flexGrow: 1, minWidth: 112, padding: 10, borderRadius: 14, backgroundColor: soft }}><Text style={{ color, fontSize: 22, lineHeight: 26, fontWeight: '900' }}>{value.toLocaleString()}</Text><Text style={[styles.small, { color, fontWeight: '800' }]}>{label}</Text></View>; }
