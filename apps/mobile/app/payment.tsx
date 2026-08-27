import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, NoticeCard, Pill, Screen } from '../src/components/UI';
import { useAppTheme } from '../src/appTheme';
import { getAccessStatus, type AccessStatus } from '../src/services/unlockService';
import PaymentCheckout from './payment-checkout';

export default function Payment() {
  if (process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL !== 'store') return <PaymentCheckout />;
  return <StoreFreeLaunchAccess />;
}

function StoreFreeLaunchAccess() {
  const { colors, styles } = useAppTheme();
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setAccess(await getAccessStatus()); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const active = access?.status === 'active';

  return (
    <Screen>
      <BackHeader title="Free launch access" subtitle="GNM is free during the launch campaign." compact />
      <Card elevated style={{ padding: 22, gap: 14, marginTop: 16, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 105, backgroundColor: colors.primarySoft }} />
        <Pill text="FREE LAUNCH" tone="success" />
        <Text style={{ color: colors.text, fontSize: 29, lineHeight: 35, fontWeight: '900' }}>Full migration access. No payment required.</Text>
        <Text style={styles.body}>During the launch campaign, GNM provides backup, preview, migration, duplicate cleanup and restore at no charge.</Text>
      </Card>

      {active ? (
        <NoticeCard title="Access active" text="This device has full launch access. You can continue to scan and migrate eligible contacts." tone="success" icon="check" />
      ) : (
        <NoticeCard
          title={loading ? 'Checking access' : 'Connect to activate'}
          text={loading ? 'GNM is confirming your free launch access.' : 'Connect to the internet and refresh so GNM can activate free launch access on this device.'}
          tone="blue"
          icon="shield"
        />
      )}

      <Button
        title={active ? 'Continue to Dashboard' : loading ? 'Checking Access…' : 'Refresh Free Access'}
        icon={active ? 'right' : 'refresh'}
        loading={loading}
        disabled={loading}
        onPress={active ? () => router.replace('/dashboard') : refresh}
        style={{ minHeight: 58, marginTop: 20 }}
      />
      <Text style={[styles.small, { textAlign: 'center', marginTop: 14 }]}>Wave and APS are not used inside the App Store or Google Play edition.</Text>
    </Screen>
  );
}
