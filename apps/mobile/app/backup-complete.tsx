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
  const size = r.compact ? 128 : 156;

  return (
    <Screen>
      <BackHeader title="Backup Complete" subtitle="Your contacts were saved locally on this device." compact />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 18 : 44 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size * 0.56, height: size * 0.56, borderRadius: (size * 0.56) / 2, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name="backup" color={colors.white} size={44} />
          </View>
        </View>
        <Text style={[styles.largeTitle, { marginTop: 24, textAlign: 'center' }]}>Backup Complete!</Text>
        <Text style={[styles.body, { marginTop: 8, textAlign: 'center' }]}>A safe local copy of your contacts has been created before any migration work.</Text>
      </View>

      <Card elevated style={{ marginTop: 24 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 10 }}>Backup Summary</Text>
        <SummaryRow label="Contacts saved" value={total.toLocaleString()} color={colors.success} />
        <SummaryRow label="Storage" value="Local device only" color={colors.primary} />
        <SummaryRow label="Privacy" value="Not uploaded" color={colors.teal} />
        {backupId ? <SummaryRow label="Backup ID" value={`${backupId.slice(0, 18)}…`} color={colors.muted} /> : null}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 8 }}>What you can do now</Text>
        <Text style={styles.body}>Continue to preview changes, migrate selected contacts, or return to the backup list to restore this backup later.</Text>
      </Card>

      <Button title="Back to Dashboard" icon="home" onPress={() => router.replace('/dashboard')} style={{ marginTop: 18 }} />
      <Button title="Preview Changes" variant="secondary" icon="preview" onPress={() => router.replace({ pathname: '/preview', params: { filter: 'Needs Update' } })} style={{ marginTop: 8 }} />
      <Button title="View Backups" variant="secondary" icon="backup" onPress={() => router.replace('/backup')} style={{ marginTop: 8 }} />
    </Screen>
  );
}

function SummaryRow({ label, value, color }: { label: string; value: string | number; color: string }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.rowBetween, { paddingVertical: 10, gap: 12 }]}>
      <Text style={{ color: colors.muted, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      <Text numberOfLines={1} style={{ color, fontWeight: '900', fontSize: 16, flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
