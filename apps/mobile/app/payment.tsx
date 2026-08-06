import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, NoticeCard, Pill, Screen, Section } from '../src/components/UI';
import { registerDevice, syncConfig } from '../src/services/api';
import { getDeviceFingerprint, getDeviceInfo } from '../src/services/deviceService';
import { getTone, radius, type Tone, useAppTheme } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';
import { getAccessStatus } from '../src/services/unlockService';

type Provider = 'wave' | 'aps';

const FALLBACK_AMOUNT = 100;
const providers: { key: Provider; title: string; subtitle: string; icon: string; tone: Tone; badge: string }[] = [
  { key: 'wave', title: 'Wave', subtitle: 'Fast mobile wallet checkout with phone number and OTP.', icon: 'phone', tone: 'blue', badge: 'Popular' },
  { key: 'aps', title: 'APS', subtitle: 'Secure local payment checkout with phone verification.', icon: 'card', tone: 'violet', badge: 'Gateway' },
];

export default function Payment() {
  if (process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'store') return <StorePaymentNotice />;
  return <DirectPayment />;
}

function StorePaymentNotice() {
  const { colors, styles } = useAppTheme();
  return (
    <Screen>
      <BackHeader title="Contact Migration Pass" subtitle="Secure purchase through your app store." compact />
      <Card elevated style={{ padding: 20, gap: 12 }}>
        <Pill text="STORE BILLING" tone="blue" />
        <Text style={{ color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: '900' }}>One purchase. Contact migration only.</Text>
        <Text style={styles.body}>The store version uses Apple In-App Purchase or Google Play Billing. Wave and APS are not shown for this digital unlock, protecting the app from store-policy rejection.</Text>
      </Card>
      <NoticeCard title="Store product required" text="Before release, create the non-consumable product contact_migration_pass in App Store Connect and Play Console, then complete server-side receipt validation. Purchasing remains safely disabled until those credentials are configured." tone="warning" icon="shield" />
      <Button title="Purchase setup pending" icon="shield" disabled style={{ minHeight: 58, marginTop: 20 }} />
    </Screen>
  );
}

