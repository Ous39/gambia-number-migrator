import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerDevice, registerPushToken } from './api';
import { getDeviceFingerprint, getDeviceInfo } from './deviceService';
import { keys, setJson } from './storage';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });

export type NotificationSetupResult = { enabled: boolean; reason?: string; updatedAt: string };

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
