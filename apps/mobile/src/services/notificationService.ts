import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { registerDevice, registerPushToken, setNotificationPreference } from './api';
import { getDeviceFingerprint, getDeviceInfo } from './deviceService';
import { getJson, keys, setJson } from './storage';

export type NotificationSetupResult = { enabled: boolean; reason?: string; updatedAt: string };
let handlerReady = false;
const isExpoGo = () => Constants.appOwnership === 'expo' || String((Constants as any).executionEnvironment || '').toLowerCase() === 'storeclient';

async function notifications() {
  if (isExpoGo()) return null;
  const module = await import('expo-notifications');
  if (!handlerReady) {
    module.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });
    handlerReady = true;
  }
  return module;
}

async function finish(result: Omit<NotificationSetupResult, 'updatedAt'>) {
  const value = { ...result, updatedAt: new Date().toISOString() };
  await setJson(keys.notificationStatus, value).catch(() => undefined);
  return value;
}

export async function getNotificationStatus(): Promise<NotificationSetupResult> {
  const saved = await getJson<NotificationSetupResult | null>(keys.notificationStatus, null);
  if (Platform.OS === 'web' || !Device.isDevice) return saved || { enabled: false, reason: 'A physical Android or iPhone is required.', updatedAt: new Date().toISOString() };
  if (isExpoGo()) return { enabled: false, reason: 'Push notifications require the GNM development or store build. Expo Go can test the rest of the app.', updatedAt: new Date().toISOString() };
  const Notifications = await notifications();
  if (!Notifications) return finish({ enabled: false, reason: 'Notifications are unavailable.' });
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return { enabled: false, reason: permission.canAskAgain === false ? 'Notifications are blocked in your phone settings.' : 'Notifications are off.', updatedAt: new Date().toISOString() };
  return saved?.enabled ? saved : { enabled: false, reason: 'Notifications are allowed by the phone but are not enabled for this app yet.', updatedAt: new Date().toISOString() };
}

export async function setupNotifications(): Promise<NotificationSetupResult> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return finish({ enabled: false, reason: 'A physical Android or iPhone is required.' });
    if (isExpoGo()) return finish({ enabled: false, reason: 'Push notifications require a GNM development build or store build.' });
    const Notifications = await notifications();
    if (!Notifications) return finish({ enabled: false, reason: 'Notifications are unavailable.' });
    if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('general', { name: 'Important updates', description: 'Migration and service announcements', importance: Notifications.AndroidImportance.MAX, sound: 'default', enableVibrate: true, vibrationPattern: [0, 250, 180, 250], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, showBadge: true, bypassDnd: false });
    const existing = await Notifications.getPermissionsAsync();
    const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
    if (permission.status !== 'granted') return finish({ enabled: false, reason: permission.canAskAgain === false ? 'Notifications are blocked in phone settings.' : 'Notification permission was not granted.' });
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId || (Constants as any).easConfig?.projectId;
    if (!projectId) return finish({ enabled: false, reason: 'The EAS project ID is missing from this build.' });
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const deviceId = await getDeviceFingerprint();
    if (!await registerDevice(deviceId, getDeviceInfo())) return finish({ enabled: false, reason: 'The app server could not register this device.' });
    await registerPushToken(deviceId, token, Platform.OS as 'android' | 'ios');
    return finish({ enabled: true });
  } catch (error: any) { return finish({ enabled: false, reason: error?.message || 'Notification setup failed.' }); }
}

export async function disableNotifications(): Promise<NotificationSetupResult> {
  try {
    if (Platform.OS !== 'web' && Device.isDevice && !isExpoGo()) {
      const Notifications = await notifications();
      await setNotificationPreference(await getDeviceFingerprint(), false);
      if (Notifications) await Notifications.setBadgeCountAsync(0).catch(() => undefined);
    }
    return finish({ enabled: false, reason: 'Notifications are turned off. You can enable them again from Settings.' });
  } catch (error: any) { return finish({ enabled: false, reason: error?.message || 'Could not update notification preferences.' }); }
}

export async function notifyLocalCompletion(title: string, body: string, data: Record<string, string> = {}) {
  if (Platform.OS === 'web' || !Device.isDevice || isExpoGo()) return false;
  try {
    const Notifications = await notifications();
    if (!Notifications || (await Notifications.getPermissionsAsync()).status !== 'granted') return false;
    await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: 'default' }, trigger: null });
    return true;
  } catch { return false; }
}