function DirectPayment() {
  const { colors, styles } = useAppTheme();
  const [provider, setProvider] = useState<Provider>('wave');
  const [deviceId, setDeviceId] = useState('');
  const [amount, setAmount] = useState(FALLBACK_AMOUNT);
  const [priceLoading, setPriceLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const paymentTestMode = process.env.EXPO_PUBLIC_PAYMENT_TEST_MODE === 'true';
  const selected = useMemo(() => providers.find((p) => p.key === provider) || providers[0], [provider]);

  useEffect(() => {
    (async () => {
      try {
        const fp = await getDeviceFingerprint();
        setDeviceId(fp);
        await registerDevice(fp, getDeviceInfo()).catch(() => undefined);
        const [config, status] = await Promise.all([syncConfig(), getAccessStatus()]);
        setPaid(status.paid);
        const configuredPrice = Number(config.subscription_price);
        if (Number.isFinite(configuredPrice) && configuredPrice > 0) setAmount(configuredPrice);
      } finally { setPriceLoading(false); }
    })();
  }, []);

  if (!priceLoading && paid) {
    return <Screen><BackHeader title="Contact Migration Pass" subtitle="Access status on this device." compact /><Card elevated style={{ alignItems: 'center', gap: 14, padding: 24 }}><View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="check" color={colors.success} size={42} /></View><Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' }}>Already unlocked</Text><Text style={[styles.body, { textAlign: 'center' }]}>Your payment is confirmed. Unlimited migration and premium backup tools are active on this device.</Text><Button title="Scan My Contacts" icon="right" onPress={() => router.replace('/dashboard')} style={{ width: '100%', minHeight: 58 }} /></Card></Screen>;
  }

  function continueToCheckout() {
    router.push({ pathname: '/payment-checkout', params: { provider: selected.key, amount: String(amount) } });
  }

  return (
    <Screen>
      <BackHeader title="Payment" subtitle="Choose a payment method and continue securely." compact />

      <View style={{ borderRadius: 34, overflow: 'hidden', backgroundColor: colors.brandTop, marginBottom: 20, borderWidth: 1, borderColor: colors.isDark ? colors.border : 'rgba(20,86,240,0.18)' }}>
        <View style={{ position: 'absolute', right: -76, top: -82, width: 210, height: 210, borderRadius: 105, backgroundColor: colors.brandBubble }} />
        <View style={{ position: 'absolute', left: -40, bottom: -54, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(40,208,232,0.16)' }} />
        <View style={{ padding: 22 }}>
          <View style={[styles.rowBetween, { gap: 12, alignItems: 'flex-start' }]}> 
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontWeight: '900', letterSpacing: 1.2, fontSize: 12 }}>ONE-TIME SECURE PAYMENT</Text>
              <Text style={{ color: colors.white, fontSize: 33, lineHeight: 39, fontWeight: '900', marginTop: 8, letterSpacing: -0.8 }}>Unlock contact migration</Text>
              <Text style={{ color: 'rgba(255,255,255,0.80)', fontWeight: '700', lineHeight: 21, marginTop: 8 }}>Choose Wave or APS, enter your payment phone number, then confirm the 4-digit code.</Text>
            </View>
            <View style={{ width: 62, height: 62, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name="shield" color={colors.white} size={27} />
            </View>
          </View>
          <View style={{ marginTop: 18, flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            <WhitePill text="One-time contact migration fee" />
            <WhitePill text="Phone + OTP" />
            <WhitePill text="Contacts stay local" />
          </View>
        </View>
      </View>

      <Card elevated style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <View style={{ padding: 18, backgroundColor: colors.primarySoft, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <View style={[styles.rowBetween, { gap: 14 }]}> 
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900' }}>Contact Migration Pass</Text>
              <Text style={[styles.body, { marginTop: 5 }]}>Backup, preview, bulk update, replace mode, cleanup duplicates and restore old migration backups.</Text>
            </View>
            <View style={{ alignItems: 'flex-end', minWidth: 84 }}>
              <Text style={{ color: colors.primary, fontSize: 34, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8 }}>{priceLoading ? '…' : `D${amount}`}</Text>
              <Text style={styles.small}>admin price</Text>
            </View>
          </View>
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <FeatureRow text="Scan and preview contacts before making changes" />
          <FeatureRow text="A payment unlock is applied only after server confirmation" />
          <FeatureRow text="Create backups, migrate eligible numbers, and restore when needed" />
          <FeatureRow text="Contacts remain private and stay on this device" />
        </View>
      </Card>

      <NoticeCard title="What this purchase covers" text="This pass unlocks contact scanning, backup, preview, migration, duplicate cleanup and restore only. Future services—such as eSIMs, airtime or other products—are not included and may have separate prices." tone="warning" icon="info" />

      <Section title="Choose payment platform" style={{ marginTop: 0 }}>
        <View style={{ gap: 12 }}>
          {providers.map((p) => {
            const active = provider === p.key;
            const t = getTone(colors, p.tone);
            return (
              <TouchableOpacity
                key={p.key}
                activeOpacity={0.86}
                onPress={() => setProvider(p.key)}
                style={{
                  borderRadius: 28,
                  padding: 15,
                  backgroundColor: active ? t.bg : colors.card,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? t.border : colors.line,
                  shadowColor: colors.shadow,
                  shadowOpacity: active ? (colors.isDark ? 0.24 : 0.11) : (colors.isDark ? 0.12 : 0.05),
                  shadowRadius: active ? 22 : 12,
                  shadowOffset: { width: 0, height: 10 },
                  elevation: active ? 5 : 2,
                }}
              >
                <View style={[styles.row, { gap: 13 }]}> 
                  <View style={{ width: 58, height: 58, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.card : t.bg, borderColor: t.border, borderWidth: 1 }}>
                    <AppIcon name={p.icon} color={t.fg} size={25} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}> 
                      <Text style={{ color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '900' }}>{p.title}</Text>
                      <Pill text={p.badge} tone={p.tone} />
                    </View>
                    <Text style={[styles.body, { marginTop: 4 }]}>{p.subtitle}</Text>
                  </View>
                  <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: active ? t.fg : colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? t.fg : 'transparent' }}>
                    {active ? <AppIcon name="check" color={colors.white} size={18} /> : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Section>

      <Section title="Checkout summary">
        <Card style={{ gap: 10 }}>
          <SummaryRow label="Selected provider" value={selected.title} />
          <SummaryRow label="Amount" value={priceLoading ? 'Loading current price…' : `D${amount}`} />
          <SummaryRow label="Phone validation" value="7 or 9 digits only" />
          <SummaryRow label="Device reference" value={deviceId ? `${deviceId.slice(0, 14)}…` : 'Loading'} />
        </Card>
      </Section>

      <NoticeCard
        title={paymentTestMode ? 'Test payment mode' : 'Secure payment'}
        text={paymentTestMode ? 'No real charge will be made. The checkout will provide a development OTP for verification.' : 'GNM never stores your wallet PIN or OTP. Payment confirmation is verified securely before this device is unlocked.'}
        tone={paymentTestMode ? 'warning' : 'blue'}
        icon="shield"
      />

      <View style={{ marginTop: 20, marginBottom: 8, backgroundColor: colors.card, borderRadius: 28, borderWidth: 1, borderColor: colors.line, padding: 14, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.20 : 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 3 }}>
        <View style={[styles.rowBetween, { gap: 12, marginBottom: 12 }]}> 
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.label}>Ready to continue</Text>
            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17, marginTop: 2 }}>{selected.title} · {priceLoading ? 'Loading price…' : `D${amount}`}</Text>
          </View>
          <View style={{ width: 46, height: 46, borderRadius: 18, backgroundColor: getTone(colors, selected.tone).bg, borderWidth: 1, borderColor: getTone(colors, selected.tone).border, alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name={selected.icon} color={getTone(colors, selected.tone).fg} size={20} />
          </View>
        </View>
        <Button title={priceLoading ? 'Loading current price…' : `Continue with ${selected.title}`} icon="right" disabled={priceLoading} onPress={continueToCheckout} style={{ minHeight: 58, borderRadius: radius.lg }} />
      </View>
    </Screen>
  );
}

function WhitePill({ text }: { text: string }) {
  return <Text style={{ color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, overflow: 'hidden', fontWeight: '900', fontSize: 12 }}>{text}</Text>;
}

function FeatureRow({ text }: { text: string }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.row, { gap: 10 }]}> 
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
        <AppIcon name="check" color={colors.success} size={14} />
      </View>
      <Text style={{ color: colors.text, fontWeight: '800', flex: 1, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { colors, styles } = useAppTheme();
  return <View style={[styles.rowBetween, { gap: 12, paddingVertical: 4 }]}><Text style={{ color: colors.muted, fontWeight: '800' }}>{label}</Text><Text numberOfLines={1} style={{ color: colors.text, fontWeight: '900', flexShrink: 1, textAlign: 'right' }}>{value}</Text></View>;
}
