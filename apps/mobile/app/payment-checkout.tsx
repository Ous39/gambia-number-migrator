import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Linking, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Button } from '../src/components/Button';
import { BackHeader, Card, NoticeCard, Pill, Screen, Section, useAppDialog } from '../src/components/UI';
import { createPaymentIntent, getLiveConfig, getPaymentStatus } from '../src/services/api';
import { getDeviceFingerprint } from '../src/services/deviceService';
import { getAccessStatus, markFeatureUnlocked, PREMIUM_FEATURES, type AccessStatus } from '../src/services/unlockService';
import { getTone, radius, type Tone, useAppTheme } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

type Provider = 'wave' | 'aps';
// 'processing' = the provider's hosted page is open in the system browser and we
// are polling our own backend for a provider-confirmed unlock. The same flow
// runs in test mode against a local simulator page. GNM never sees a PIN or OTP.
type Step = 'phone' | 'processing' | 'success';

const providerMeta: Record<Provider, { title: string; tone: Tone; icon: string; help: string; note: string }> = {
  wave: {
    title: 'Wave',
    tone: 'blue',
    icon: 'phone',
    help: 'Enter the Wave phone number that will approve this payment.',
    note: 'Wave checkout · phone verification',
  },
  aps: {
    title: 'APS',
    tone: 'violet',
    icon: 'card',
    help: 'Enter the APS phone number that will approve this payment.',
    note: 'APS gateway checkout',
  },
};

function cleanPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00220')) digits = digits.slice(5);
  else if (digits.startsWith('220') && (digits.length === 10 || digits.length === 12)) digits = digits.slice(3);
  return digits.slice(0, 9);
}

function validPhone(value: string) {
  return value.length === 7 || value.length === 9;
}

function phoneValidationMessage(value: string) {
  if (!value.length) return 'Enter exactly 7 digits or exactly 9 digits.';
  if (validPhone(value)) return value.length === 7 ? 'Valid old 7-digit number.' : 'Valid migrated 9-digit number.';
  if (value.length < 7) return `${7 - value.length} more digit${7 - value.length === 1 ? '' : 's'} needed for a 7-digit number.`;
  if (value.length === 8) return 'Use 7 digits or 9 digits. Add 1 digit or remove 1 digit.';
  return 'Phone number must be exactly 7 or 9 digits.';
}

