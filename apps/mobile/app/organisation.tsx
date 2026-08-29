import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Share, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, NoticeCard, Pill, Screen, Section, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { createPaymentIntent, getLiveConfig, getPaymentStatus, redeemAccessCode, registerDevice } from '../src/services/api';
import { getDeviceFingerprint, getDeviceInfo } from '../src/services/deviceService';
import { getAccessStatus, markFeatureUnlocked, PREMIUM_FEATURES } from '../src/services/unlockService';
import { useAppTheme } from '../src/appTheme';

type Provider = 'wave' | 'aps';
const STORE_BUILD = process.env.EXPO_PUBLIC_DISTRIBUTION_CHANNEL === 'store';

type OrgPricing = {
  tiers: Record<string, number>;
  custom_unit?: number;
  custom_min_seats?: number;
  custom_max_seats?: number;
};

function quote(seats: number, pricing: OrgPricing | null): number | null {
  if (!pricing || !Number.isInteger(seats) || seats < 1) return null;
  const tier = pricing.tiers?.[String(seats)];
  if (tier != null) return Number(tier);
  const unit = Number(pricing.custom_unit || 0);
  const min = Number(pricing.custom_min_seats || 2);
  if (unit > 0 && seats >= min) return unit * seats;
  return null;
}

export default function Organisation() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();

  // --- redeem ---
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState<{ seatsRemaining: number } | null>(null);

  async function redeem() {
    const trimmed = code.trim();
    if (trimmed.length < 6) {
      showDialog({ title: 'Enter your code', message: 'Type the organisation code exactly as it was given to you, including the dashes.', tone: 'warning', icon: 'warning' });
      return;
    }
    setRedeeming(true);
    try {
      const fp = await getDeviceFingerprint();
      await registerDevice(fp, getDeviceInfo()); // make sure the device exists + has a secret
      const result = await redeemAccessCode(fp, trimmed);
      await markFeatureUnlocked(PREMIUM_FEATURES.bulkUnlock, 'org-code');
      await getAccessStatus().catch(() => undefined);
      setRedeemed({ seatsRemaining: Number(result?.seatsRemaining ?? 0) });
    } catch (error: any) {
      showDialog({ title: 'Could not use this code', message: error?.message || 'Check the code and your internet connection, then try again.', tone: 'danger', icon: 'warning' });
    } finally {
      setRedeeming(false);
    }
  }

  if (redeemed) {
    return (
      <Screen scroll={false}>
        <BackHeader title="Organisation access" compact />
        <Card elevated style={{ alignItems: 'center', gap: 14, padding: 24, marginTop: 24 }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name="check" color={colors.success} size={42} />
          </View>
          <Pill text="ACCESS ACTIVE" tone="success" />
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>Full access unlocked</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>This device now has the full Contact Migration Pass through your organisation code.</Text>
          <Button title="Continue to Dashboard" icon="right" onPress={() => router.replace('/dashboard')} style={{ width: '100%', minHeight: 58 }} />
        </Card>
        <Dialog />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Organisation access" subtitle="Unlock full access with a code from your organisation." />

      <Section title="Enter organisation code">
        <Card style={{ gap: 12 }}>
          <Text style={styles.body}>Received a code from your employer or from OceanBrown? Enter it below to unlock the full Contact Migration Pass on this device.</Text>
          <TextInput
            accessibilityLabel="Organisation code"
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().slice(0, 20))}
            placeholder="GNM-XXXX-XXXX"
            placeholderTextColor={colors.softText}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, { letterSpacing: 2, fontWeight: '900', textAlign: 'center', minHeight: 58 }]}
          />
          <Button title={redeeming ? 'Checking…' : 'Redeem code'} icon="check" loading={redeeming} disabled={redeeming} onPress={redeem} />
          <Text style={styles.small}>Each code works on a limited number of devices. Ask your organisation if it has already been fully used.</Text>
        </Card>
      </Section>

      {!STORE_BUILD ? <BuySeats /> : (
        <View style={{ marginTop: 12 }}>
          <NoticeCard title="Buying seats" text="Organisation seats are purchased from the GNM website or the direct app. This store edition only redeems a code you already have." tone="blue" icon="info" />
        </View>
      )}
      <Dialog />
    </Screen>
  );
}

