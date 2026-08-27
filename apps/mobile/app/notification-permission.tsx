import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppIcon } from '../src/components/AppIcon';
import { Button } from '../src/components/Button';
import { Card, NoticeCard, Screen, TopNav, useAppDialog } from '../src/components/UI';
import { setupNotifications } from '../src/services/notificationService';
import { keys, setJson } from '../src/services/storage';
import { useAppTheme, useResponsive } from '../src/appTheme';

export default function NotificationPermission() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const responsive = useResponsive();
  const [busy, setBusy] = useState(false);

  async function continueToApp(allow: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (allow) {
        const result = await setupNotifications();
        if (!result.enabled) {
          await setJson(keys.notificationPermissionPrompted, true);
          showDialog({
            title: 'Notifications not enabled',
            message: result.reason || 'You can allow notifications later from your phone settings.',
            tone: 'warning',
            icon: 'warning',
          });
          return;
        }
      }
      await setJson(keys.notificationPermissionPrompted, true);
      router.replace('/dashboard');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopNav title="Gambia Number Migrator" compact />
      <View style={{ paddingTop: responsive.compact ? 18 : 28, paddingBottom: 10 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: responsive.compact ? 124 : 150, height: responsive.compact ? 124 : 150, borderRadius: responsive.compact ? 62 : 75, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: responsive.compact ? 92 : 116, height: responsive.compact ? 92 : 116, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 }}>
              <AppIcon name="notification" color={colors.primary} size={34} />
            </View>
          </View>
          <Text style={[styles.eyebrow, { marginTop: 16, color: colors.primary }]}>Stay informed</Text>
          <Text style={[styles.largeTitle, { textAlign: 'center', marginTop: 8, color: colors.title }]}>Allow Notifications</Text>
          <Text style={[styles.body, { textAlign: 'center', marginTop: 8, maxWidth: 430 }]}>Get important numbering updates, migration notices, payment confirmations and service announcements.</Text>
        </View>

        <View style={{ marginTop: 16 }}><NoticeCard title="You stay in control" text="GNM sends only important service messages. You can turn notifications off anytime from your phone settings." tone="blue" icon="shield" /></View>
        <Card style={{ gap: 10, marginTop: 12 }}>
          {[
            ['Important updates', 'Know when migration rules or services change.'],
            ['Payment confirmation', 'Receive useful access and payment notices.'],
            ['No contact access', 'Notifications never read or upload your contacts.'],
          ].map(([title, text]) => (
            <View key={title} style={[styles.row, { gap: 12 }]}>
              <AppIcon name="check" color={colors.success} size={16} />
              <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{title}</Text><Text style={styles.small}>{text}</Text></View>
            </View>
          ))}
        </Card>
      </View>
      <Button title="Allow Notifications" icon="notification" loading={busy} disabled={busy} onPress={() => continueToApp(true)} style={{ marginTop: 12 }} />
      <Button title="Not Now" variant="ghost" disabled={busy} onPress={() => continueToApp(false)} style={{ marginTop: 8 }} />
      <Dialog />
    </Screen>
  );
}
