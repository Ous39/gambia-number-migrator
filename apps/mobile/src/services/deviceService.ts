import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

const KEY_FINGERPRINT = 'gnm_device_fingerprint';
let cachedFingerprint: string | null = null;

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns a stable, privacy-safe device reference used for payment/unlock status.
 * It never includes contact names, phone numbers, or any phonebook data.
 */
export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint;

  const stored = await AsyncStorage.getItem(KEY_FINGERPRINT).catch(() => null);
  if (stored) {
    cachedFingerprint = stored;
    return stored;
  }

  let id = uuidv4();
  if (Platform.OS === 'ios') {
    try {
      const Application = await import('expo-application');
      id = (await Application.getIosIdForVendorAsync()) || id;
    } catch {
      // keep generated UUID
    }
  } else if (Platform.OS === 'android') {
    try {
      const Application = await import('expo-application');
      id = Application.getAndroidId() || id;
    } catch {
      // keep generated UUID
    }
  }

  await AsyncStorage.setItem(KEY_FINGERPRINT, id).catch(() => undefined);
  cachedFingerprint = id;
  return id;
}

export function getDeviceInfo() {
  return {
    deviceName: Device.deviceName ?? null,
    deviceModel: Device.modelName ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    platform: Platform.OS,
    appVersion: Application.nativeApplicationVersion ?? '2.8.0'
  };
}
