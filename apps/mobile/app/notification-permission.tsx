import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { AppIcon } from '../src/components/AppIcon';
import { Card, NoticeCard, Screen, TopNav, useAppDialog } from '../src/components/UI';
import { useAppTheme } from '../src/appTheme';
import { setupNotifications } from '../src/services/notificationService';
import { keys, setJson } from '../src/services/storage';

export default function NotificationPermission() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const [loading, setLoading] = useState(false);

  async function finish(allow: boolean) {
    setLoading(true);
    try {
      if (allow) {
        const result = await setupNotifications(true);
        if (!result.enabled) showDialog({ title: 'Notifications not enabled', message: result.reason || 'You can enable notifications later from Settings.', tone: 'warning', icon: 'warning' });
      }
      await setJson(keys.onboarded, true);
      router.replace('/dashboard');
    } catch (error: any) {
      showDialog({ title: 'Notification permission', message: error?.message || 'You can enable notifications later from Settings.', tone: 'warning', icon: 'warning' });
    } finally { setLoading(false); }
  }

  return <Screen>
    <TopNav title="NumMigrate GM" />
    <View style={{ minHeight: 560, justifyContent: 'center' }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 104, height: 104, borderRadius: 30, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="notification" color={colors.primary} size={42} /></View>
        </View>
        <Text style={[styles.eyebrow, { marginTop: 22 }]}>Stay informed</Text>
        <Text style={[styles.largeTitle, { textAlign: 'center', marginTop: 10 }]}>Allow Notifications</Text>
        <Text style={[styles.body, { textAlign: 'center', marginTop: 12, maxWidth: 430 }]}>Get important migration updates, payment confirmations, service notices, and official numbering announcements.</Text>
      </View>
      <Card style={{ gap: 12, marginTop: 24 }}>
        {['Important migration updates', 'Payment and access confirmations', 'Official service announcements'].map((item) => <View key={item} style={[styles.row, { gap: 12 }]}><AppIcon name="check" color={colors.success} size={17}/><Text style={{ color: colors.text, fontWeight: '800', flex: 1 }}>{item}</Text></View>)}
      </Card>
      <NoticeCard title="You are in control" text="You can turn notifications off at any time in your phone settings. Your contacts are never included in notifications." tone="blue" icon="shield" />
    </View>
    <Button title="Allow Notifications" icon="notification" loading={loading} disabled={loading} onPress={() => finish(true)} />
    <Button title="Not Now" variant="ghost" disabled={loading} onPress={() => finish(false)} style={{ marginTop: 8 }} />
    <Dialog />
  </Screen>;
}
