import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerDevice, registerPushToken, setNotificationPreference } from './api';
import { getDeviceFingerprint, getDeviceInfo } from './deviceService';
import { getJson, keys, setJson } from './storage';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });

export type NotificationSetupResult = { enabled: boolean; reason?: string; updatedAt: string };

export async function getNotificationStatus(): Promise<NotificationSetupResult> {
  const saved = await getJson<NotificationSetupResult | null>(keys.notificationStatus, null);
  if (Platform.OS === 'web' || !Device.isDevice) return saved || { enabled: false, reason: 'A physical Android or iPhone is required.', updatedAt: new Date().toISOString() };
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    return { enabled: false, reason: permission.canAskAgain === false ? 'Notifications are blocked in your phone settings.' : 'Notifications are off.', updatedAt: new Date().toISOString() };
  }
  return saved?.enabled ? saved : { enabled: false, reason: 'Notifications are allowed by the phone but are not enabled for this app yet.', updatedAt: new Date().toISOString() };
}

async function finish(result: Omit<NotificationSetupResult, 'updatedAt'>) {
  const value = { ...result, updatedAt: new Date().toISOString() };
  await setJson(keys.notificationStatus, value).catch(() => undefined);
  return value;
}

export async function setupNotifications(): Promise<NotificationSetupResult> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return finish({ enabled: false, reason: 'A physical Android or iPhone is required.' });
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('general', { name: 'Important updates', description: 'Migration and service announcements', importance: Notifications.AndroidImportance.MAX, sound: 'default', enableVibrate: true, vibrationPattern: [0, 250, 180, 250], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, showBadge: true, bypassDnd: false });
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    if (permission.status !== 'granted') return finish({ enabled: false, reason: permission.canAskAgain === false ? 'Notifications are blocked in phone settings.' : 'Notification permission was not granted.' });
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId || (Constants as any).easConfig?.projectId;
    if (!projectId) return finish({ enabled: false, reason: 'The EAS project ID is missing from this build.' });
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!/^ExponentPushToken\[[^\]]+\]$|^ExpoPushToken\[[^\]]+\]$/.test(token)) return finish({ enabled: false, reason: 'The push service returned an invalid device token.' });
    const deviceId = await getDeviceFingerprint();
    const registered = await registerDevice(deviceId, getDeviceInfo());
    if (!registered) return finish({ enabled: false, reason: 'The app server could not register this device.' });
    await registerPushToken(deviceId, token, Platform.OS as 'android' | 'ios');
    return finish({ enabled: true });
  } catch (error: any) {
    return finish({ enabled: false, reason: error?.message || 'Notification setup failed.' });
  }
}

export async function disableNotifications(): Promise<NotificationSetupResult> {
  try {
    if (Platform.OS !== 'web' && Device.isDevice) {
      const deviceId = await getDeviceFingerprint();
      await setNotificationPreference(deviceId, false);
      await Notifications.setBadgeCountAsync(0).catch(() => undefined);
    }
    return finish({ enabled: false, reason: 'Notifications are turned off. You can enable them again from Settings.' });
  } catch (error: any) {
    return finish({ enabled: false, reason: error?.message || 'Could not update notification preferences.' });
  }
}
