import { useEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../src/components/Button';
import { BackHeader, Card, NoticeCard, Pill, Screen, Section, useAppDialog } from '../src/components/UI';
import { createPaymentIntent, syncConfig, verifyPaymentOtp } from '../src/services/api';
import { getDeviceFingerprint } from '../src/services/deviceService';
import { markFeatureUnlocked, PREMIUM_FEATURES } from '../src/services/unlockService';
import { getTone, radius, type Tone, useAppTheme } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

type Provider = 'wave' | 'aps';
type Step = 'phone' | 'otp' | 'success';

const providerMeta: Record<Provider, { title: string; tone: Tone; icon: string; help: string; note: string }> = {
  wave: {
    title: 'Wave',
    tone: 'blue',
    icon: 'phone',
    help: 'Enter the Wave phone number that should receive the test OTP.',
    note: 'Wave test checkout · phone verification',
  },
  aps: {
    title: 'APS',
    tone: 'violet',
    icon: 'card',
    help: 'Enter the APS payment phone number that should receive the test OTP.',
    note: 'APS gateway test checkout',
  },
};

function cleanPhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 9);
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
  const provider: Provider = params.provider === 'aps' ? 'aps' : 'wave';
  const [amount, setAmount] = useState(Number(params.amount || 100) || 100);
  const meta = providerMeta[provider];
  const tone = getTone(colors, meta.tone);
  const [phone, setPhone] = useState('');
  const [inputNote, setInputNote] = useState('');
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState('');
  const canPay = validPhone(phone);
  const canConfirm = otp.length === 4;

  function handlePhoneChange(value: string) {
    const digitsOnly = value.replace(/\D/g, '');
    const next = cleanPhone(value);
    setPhone(next);
    if (digitsOnly.length > 9) setInputNote('Only 7 or 9 digits are accepted. Extra digits were removed.');
    else setInputNote('');
  }

  useEffect(() => {
    setOtp('');
    setSentOtp('');
    setStep('phone');
  }, [provider]);

  useEffect(() => {
    syncConfig().then((config) => {
      const current = Number(config.subscription_price);
      if (Number.isFinite(current) && current > 0) setAmount(current);
    }).catch(() => undefined);
  }, []);

  async function sendOtp() {
    if (!canPay) {
      showDialog({ title: 'Invalid phone number', message: 'Enter exactly 7 digits or exactly 9 digits. More than 9 digits is not allowed.', tone: 'warning', icon: 'warning' });
      return;
    }
    setBusy(true);
    try {
      const fp = await getDeviceFingerprint();
      const intent = await createPaymentIntent({ provider, deviceId: fp, featureKey: PREMIUM_FEATURES.bulkUnlock, amount, currency: 'GMD', customerPhone: phone, metadata: { source: 'mobile-checkout' } });
      setReference(intent.reference);
      setSentOtp(intent.testOtp || '');
      setOtp('');
      setStep('otp');
      showDialog({ title: 'OTP sent', message: intent.testOtp ? `Development test code: ${intent.testOtp}` : `Check +220 ${phone} for your payment OTP.`, tone: meta.tone, icon: meta.icon, actions: [{ text: 'Enter OTP', tone: meta.tone }] });
    } catch (error: any) {
      showDialog({ title: 'Could not start payment', message: error?.message || 'The payment service is unavailable. No payment was made.', tone: 'danger', icon: 'warning' });
    } finally { setBusy(false); }
  }

  async function confirmPayment() {
    setBusy(true);
    try {
      const result = await verifyPaymentOtp(reference, otp);
      if (result.status !== 'success') throw new Error('Payment has not been confirmed');
      await markFeatureUnlocked(PREMIUM_FEATURES.bulkUnlock, reference);
      setStep('success');
    } catch (error: any) {
      showDialog({ title: 'Payment not confirmed', message: error?.message || 'The OTP is invalid or expired.', tone: 'danger', icon: 'warning' });
    } finally { setBusy(false); }
  }

  const maskedPhone = useMemo(() => phone ? phone.replace(/(\d{3})\d+(\d{2})$/, '$1****$2') : 'Not entered', [phone]);
  const phoneMessage = inputNote || phoneValidationMessage(phone);

  return (
    <Screen>
      <BackHeader title={`${meta.title} Checkout`} subtitle="Phone number and OTP confirmation." compact />

      <PaymentHero provider={meta.title} amount={amount} icon={meta.icon} tone={meta.tone} />
      <StepTracker step={step} />

      {step !== 'success' ? (
        <Section title={step === 'phone' ? 'Enter payment number' : 'Confirm payment OTP'} style={{ marginTop: 16 }}>
          <Card elevated style={{ gap: 16, padding: 18 }}>
            <View style={[styles.rowBetween, { gap: 12, alignItems: 'flex-start' }]}> 
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontSize: 19, lineHeight: 25, fontWeight: '900' }}>{step === 'phone' ? `${meta.title} payment details` : 'Verify your payment'}</Text>
                <Text style={[styles.body, { marginTop: 4 }]}>{step === 'phone' ? meta.help : `Enter the 4-digit code sent for +220 ${maskedPhone}.`}</Text>
              </View>
              <Pill text={`D${amount}`} tone={meta.tone} />
            </View>

            {step === 'phone' ? <View>
              <Text style={styles.label}>Phone number</Text>
              <View style={{
                marginTop: 9,
                borderRadius: 26,
                borderWidth: 1.8,
                borderColor: phone && !canPay ? colors.warning : canPay ? colors.success : tone.border,
                backgroundColor: colors.card,
                shadowColor: colors.shadow,
                shadowOpacity: colors.isDark ? 0.18 : 0.10,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
                elevation: 4,
                overflow: 'hidden'
              }}>
                <View style={[styles.row, { minHeight: 68 }]}> 
                  <View style={{ width: 62, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', backgroundColor: tone.bg, borderRightWidth: 1, borderRightColor: tone.border }}>
                    <AppIcon name={meta.icon} color={tone.fg} size={23} />
                  </View>
                  <View style={{ paddingLeft: 13, paddingRight: 6, alignItems: 'center' }}>
                    <Text style={{ color: tone.fg, fontWeight: '900', fontSize: 13 }}>+220</Text>
                    <Text style={{ color: colors.softText, fontWeight: '900', fontSize: 10, marginTop: 1 }}>GM</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={handlePhoneChange}
                    placeholder="3000000 or 863000000"
                    placeholderTextColor={colors.softText}
                    keyboardType="number-pad"
                    maxLength={9}
                    editable={step === 'phone'}
                    style={{ flex: 1, minHeight: 68, paddingHorizontal: 10, color: colors.text, fontSize: 21, fontWeight: '900', letterSpacing: 1.15, opacity: step === 'phone' ? 1 : 0.72 }}
                  />
                  <View style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: canPay ? colors.successSoft : colors.surface2, borderWidth: 1, borderColor: canPay ? colors.success : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                      <AppIcon name={canPay ? 'check' : 'phone'} color={canPay ? colors.success : colors.softText} size={17} />
                    </View>
                  </View>
                </View>
              </View>
              <View style={[styles.rowBetween, { marginTop: 10, gap: 10 }]}> 
                <Text style={[styles.small, { flex: 1, color: canPay && !inputNote ? colors.success : colors.warning }]}>{phoneMessage}</Text>
                <Text style={{ color: colors.softText, fontSize: 12, fontWeight: '900' }}>{phone.length}/9</Text>
              </View>
            </View> : null}

            {step === 'otp' ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 72, height: 72, borderRadius: 26, backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><AppIcon name="shield" color={tone.fg} size={30} /></View>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' }}>Enter verification code</Text>
                <Text style={[styles.body, { textAlign: 'center', marginTop: 5, marginBottom: 16 }]}>We sent a 4-digit code to +220 {maskedPhone}</Text>
                <TextInput
                  value={otp}
                  onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  placeholderTextColor={colors.softText}
                  keyboardType="number-pad"
                  maxLength={4}
                  autoFocus
                  style={[styles.input, { width: '100%', textAlign: 'center', fontSize: 30, letterSpacing: 14, fontWeight: '900', minHeight: 70, borderRadius: 22, borderColor: otp.length === 4 ? colors.success : tone.border }]}
                />
                {sentOtp ? <View style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning }}><Text style={{ color: colors.warning, fontWeight: '900', textAlign: 'center' }}>LOCAL TEST CODE · {sentOtp}</Text><TouchableOpacity onPress={() => setOtp(sentOtp)} style={{ marginTop: 8 }}><Text style={{ color: colors.primary, fontWeight: '900', textAlign: 'center' }}>Use test code</Text></TouchableOpacity></View> : null}
                <TouchableOpacity activeOpacity={0.82} disabled={busy} onPress={sendOtp} style={{ marginTop: 16, padding: 8 }}><Text style={{ color: tone.fg, fontWeight: '900' }}>Didn’t receive it? Resend code</Text></TouchableOpacity>
              </View>
            ) : null}

            {step === 'phone' ? (
              <Button
                title={`Pay D${amount}`}
                icon="right"
                disabled={!canPay}
                loading={busy}
                onPress={sendOtp}
                style={{ minHeight: 62, borderRadius: 24, backgroundColor: canPay ? tone.fg : colors.surface3, borderColor: canPay ? tone.fg : colors.border, shadowOpacity: canPay ? (colors.isDark ? 0.32 : 0.18) : 0, elevation: canPay ? 6 : 0 }}
              />
            ) : (
              <View style={{ gap: 10 }}>
                <Button title={`Verify payment · D${amount}`} icon="check" loading={busy} disabled={!canConfirm || busy} onPress={confirmPayment} style={{ minHeight: 60, borderRadius: 22 }} />
                <Button title="Use a different number" variant="secondary" tone={meta.tone} icon="phone" disabled={busy} onPress={() => { setStep('phone'); setOtp(''); setSentOtp(''); }} />
              </View>
            )}
          </Card>
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
            <Text style={[styles.body, { textAlign: 'center' }]}>Migration tools are unlocked on this device for testing.</Text>
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

      {step !== 'success' ? <NoticeCard title="No live charge" text="This is a safe Wave/APS test checkout. Live merchant APIs, callbacks and settlement confirmation should be added before production." tone="blue" icon="shield" /> : null}
      <Dialog />
    </Screen>
  );
}