function BuySeats() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const [pricing, setPricing] = useState<OrgPricing | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState<Provider>('wave');
  const [seats, setSeats] = useState(10);
  const [customSeats, setCustomSeats] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [issuedCode, setIssuedCode] = useState('');
  const [polling, setPolling] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const attemptId = useRef('');

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    getLiveConfig().then((config) => {
      if (!active) return;
      setPricing((config.org_pricing as OrgPricing) || null);
      const approved = (['wave', 'aps'] as Provider[]).filter((p) => config[`${p}_payment_enabled`] === true);
      setProviders(approved);
      if (approved.length && !approved.includes(provider)) setProvider(approved[0]);
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const effectiveSeats = seats === -1 ? Math.floor(Number(customSeats)) || 0 : seats;
  const price = quote(effectiveSeats, pricing);
  const tierSeats = pricing ? Object.keys(pricing.tiers || {}).map(Number).filter((n) => n > 0).sort((a, b) => a - b) : [5, 10, 15];

  const checkStatus = useCallback(async () => {
    if (!reference) return;
    try {
      const fp = await getDeviceFingerprint();
      const status = await getPaymentStatus(reference, fp).catch(() => null);
      if (status?.issued_code) {
        setIssuedCode(String(status.issued_code));
        setPolling(false);
      }
    } catch { /* best effort */ }
  }, [reference]);

  useEffect(() => {
    if (!polling || !reference) return;
    let n = 0;
    let cancelled = false;
    setTimedOut(false);
    void checkStatus();
    const timer = setInterval(() => {
      n += 1;
      if (cancelled) { clearInterval(timer); return; }
      if (n > 40) { clearInterval(timer); setTimedOut(true); return; }
      void checkStatus();
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [polling, reference, checkStatus]);

  async function startPurchase() {
    if (!providers.includes(provider)) {
      showDialog({ title: 'Payment unavailable', message: 'Organisation purchases are not available yet. You can still redeem a code above.', tone: 'warning', icon: 'shield' });
      return;
    }
    if (!price || effectiveSeats < 1) {
      showDialog({ title: 'Choose a size', message: 'Pick 5, 10, 15, or enter a custom number of devices.', tone: 'warning', icon: 'warning' });
      return;
    }
    setBusy(true);
    try {
      const fp = await getDeviceFingerprint();
      await registerDevice(fp, getDeviceInfo());
      if (!attemptId.current) attemptId.current = `org_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      const intent = await createPaymentIntent({
        provider,
        deviceId: fp,
        featureKey: PREMIUM_FEATURES.bulkUnlock,
        amount: price,
        currency: 'GMD',
        idempotencyKey: attemptId.current,
        metadata: { kind: 'org', seats: effectiveSeats, source: 'mobile-org' },
      });
      setReference(intent.reference);
      if (intent.checkoutUrl) {
        try { await Linking.openURL(intent.checkoutUrl); }
        catch { showDialog({ title: 'Could not open checkout', message: 'Reopen this screen to try again — you have not been charged.', tone: 'danger', icon: 'warning' }); }
      }
      setPolling(true);
    } catch (error: any) {
      showDialog({ title: 'Could not start payment', message: error?.message || 'No payment was made. Please try again.', tone: 'danger', icon: 'warning' });
    } finally {
      setBusy(false);
    }
  }

  if (issuedCode) {
    return (
      <Section title="Your organisation code">
        <Card elevated style={{ gap: 12, alignItems: 'center', padding: 20 }}>
          <Pill text="PAYMENT CONFIRMED" tone="success" />
          <Text selectable style={{ color: colors.primary, fontSize: 26, fontWeight: '900', letterSpacing: 2, textAlign: 'center' }}>{issuedCode}</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>Share this code with up to {effectiveSeats} devices. Each person opens GNM → Settings → Organisation access → enters this code.</Text>
          <Text style={[styles.small, { textAlign: 'center', color: colors.primary, fontWeight: '800' }]}>Thank you for supporting a young Gambian team — your organisation is helping fund our next project.</Text>
          <Button title="Share code" variant="secondary" tone="blue" icon="document" onPress={() => Share.share({ message: `Your GNM organisation access code: ${issuedCode}\nOpen GNM → Settings → Organisation access → enter this code.` })} style={{ width: '100%' }} />
          <Button title="Back to Dashboard" icon="home" onPress={() => router.replace('/dashboard')} style={{ width: '100%' }} />
        </Card>
        <Dialog />
      </Section>
    );
  }

  if (polling) {
    return (
      <Section title="Waiting for confirmation">
        <Card elevated style={{ gap: 12, alignItems: 'center', padding: 20 }}>
          <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name="shield" color={colors.primary} size={36} />
          </View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center' }}>Approve the payment</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>Complete the D{price} payment in the page that opened. Your code appears here automatically once it is confirmed.</Text>
          {timedOut ? (
            <Text style={[styles.small, { textAlign: 'center', color: colors.warning }]}>Still not confirmed. If you have paid, tap “check now” again in a minute, or reopen this screen later — your code is kept against your payment reference.</Text>
          ) : null}
          <Button title="I have paid — check now" icon="refresh" onPress={checkStatus} style={{ width: '100%' }} />
          <Button title="Back to Dashboard" variant="secondary" icon="home" onPress={() => router.replace('/dashboard')} style={{ width: '100%' }} />
        </Card>
        <Dialog />
      </Section>
    );
  }

  return (
    <Section title="Buy organisation seats">
      <Card style={{ gap: 14 }}>
        <Text style={styles.body}>Pay once for several devices. You receive one code to share with your team.</Text>

        {loading ? <Text style={styles.small}>Loading pricing…</Text> : !pricing ? (
          <NoticeCard title="Pricing not published" text="Organisation pricing has not been set by the administrator yet." tone="warning" icon="warning" />
        ) : providers.length === 0 ? (
          <NoticeCard title="Payments not enabled yet" text="Wave and APS are not switched on yet. You can still redeem an existing code above." tone="blue" icon="info" />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {tierSeats.map((n) => (
                <SeatChip key={n} label={`${n} devices`} sub={quote(n, pricing) != null ? `D${quote(n, pricing)}` : ''} active={seats === n} onPress={() => setSeats(n)} />
              ))}
              <SeatChip label="Custom" sub={seats === -1 && price ? `D${price}` : ''} active={seats === -1} onPress={() => setSeats(-1)} />
            </View>

            {seats === -1 ? (
              <TextInput
                accessibilityLabel="Custom number of devices"
                value={customSeats}
                onChangeText={(v) => setCustomSeats(v.replace(/\D/g, '').slice(0, 4))}
                placeholder={`Number of devices (min ${pricing.custom_min_seats || 2})`}
                placeholderTextColor={colors.softText}
                keyboardType="number-pad"
                style={[styles.input, { minHeight: 52 }]}
              />
            ) : null}

            {providers.length > 1 ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {providers.map((p) => (
                  <TouchableOpacity key={p} onPress={() => setProvider(p)} accessibilityRole="radio" accessibilityState={{ checked: provider === p }}
                    style={{ flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: provider === p ? 2 : 1, borderColor: provider === p ? colors.primary : colors.border, backgroundColor: provider === p ? colors.primarySoft : colors.surface2 }}>
                    <Text style={{ color: colors.text, fontWeight: '900' }}>{p.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={[styles.rowBetween, { paddingTop: 4 }]}>
              <Text style={{ color: colors.muted, fontWeight: '800' }}>Total</Text>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20 }}>{price ? `D${price}` : '—'}</Text>
            </View>
            <Button title={busy ? 'Starting…' : price ? `Pay D${price} for ${effectiveSeats} devices` : 'Choose a size'} icon="right" loading={busy} disabled={busy || !price} onPress={startPurchase} />
            <Text style={styles.small}>You are the buyer. Access is granted by sharing the code, not to this device automatically.</Text>
            <Text style={[styles.small, { color: colors.primary, fontWeight: '800' }]}>OceanBrown is a young Gambian team. Your organisation's support helps fund the next tool we build for The Gambia.</Text>
          </>
        )}
      </Card>
      <Dialog />
    </Section>
  );
}

function SeatChip({ label, sub, active, onPress }: { label: string; sub?: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: active }}
      style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: active ? 2 : 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primarySoft : colors.surface2 }}>
      <Text style={{ color: colors.text, fontWeight: '900' }}>{label}</Text>
      {sub ? <Text style={{ color: colors.softText, fontWeight: '800', fontSize: 12 }}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}
