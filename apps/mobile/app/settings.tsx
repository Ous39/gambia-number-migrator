import { useEffect, useState } from 'react';
import { Linking, Share, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { DEFAULT_RULES_PAYLOAD, type PublishedRulesPayload } from '@gnm/shared';
import { BackHeader, Card, NoticeCard, Screen, Section, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { Button } from '../src/components/Button';
import { clearLocalData, getJson, keys } from '../src/services/storage';
import { getApiBaseUrl, registerDevice, syncConfig } from '../src/services/api';
import { getDeviceFingerprint, getDeviceInfo } from '../src/services/deviceService';
import { type ThemeMode, useAppTheme } from '../src/appTheme';

export default function Settings() {
  const { colors, styles, mode, setMode, resolvedMode } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [rules, setRules] = useState<PublishedRulesPayload>(DEFAULT_RULES_PAYLOAD);

  useEffect(() => {
    syncConfig().then(setConfig).catch(() => undefined);
    getDeviceFingerprint().then((id) => registerDevice(id, getDeviceInfo())).then(setDiagnostics).catch(() => undefined);
    getJson<PublishedRulesPayload>(keys.rules, DEFAULT_RULES_PAYLOAD).then(setRules).catch(() => undefined);
  }, []);

  const rulesPublishedAt = rules.publishedAt && rules.publishedAt !== 'offline-unavailable' ? new Date(rules.publishedAt) : null;
  const activeRuleCount = Array.isArray(rules.rules) ? rules.rules.length : 0;

  const supportEmail = String(config.support_email || process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '');
  const supportWhatsApp = String(config.support_whatsapp || process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || '');
  const supportPhone = String(config.support_phone || process.env.EXPO_PUBLIC_SUPPORT_PHONE || supportWhatsApp || '');
  const privacyUrl = String(config.privacy_policy_url || process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '');
  const termsUrl = String(config.terms_url || process.env.EXPO_PUBLIC_TERMS_URL || '');
  const validEmail = supportEmail.includes('@') && !supportEmail.endsWith('@example.com');
  const validPhone = supportPhone.replace(/\D/g, '').length >= 7 && !/^2200+$/.test(supportPhone.replace(/\D/g, ''));
  const validWhatsApp = supportWhatsApp.replace(/\D/g, '').length >= 7 && !/^2200+$/.test(supportWhatsApp.replace(/\D/g, ''));
  const deviceInfo = getDeviceInfo();
  const supportMessage = `Gambia Number Migrator support request\nSupport code: ${diagnostics?.supportCode || 'Unavailable'}\nDevice: ${deviceInfo.deviceModel || deviceInfo.deviceName || 'Unknown'}\nOS: ${deviceInfo.osName || deviceInfo.platform} ${deviceInfo.osVersion || ''}\nApp: ${deviceInfo.appVersion}\nAccess status: ${diagnostics?.status || 'unknown'}\n\nProblem: `;

  async function openSupport(kind: 'email' | 'phone' | 'whatsapp' | 'privacy' | 'terms') {
    const phone = supportPhone.replace(/[^\d+]/g, '');
    const wa = supportWhatsApp.replace(/\D/g, '');
    const targets = {
      email: validEmail ? `mailto:${supportEmail}?subject=${encodeURIComponent('Gambia Number Migrator Support')}` : '',
      phone: validPhone ? `tel:${phone}` : '',
      whatsapp: validWhatsApp ? `https://wa.me/${wa}?text=${encodeURIComponent(supportMessage)}` : '',
      privacy: /^https:\/\//.test(privacyUrl) ? privacyUrl : '',
      terms: /^https:\/\//.test(termsUrl) ? termsUrl : '',
    };
    const target = targets[kind];
    if (!target) {
      showDialog({ title: 'Support details not published', message: 'The administrator must add the official contact or legal URL in App Config before release.', tone: 'warning', icon: 'warning' });
      return;
    }
    try { await Linking.openURL(target); } catch { showDialog({ title: 'Could not open link', message: 'Please check your connection or contact settings and try again.', tone: 'danger', icon: 'warning' }); }
  }

  async function shareDiagnostics() {
    await Share.share({ title: 'Gambia Number Migrator support details', message: supportMessage });
  }

  function confirmResetLocalData() {
    showDialog({
      title: 'Reset local app data?',
      message: 'This permanently deletes saved scan results, migration history, and all local backups from this device. Your phone contacts are never touched. This cannot be undone.',
      tone: 'danger',
      icon: 'warning',
      actions: [
        { text: 'Cancel', variant: 'secondary' },
        { text: 'Reset App Data', variant: 'danger', tone: 'danger', onPress: async () => {
          await clearLocalData();
          router.replace('/');
        } }
      ]
    });
  }

  async function showDebug() {
    const transition = await getJson<any>(keys.transition, null);
    showDialog({
      title: 'App info',
      message: `Support code: ${diagnostics?.supportCode || 'unavailable'}\nAPI: ${getApiBaseUrl()}\nRules version: ${rules?.versionNumber || 'none'}\nTransition: ${transition?.transitionStartDate || 'none'}\nTheme: ${mode} (${resolvedMode})`,
      tone: 'blue',
      icon: 'info',
    });
  }

  return (
    <Screen>
      <BackHeader title="Settings" subtitle="Appearance, privacy, support, and app information." />
      <View style={{ marginTop: 14 }}><NoticeCard title="Privacy-first by design" text="Contacts are processed locally on your phone. No contact names or phonebook data are uploaded." tone="primary" icon="lock" /></View>

      <Section title="Appearance">
        <Card style={{ gap: 16 }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 17 }}>Theme preference</Text>
              <Text style={styles.body}>Current: {mode} · Showing {resolvedMode}</Text>
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <AppIcon name={resolvedMode === 'dark' ? 'moon' : 'sun'} color={colors.primary} size={23} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {(['system', 'light', 'dark'] as ThemeMode[]).map((m) => (
              <TouchableOpacity key={m} accessibilityRole="radio" accessibilityLabel={`${m} theme`} accessibilityState={{ checked: mode === m }} activeOpacity={0.84} onPress={() => setMode(m)} style={{ flex: 1, minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: mode === m ? colors.primary : colors.line, backgroundColor: mode === m ? colors.primarySoft : colors.surface2 }}>
                <Text style={{ color: mode === m ? colors.primary : colors.text, fontWeight: '900', textTransform: 'capitalize' }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Privacy & Security">
        <Card>
          <InfoRow label="Contact processing" value="On device" icon="phone" />
          <InfoRow label="Contact upload" value="Never" icon="lock" />
          <InfoRow label="Payment privacy" value="Device reference only" icon="card" />
          <InfoRow label="Tracking" value="Off by default" icon="shield" />
        </Card>
        <View style={{ marginTop: 12 }}><NoticeCard title="What the server knows about this device" text="For access status and support, the server stores a random device reference, basic device/app info, and payment status. It never receives contact names, phone numbers, backups, or your scan results." tone="blue" icon="info" /></View>
      </Section>

      <Section title="Migration Preferences">
        <Card>
          <InfoRow label="Default safe mode" value="Add & keep old" icon="plus" />
          <InfoRow label="Cleanup rule" value="Verified pairs only" icon="cleanup" />
          <InfoRow label="Backup" value="Before changes" icon="backup" />
        </Card>
      </Section>

      <Section title="Support & Legal">
        <Card style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>Your support code</Text>
          <Text selectable style={{ color: colors.primary, fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: 1, marginTop: 6 }}>{diagnostics?.supportCode || 'Connecting…'}</Text>
          <Text style={[styles.small, { marginTop: 5 }]}>Share this code if a confirmed payment does not unlock contact migration.</Text>
          <Button title="Share Support Details" variant="secondary" tone="blue" icon="document" disabled={!diagnostics?.supportCode} onPress={shareDiagnostics} style={{ marginTop: 12 }} />
        </Card>
        <Card style={{ gap: 10 }}>
          <SupportAction title="WhatsApp support" text={validWhatsApp ? 'Chat with our support team' : 'Add number in Admin → App Config'} icon="phone" onPress={() => openSupport('whatsapp')} />
          <SupportAction title="Email support" text={validEmail ? supportEmail : 'Add email in Admin → App Config'} icon="email" onPress={() => openSupport('email')} />
          <SupportAction title="Call support" text={validPhone ? supportPhone : 'Add phone in Admin → App Config'} icon="call" onPress={() => openSupport('phone')} />
          <SupportAction title="Privacy Policy" text="How we protect your data" icon="shield" onPress={() => openSupport('privacy')} />
          <SupportAction title="Terms of Use" text="Rules for using this service" icon="document" onPress={() => openSupport('terms')} />
        </Card>
        <View style={{ marginTop: 12 }}><NoticeCard title="Never share payment PINs" text="Support will never ask for your Wave/APS PIN, OTP, password, or full contact list." tone="warning" icon="shield" /></View>
      </Section>

      <Section title="Organisation access">
        <Card style={{ gap: 10 }}>
          <Text style={styles.body}>Have an organisation code from your employer or from OceanBrown? Enter it to unlock the full Contact Migration Pass on this device.</Text>
          <Button title="Enter organisation code" variant="secondary" tone="blue" icon="card" onPress={() => router.push('/organisation')} />
        </Card>
      </Section>

      <Section title="Rules & About">
        <Card style={{ gap: 14 }}>
          <InfoRow label="Rule source" value="PURA-guided migration rules" icon="shield" />
          <InfoRow label="Last rule update" value={rulesPublishedAt ? rulesPublishedAt.toLocaleDateString() : 'Not yet synced'} icon="info" />
          <InfoRow label="Active rules" value={String(activeRuleCount)} icon="cleanup" />
          <InfoRow label="Version" value={deviceInfo.appVersion} icon="info" />
          <InfoRow label="Build" value={String((deviceInfo as any).buildNumber || '—')} icon="settings" />
          <Text style={[styles.small, { marginTop: 2 }]}>Numbering ranges are based on published PURA guidance. Contact scanning, migration and cleanup all run on this device — administrators cannot view, access, or delete your contacts. Privacy Policy, Terms and support contacts are below.</Text>
          {String(config.rules_about_note || '').trim() ? (
            <View style={{ marginTop: 4 }}><NoticeCard title="Note from the service" text={String(config.rules_about_note).trim()} tone="blue" icon="info" /></View>
          ) : null}
          <Button title="App Info" variant="secondary" tone="blue" icon="info" onPress={showDebug} />
        </Card>
      </Section>

      <Section title="Danger Zone">
        <Card style={{ gap: 10 }}>
          <Text style={styles.body}>Permanently erase saved scan results, migration history, and local backups stored on this device. Your phone contacts are never deleted by this action.</Text>
          <Button title="Reset Local App Data" variant="danger" tone="danger" icon="warning" onPress={confirmResetLocalData} />
        </Card>
      </Section>
      <Dialog />
    </Screen>
  );
}

function SupportAction({ title, text, icon, onPress }: { title: string; text: string; icon: string; onPress: () => void }) {
  const { colors, styles } = useAppTheme();
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${text}`} style={[styles.softCard, styles.row, { gap: 12, minHeight: 66, padding: 12 }]}> 
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name={icon} color={colors.primary} size={18} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text><Text numberOfLines={2} style={styles.small}>{text}</Text></View>
      <AppIcon name="right" color={colors.softText} size={18} />
    </TouchableOpacity>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: string }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.rowBetween, { paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line }]}> 
      <View style={[styles.row, { gap: 10, flex: 1, minWidth: 0 }]}> 
        <View style={{ width: 34, height: 34, borderRadius: 13, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={icon} color={colors.primary} size={16} />
        </View>
        <Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{label}</Text>
      </View>
      <Text style={{ color: colors.muted, fontWeight: '800', textAlign: 'right', flexShrink: 1 }}>{value}</Text>
    </View>
  );
}
