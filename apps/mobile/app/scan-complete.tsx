import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, NoticeCard, Screen } from '../src/components/UI';
import { useAppTheme, useResponsive } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

export default function ScanComplete() {
  const { colors, styles } = useAppTheme();
  const r = useResponsive();
  const params = useLocalSearchParams();
  const total = Number(params.total || 0);
  const pending = Number(params.pending || 0);
  const updated = Number(params.updated || 0);
  const review = Number(params.review || 0);
  const noChange = Number(params.unchanged || 0);
  const ring = r.compact ? 112 : 148;
  return (
    <Screen scroll={false}>
      <BackHeader title="Scan Complete" compact />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 8 : 14 }}>
        <View style={{ width: ring, height: ring, borderRadius: ring / 2, backgroundColor: colors.primarySoft, borderWidth: 10, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: ring * 0.43, height: ring * 0.43, borderRadius: ring * 0.215, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="check" color={colors.white} size={44} /></View>
        </View>
        <Text style={[styles.heading, { textAlign: 'center', marginTop: 10 }]}>Scan complete</Text>
        <Text style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>Your contacts were analyzed locally and are ready for review.</Text>
      </View>
      <Card elevated style={{ marginTop: 12, padding: 12, alignItems: 'center' }}>
        <Text style={{ color: colors.primary, fontSize: 34, lineHeight: 40, fontWeight: '900' }}>{total}</Text>
        <Text style={styles.body}>Total Contacts Scanned</Text>
        <View style={styles.divider} />
        <View style={{ flexDirection: 'row', width: '100%', gap: 6, flexWrap: r.compact ? 'wrap' : 'nowrap' }}>
          <Result label="Will Update" value={pending} color={colors.primary} />
          <Result label="Already Updated" value={updated} color={colors.blue} />
          <Result label="Needs Review" value={review} color={colors.warning} />
          <Result label="No Change" value={noChange} color={colors.gold} />
        </View>
      </Card>
      <View style={{ marginTop: 10 }}><NoticeCard title="Ready to review" text="Preview and approve every update before writing changes." tone="blue" /></View>
      <View style={{ flex: 1, minHeight: 8 }} />
      <Button title={pending ? 'Preview Changes' : 'View Scan Results'} icon="right" onPress={() => router.replace({ pathname: '/preview', params: { filter: pending ? 'Needs Update' : 'All' } })} />
      <Button title="Back to Dashboard" variant="ghost" onPress={() => router.replace('/dashboard')} style={{ marginTop: 8 }} />
    </Screen>
  );
}
function Result({ label, value, color }: { label: string; value: number; color: string }) { const { styles } = useAppTheme(); return <View style={{ flex: 1, minWidth: 70, alignItems: 'center' }}><Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text><Text numberOfLines={2} style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>{label}</Text></View>; }
