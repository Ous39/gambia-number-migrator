import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, Screen } from '../src/components/UI';
import { useAppTheme, useResponsive } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

export default function BackupComplete() {
  const { colors, styles } = useAppTheme();
  const r = useResponsive();
  const params = useLocalSearchParams();
  const total = Number(params.total || 0);
  const backupId = String(params.backupId || '');
  const size = r.compact ? 70 : 84;

  return (
    <Screen scroll={false}>
      <BackHeader title="Backup Complete" subtitle="Your contacts were saved locally on this device." compact />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 10 : 16 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name="backup" color={colors.success} size={32} />
        </View>
        <Text style={[styles.heading, { marginTop: 10, textAlign: 'center' }]}>Backup complete</Text>
        <Text style={[styles.small, { marginTop: 4, textAlign: 'center' }]}>Saved privately on this device.</Text>
      </View>

      <Card elevated style={{ marginTop: 14, padding: 14 }}>
        <SummaryRow label="Contacts saved" value={total.toLocaleString()} color={colors.success} />
        <SummaryRow label="Storage" value="Local device only" color={colors.primary} />
        <SummaryRow label="Privacy" value="Not uploaded" color={colors.teal} />
        {backupId ? <SummaryRow label="Backup ID" value={`${backupId.slice(0, 18)}…`} color={colors.muted} /> : null}
      </Card>

      <View style={{ flex: 1, minHeight: 10 }} />
      <Button title="Preview Changes" icon="preview" onPress={() => router.replace({ pathname: '/preview', params: { filter: 'Needs Update' } })} style={{ marginTop: 10 }} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
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
