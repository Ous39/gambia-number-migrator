import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerDevice, registerPushToken } from './api';
import { getDeviceFingerprint, getDeviceInfo } from './deviceService';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });

export async function setupNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) return { enabled: false, reason: 'physical-device-required' };
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('general', { name: 'General updates', description: 'Important migration and service announcements', importance: Notifications.AndroidImportance.HIGH, sound: 'default', enableVibrate: true, vibrationPattern: [0, 250, 180, 250], lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, showBadge: true });
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (permission.status !== 'granted') return { enabled: false, reason: 'permission-denied' };
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.expoConfig?.extra?.eas?.projectId || (Constants as any).easConfig?.projectId;
  if (!projectId) return { enabled: false, reason: 'eas-project-id-required' };
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  const deviceId = await getDeviceFingerprint();
  await registerDevice(deviceId, getDeviceInfo());
  await registerPushToken(deviceId, token, Platform.OS as 'android' | 'ios');
  return { enabled: true, token };
}
