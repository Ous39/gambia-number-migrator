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
  const skipped = Number(params.skipped || 0);
  const failed = Number(params.failed || 0);
  const backupId = String(params.backupId || '');
  const size = r.compact ? 132 : 160;
  return (
    <Screen>
      <BackHeader title="Migration Complete" subtitle="Summary of the contacts updated on this device." />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 20 : 38 }}>
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size * 0.56, height: size * 0.56, borderRadius: (size * 0.56) / 2, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="check" color={colors.white} size={46} /></View>
        </View>
        <Text style={[styles.largeTitle, { marginTop: 24, textAlign: 'center' }]}>{failed ? 'Migration Completed with Issues' : 'Migration Complete!'}</Text>
        <Text style={[styles.body, { marginTop: 8, textAlign: 'center' }]}>{failed ? 'Some selected numbers could not be updated. Review the summary and try those contacts again.' : 'The selected contact numbers were processed successfully.'}</Text>
      </View>
      <Card elevated style={{ marginTop: 24, padding: 16 }}>
        <Text style={{ color: colors.text, fontSize: 19, fontWeight: '900' }}>Migration summary</Text>
        <Text style={[styles.small, { marginTop: 3, marginBottom: 14 }]}>A clear result for the contacts you selected.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <SummaryTile label="Selected" value={total} color={colors.primary} soft={colors.primarySoft} />
          <SummaryTile label="Updated" value={updated} color={colors.success} soft={colors.successSoft} />
          <SummaryTile label="Skipped" value={skipped} color={colors.warning} soft={colors.warningSoft} />
          <SummaryTile label="Failed" value={failed} color={colors.danger} soft={colors.dangerSoft} />
        </View>
        {backupId ? <View style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line }}><Text style={styles.small}>Backup created</Text><Text numberOfLines={1} ellipsizeMode="middle" style={{ color: colors.text, fontWeight: '800', marginTop: 3 }}>{backupId}</Text></View> : null}
      </Card>
      <Card style={{ marginTop: 14 }}>
        <Text style={{ color: colors.text, fontWeight: '900', marginBottom: 6 }}>Your contacts are protected</Text>
        <Text style={styles.body}>GNM used the verified rules saved on this device. A local safety backup was created before any contact was changed.</Text>
      </Card>
      <Button title="Back to Dashboard" icon="right" onPress={() => router.replace('/dashboard')} style={{ marginTop: 18 }} />
      <Button title="View Backups" variant="secondary" icon="backup" onPress={() => router.replace('/backup')} style={{ marginTop: 8 }} />
      <Button title="View History" variant="secondary" icon="history" onPress={() => router.replace('/history')} style={{ marginTop: 8 }} />
    </Screen>
  );
}
function SummaryTile({ label, value, color, soft }: { label: string; value: number; color: string; soft: string }) { const { styles } = useAppTheme(); return <View style={{ width: '48%', flexGrow: 1, minWidth: 125, padding: 14, borderRadius: 18, backgroundColor: soft }}><Text style={{ color, fontSize: 27, lineHeight: 32, fontWeight: '900' }}>{value.toLocaleString()}</Text><Text style={[styles.small, { color, marginTop: 2, fontWeight: '800' }]}>{label}</Text></View>; }
