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
  const ring = r.compact ? 170 : 210;
  return (
    <Screen>
      <BackHeader title="Scan Complete" />
      <View style={{ alignItems: 'center', paddingTop: r.compact ? 14 : 28 }}>
        <View style={{ width: ring, height: ring, borderRadius: ring / 2, backgroundColor: colors.primarySoft, borderWidth: 14, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: ring * 0.43, height: ring * 0.43, borderRadius: ring * 0.215, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="check" color={colors.white} size={44} /></View>
        </View>
        <Text style={[styles.largeTitle, { textAlign: 'center', marginTop: 24 }]}>Scan Complete!</Text>
        <Text style={[styles.body, { textAlign: 'center', marginTop: 8 }]}>Your contacts were analyzed locally and are ready for review.</Text>
      </View>
      <Card elevated style={{ marginTop: 26, alignItems: 'center' }}>
        <Text style={{ color: colors.primary, fontSize: 48, lineHeight: 56, fontWeight: '800' }}>{total}</Text>
        <Text style={styles.body}>Total Contacts Scanned</Text>
        <View style={styles.divider} />
        <View style={{ flexDirection: 'row', width: '100%', gap: 6, flexWrap: r.compact ? 'wrap' : 'nowrap' }}>
          <Result label="Will Update" value={pending} color={colors.primary} />
          <Result label="Already Updated" value={updated} color={colors.blue} />
          <Result label="Needs Review" value={review} color={colors.warning} />
          <Result label="No Change" value={noChange} color={colors.gold} />
        </View>
      </Card>
      <NoticeCard title="Ready to review" text="Your contacts were analyzed locally. Preview and approve every update before writing changes." tone="blue" />
      <Button title={pending ? 'Preview Changes' : 'View Scan Results'} icon="right" onPress={() => router.replace({ pathname: '/preview', params: { filter: pending ? 'Needs Update' : 'All' } })} />
      <Button title="Back to Dashboard" variant="ghost" onPress={() => router.replace('/dashboard')} style={{ marginTop: 8 }} />
    </Screen>
  );
}
function Result({ label, value, color }: { label: string; value: number; color: string }) { const { styles } = useAppTheme(); return <View style={{ flex: 1, minWidth: 70, alignItems: 'center' }}><Text style={{ color, fontSize: 22, fontWeight: '800' }}>{value}</Text><Text numberOfLines={2} style={[styles.small, { textAlign: 'center', marginTop: 4 }]}>{label}</Text></View>; }