function PaymentHero({ provider, amount, icon, tone }: { provider: string; amount: number; icon: string; tone: Tone }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <View style={{ borderRadius: 32, overflow: 'hidden', backgroundColor: colors.brandTop, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ position: 'absolute', right: -72, top: -76, width: 200, height: 200, borderRadius: 100, backgroundColor: colors.brandBubble }} />
      <View style={{ padding: 20 }}>
        <View style={[styles.rowBetween, { gap: 14, alignItems: 'flex-start' }]}> 
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, letterSpacing: 1.2, fontWeight: '900' }}>{provider.toUpperCase()} CHECKOUT</Text>
            <Text style={{ color: colors.white, fontSize: 37, lineHeight: 42, fontWeight: '900', marginTop: 8 }}>D{amount}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '700', lineHeight: 21, marginTop: 5 }}>{provider} payment for the Contact Migration Pass.</Text>
          </View>
          <View style={{ width: 66, height: 66, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', alignItems: 'center', justifyContent: 'center' }}>
            <AppIcon name={icon} color={colors.white} size={28} />
          </View>
        </View>
        <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 20, padding: 12 }}>
          <View style={[styles.rowBetween, { gap: 10 }]}> 
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '800' }}>Status</Text>
            <Text style={{ color: colors.white, fontWeight: '900' }}>Test mode</Text>
          </View>
          <View style={[styles.rowBetween, { gap: 10, marginTop: 8 }]}> 
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontWeight: '800' }}>Provider</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><AppIcon name={icon} color={t.fg} size={15} /><Text style={{ color: colors.white, fontWeight: '900' }}>{provider}</Text></View>
          </View>
        </View>
      </View>
    </View>
  );
}

function StepTracker({ step }: { step: Step }) {
  const activeIndex = step === 'phone' ? 1 : step === 'otp' ? 2 : 3;
  const labels = ['Method', 'Details', 'Verify', 'Success'];
  const { colors } = useAppTheme();
  return (
    <Card style={{ padding: 14, borderRadius: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {labels.map((label, idx) => {
          const active = idx <= activeIndex;
          return (
            <View key={label} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.primary : colors.surface3, borderWidth: 1, borderColor: active ? colors.primary : colors.border }}>
                <Text style={{ color: active ? colors.white : colors.softText, fontWeight: '900' }}>{idx + 1}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: active ? colors.primary : colors.softText, marginTop: 6, fontSize: 11, fontWeight: '900' }}>{label}</Text>
            </View>
          );
        })}
      </View>
    </Card>
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
