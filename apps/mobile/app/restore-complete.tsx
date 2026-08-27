import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, Screen } from '../src/components/UI';
import { useAppTheme, useResponsive } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

export default function RestoreComplete() {
  const { colors, styles } = useAppTheme();
  const r = useResponsive();
  const params = useLocalSearchParams();
  const restored = Number(params.restored || 0);
  const skipped = Number(params.skipped || 0);
  const failed = Number(params.failed || 0);
  const backupId = String(params.backupId || '');
  const size = r.compact ? 70 : 84;
  const hasFailures = failed > 0;

  return (
    <Screen scroll={false}>
      <BackHeader title="Restore Complete" subtitle="Contact numbers were restored from your local backup." compact />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 10 : 16 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: hasFailures ? colors.warningSoft : colors.successSoft, borderColor: hasFailures ? colors.warning : colors.success, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={hasFailures ? 'warning' : 'update'} color={hasFailures ? colors.warning : colors.success} size={32} />
        </View>
        <Text style={[styles.heading, { marginTop: 10, textAlign: 'center' }]}>{hasFailures ? 'Restore finished with some failures' : 'Restore complete'}</Text>
        <Text style={[styles.small, { marginTop: 4, textAlign: 'center' }]}>{hasFailures ? 'Some contacts could not be restored. See History for reasons.' : 'Numbers were restored on this device only.'}</Text>
      </View>

      <Card elevated style={{ marginTop: 14, padding: 14 }}>
        <SummaryRow label="Restored" value={restored.toLocaleString()} color={colors.success} />
        <SummaryRow label="Skipped (already correct)" value={skipped.toLocaleString()} color={colors.muted} />
        <SummaryRow label="Failed" value={failed.toLocaleString()} color={failed ? colors.danger : colors.muted} />
        <SummaryRow label="Privacy" value="Not uploaded" color={colors.teal} />
        {backupId ? <SummaryRow label="Backup ID" value={`${backupId.slice(0, 18)}…`} color={colors.muted} /> : null}
      </Card>

      <View style={{ flex: 1, minHeight: 10 }} />
      {hasFailures ? <Button title="View History for Details" icon="check" onPress={() => router.replace('/history')} style={{ marginTop: 10 }} /> : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: hasFailures ? 8 : 10 }}>
        <Button title="Dashboard" variant="secondary" icon="home" onPress={() => router.replace('/dashboard')} style={{ flex: 1 }} />
        <Button title="Backups" variant="secondary" icon="backup" onPress={() => router.replace('/backup')} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.rowBetween, { paddingVertical: 7, gap: 12 }]}>
      <Text style={{ color: colors.muted, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      <Text numberOfLines={1} style={{ color, fontWeight: '900', fontSize: 16, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