export default function PaymentCheckout() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const params = useLocalSearchParams<{ provider?: string; amount?: string }>();
  const [provider, setProvider] = useState<Provider>(params.provider === 'aps' ? 'aps' : 'wave');
  const [amount, setAmount] = useState(Number(params.amount) || 25);
  const [approvedProviders, setApprovedProviders] = useState<Provider[]>([]);
  const [access, setAccess] = useState<AccessStatus | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const meta = providerMeta[provider];
  const tone = getTone(colors, meta.tone);
  const [phone, setPhone] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const paymentAttemptId = useRef('');
  const canPay = validPhone(phone);

  function handlePhoneChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '');
    const next = cleanPhone(value);
    setPhone(next);
    if ((digitsOnly.startsWith('220') || digitsOnly.startsWith('00220')) && next !== digitsOnly) setInputNote('Gambia country code detected. We kept the local number.');
    else if (digitsOnly.length > 9) setInputNote('Only 7 or 9 local digits are accepted. Extra digits were removed.');
    else setInputNote('');
  }

  useEffect(() => {
    setStep('phone');
  }, [provider]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setPriceLoading(true);
    Promise.all([getLiveConfig(), getAccessStatus()]).then(([config, status]) => {
      if (!active) return;
      const current = Number(config.subscription_price);
      if (Number.isFinite(current) && current > 0) setAmount(current);
      const approved = (['wave', 'aps'] as Provider[]).filter((item) => config[`${item}_payment_enabled`] === true);
      setApprovedProviders(approved);
      if (approved.length && !approved.includes(provider)) setProvider(approved[0]);
      setAccess(status);
    }).catch((error) => {
      if (active) showDialog({ title: 'Could not load live price', message: error?.message || 'Connect to the internet and try again. Payment is disabled until the current price is confirmed.', tone: 'warning', icon: 'warning' });
    }).finally(() => { if (active) setPriceLoading(false); });
    return () => { active = false; };
  }, []));

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  async function startPayment() {
    if (priceLoading) return;
    if (!approvedProviders.includes(provider)) {
      showDialog({ title: 'Payment option unavailable', message: 'This wallet has not been enabled by GNM. Choose an approved payment option or try again later.', tone: 'warning', icon: 'shield' });
      return;
    }
    const latest = await getAccessStatus();
    if (latest.status === 'active') { setAccess(latest); return; }
    if (!canPay) {
      showDialog({ title: 'Invalid phone number', message: 'Enter exactly 7 digits or exactly 9 digits. More than 9 digits is not allowed.', tone: 'warning', icon: 'warning' });
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    try {
      const fp = await getDeviceFingerprint();
      if (!paymentAttemptId.current) paymentAttemptId.current = `mobile_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
      const intent = await createPaymentIntent({ provider, deviceId: fp, featureKey: PREMIUM_FEATURES.bulkUnlock, amount, currency: 'GMD', customerPhone: phone, idempotencyKey: paymentAttemptId.current, metadata: { source: 'mobile-checkout' } });
      setReference(intent.reference);
      // Open the provider-hosted checkout page in the SYSTEM browser (never an
      // embedded WebView) and poll our own backend for the confirmed result.
      // In test mode the URL is a local simulator page; the flow is identical.
      // Access is never granted from the redirect alone.
      if (intent.checkoutUrl) {
        try { await Linking.openURL(intent.checkoutUrl); }
        catch { showDialog({ title: `Could not open ${meta.title}`, message: `We could not open ${meta.title}. Reopen this screen to try again — you have not been charged.`, tone: 'danger', icon: 'warning' }); }
      } else {
        showDialog({ title: 'Payment pending', message: `Your ${meta.title} payment request was created. Complete it with ${meta.title}, then return here — access unlocks automatically once it is confirmed.`, tone: meta.tone, icon: meta.icon });
      }
      setStep('processing');
    } catch (error: any) {
      showDialog({ title: 'Could not start payment', message: error?.message || 'The payment service is unavailable. No payment was made.', tone: 'danger', icon: 'warning' });
    } finally { setBusy(false); }
  }

  // Poll our OWN protected status endpoint after the provider page opens. Access
  // is granted only when the backend reports a provider-confirmed success — never
  // from the browser redirect alone.
  const checkStatusNow = useCallback(async () => {
    if (!reference) return;
    setBusy(true);
    try {
      const deviceId = await getDeviceFingerprint();
      const [statusResult, latestAccess] = await Promise.all([
        getPaymentStatus(reference, deviceId).catch(() => null),
        getAccessStatus().catch(() => null),
      ]);
      if (latestAccess) setAccess(latestAccess);
      const paid = statusResult?.status === 'success' || latestAccess?.status === 'active';
      if (paid) {
        await markFeatureUnlocked(PREMIUM_FEATURES.bulkUnlock, reference);
        setStep('success');
      }
    } finally { setBusy(false); }
  }, [reference]);

  useEffect(() => {
    if (step !== 'processing' || !reference) return;
    let attempts = 0;
    let cancelled = false;
    void checkStatusNow();
    const timer = setInterval(() => {
      attempts += 1;
      if (cancelled || attempts > 40) { clearInterval(timer); return; }
      void checkStatusNow();
    }, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [step, reference, checkStatusNow]);

  const maskedPhone = useMemo(() => phone ? phone.replace(/(\d{3})\d+(\d{2})$/, '$1****$2') : 'Not entered', [phone]);
  const phoneMessage = inputNote || phoneValidationMessage(phone);

  if (step === 'processing') return (
    <Screen scroll={false}>
      <BackHeader title="Completing payment" compact />
      <Card elevated style={{ alignItems: 'center', gap: 16, padding: 24, marginTop: 24 }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name="shield" color={colors.primary} size={40} />
        </View>
        <Pill text="WAITING FOR CONFIRMATION" tone="blue" />
        <Text style={{ color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: '900', textAlign: 'center' }}>Approve the payment in {meta.title}</Text>
        <Text style={[styles.body, { textAlign: 'center' }]}>Approve the D{amount} payment in the {meta.title} app or page that just opened. GNM never asks for your {meta.title} PIN or code. Access unlocks automatically once {meta.title} confirms the payment.</Text>
        <Button title={busy ? 'Checking…' : 'I have paid — check now'} icon="refresh" loading={busy} onPress={checkStatusNow} style={{ width: '100%', minHeight: 56 }} />
        <Button title="Back to Dashboard" variant="secondary" icon="home" onPress={() => router.replace('/dashboard')} style={{ width: '100%' }} />
      </Card>
      <NoticeCard title="Keep this screen open" text="GNM checks with the payment provider every few seconds. Confirmation can take up to a minute after you approve." tone="blue" icon="shield" />
      <Dialog />
    </Screen>
  );

  if (access?.status === 'active') return (
    <Screen scroll={false}>
      <BackHeader title="Full access" compact />
      <Card elevated style={{ alignItems: 'center', gap: 14, padding: 24, marginTop: 24 }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="check" color={colors.success} size={42} /></View>
        <Pill text={access.promotional ? 'FREE LAUNCH ACCESS' : 'ACCESS ACTIVE'} tone="success" />
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: '900', textAlign: 'center' }}>{access.promotional ? 'Your access is free' : 'Already unlocked'}</Text>
        <Text style={[styles.body, { textAlign: 'center' }]}>{access.promotional ? 'You received a promotional place. No payment is required on this device.' : 'Your full Contact Migration Pass is active on this device.'}</Text>
        <Button title="Continue to Dashboard" icon="right" onPress={() => router.replace('/dashboard')} style={{ width: '100%', minHeight: 58 }} />
      </Card>
    </Screen>
  );

  if (!priceLoading && approvedProviders.length === 0) return (
    <Screen scroll={false}>
      <BackHeader title="Contact Migration Pass" subtitle="Payment availability" compact />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Card elevated style={{ alignItems: 'center', gap: 14, padding: 24 }}>
          <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="shield" color={colors.primary} size={38} /></View>
          <Pill text="PAYMENTS COMING SOON" tone="blue" />
          <Text style={{ color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: '900', textAlign: 'center' }}>No wallet is enabled yet</Text>
          <Text style={[styles.body, { textAlign: 'center' }]}>Wave and APS will appear here only after OceanBrown confirms the provider arrangement and completes secure production testing.</Text>
          <NoticeCard title="You will not be charged" text="No payment request can be created while all wallets are disabled. You can continue using any available free or promotional access." tone="success" icon="lock" />
          <Button title="Back to Dashboard" icon="home" onPress={() => router.replace('/dashboard')} style={{ width: '100%' }} />
        </Card>
      </View>
      <Dialog />
    </Screen>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
    <Screen scroll={step !== 'phone'} stickyTop={!keyboardVisible}>
      <BackHeader title="Payment" compact />

      {!keyboardVisible ? (
        <>
          <PaymentHero amount={amount} />
        </>
      ) : (
        <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
          <Text style={{ color: colors.softText, fontSize: 12, fontWeight: '900', letterSpacing: 0.8 }}>{meta.title.toUpperCase()} CHECKOUT · D{amount}</Text>
        </View>
      )}

      {step !== 'success' ? (
        <Section style={{ marginTop: 0 }}>
          <Card elevated style={{ gap: 12, padding: 14, borderRadius: 28 }}>
            <View>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginBottom: 10 }}>Choose payment provider</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {approvedProviders.map((item) => {
                    const itemMeta = providerMeta[item];
                    const itemTone = getTone(colors, itemMeta.tone);
                    const active = provider === item;
                    return (
                      <TouchableOpacity
                        accessibilityRole="radio"
                        accessibilityLabel={`${itemMeta.title} payment provider`}
                        accessibilityState={{ checked: active }}
                        key={item}
                        activeOpacity={0.84}
                        onPress={() => setProvider(item)}
                        style={{
                          flex: 1,
                          minHeight: 76,
                          borderRadius: 20,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: active ? itemTone.bg : colors.card,
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? itemTone.fg : colors.border,
                        }}
                      >
                        {active ? <View style={{ position: 'absolute', right: 8, top: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: itemTone.fg, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="check" color={colors.white} size={14} /></View> : null}
                        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: itemTone.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          <Image source={item === 'aps' ? require('../assets/aps-logo.png') : require('../assets/wave-logo.png')} resizeMode="contain" style={{ width: 44, height: 44 }} accessibilityLabel={`${itemMeta.title} logo`} />
                        </View>
                        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 6 }}>{itemMeta.title}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

            <View>
              <View style={[styles.rowBetween, { gap: 10 }]}>
                <Text style={styles.label}>Payment phone number</Text>
                <Text style={{ color: colors.softText, fontSize: 12, fontWeight: '800' }}>Gambia +220</Text>
              </View>
              <View style={{
                marginTop: 7,
                borderRadius: 17,
                borderWidth: phoneFocused || canPay ? 2 : 1,
                borderColor: phone && !canPay ? colors.warning : canPay ? colors.success : phoneFocused ? tone.fg : colors.border,
                backgroundColor: colors.surface2,
                shadowColor: colors.shadow,
                shadowOpacity: phoneFocused ? (colors.isDark ? 0.22 : 0.10) : 0,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 7 },
                elevation: phoneFocused ? 3 : 0,
                overflow: 'hidden'
              }}>
                <View style={[styles.row, { minHeight: 56 }]}> 
                  <View style={{ width: 48, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}><AppIcon name="phone" color={colors.softText} size={20} /></View>
                  <TextInput
                    accessibilityLabel="Payment phone number"
                    accessibilityHint="Enter a seven or nine digit Gambian phone number"
                    value={phone}
                    onChangeText={handlePhoneChange}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    placeholder="Enter 7 or 9 digits"
                    placeholderTextColor={colors.softText}
                    keyboardType="phone-pad"
                    inputMode="tel"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    editable={step === 'phone'}
                    returnKeyType="done"
                    onSubmitEditing={() => canPay ? startPayment() : Keyboard.dismiss()}
                    selectionColor={tone.fg}
                    style={{ flex: 1, minWidth: 0, minHeight: 56, paddingHorizontal: 4, color: colors.text, fontSize: 17, fontWeight: '800', opacity: step === 'phone' ? 1 : 0.72 }}
                  />
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={canPay ? 'Phone number is valid' : 'Clear phone number'} disabled={!phone.length} onPress={() => { setPhone(''); setInputNote(''); }} activeOpacity={0.75} style={{ width: 46, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: canPay ? colors.successSoft : colors.surface2, borderWidth: 1, borderColor: canPay ? colors.success : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                      <AppIcon name={canPay ? 'check' : phone.length ? 'close' : 'phone'} color={canPay ? colors.success : colors.softText} size={17} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.rowBetween, { marginTop: 6, gap: 10 }]}>
                <Text numberOfLines={1} style={[styles.small, { flex: 1, color: canPay && !inputNote ? colors.success : colors.warning }]}>{phoneMessage}</Text>
                <Text style={{ color: colors.softText, fontSize: 12, fontWeight: '900' }}>{validPhone(phone) ? 'Ready' : `${phone.length} digits`}</Text>
              </View>
            </View>

            <Button
              title={priceLoading ? 'Checking live price…' : `Pay D${amount}`}
              icon="right"
              disabled={!canPay || priceLoading}
              loading={busy}
              onPress={startPayment}
              style={{ minHeight: 56, borderRadius: 18, backgroundColor: canPay && !priceLoading ? colors.primary : colors.surface3, borderColor: canPay && !priceLoading ? colors.primary : colors.border, shadowOpacity: canPay && !priceLoading ? (colors.isDark ? 0.32 : 0.18) : 0, elevation: canPay && !priceLoading ? 6 : 0 }}
            />
          </Card>
          <Text style={{ color: colors.softText, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>Secure payment · Contacts stay private</Text>
        </Section>
      ) : (
        <Section title="Payment receipt" style={{ marginTop: 16 }}>
          <Card elevated style={{ alignItems: 'center', gap: 14, padding: 20 }}>
            <View style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: colors.successSoft, borderColor: colors.success, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                <AppIcon name="check" color={colors.white} size={36} />
              </View>
            </View>
            <Text style={{ color: colors.text, fontSize: 27, lineHeight: 33, fontWeight: '900', textAlign: 'center' }}>Payment Successful</Text>
            <Text style={[styles.body, { textAlign: 'center' }]}>Contact migration is now unlocked on this device.</Text>
            <View style={{ width: '100%', gap: 2, marginTop: 4 }}>
              <InfoRow label="Platform" value={meta.title} />
              <InfoRow label="Amount" value={`D${amount}`} />
              <InfoRow label="Phone" value={`+220 ${maskedPhone}`} />
              <InfoRow label="Reference" value={reference ? `${reference.slice(0, 22)}…` : 'Saved locally'} />
            </View>
            <Button title="Go to Preview" icon="right" onPress={() => router.replace({ pathname: '/preview', params: { filter: 'Needs Update' } })} style={{ width: '100%', minHeight: 58, borderRadius: 22 }} />
            <Button title="Back to Dashboard" variant="secondary" icon="home" onPress={() => router.replace('/dashboard')} style={{ width: '100%' }} />
          </Card>
        </Section>
      )}

      <Dialog />
    </Screen>
    </KeyboardAvoidingView>
  );
}

function PaymentHero({ amount }: { amount: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: colors.brandTop, marginBottom: 0, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ position: 'absolute', right: -72, top: -76, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.brandBubble }} />
      <View style={{ paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center' }}>
        <Text style={{ color: colors.white, fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: -1 }}>D{amount}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.82)', fontWeight: '700', fontSize: 12 }}>One-time migration pass</Text>
      </View>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.rowBetween, { gap: 12, paddingVertical: 9, borderBottomWidth: label === 'Reference' ? 0 : 1, borderBottomColor: colors.line }]}> 
      <Text style={{ color: colors.muted, fontWeight: '800' }}>{label}</Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '900', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
