import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { randomUUID } from 'expo-crypto';

const KEY_FINGERPRINT = 'gnm_device_fingerprint';
const KEY_DEVICE_SECRET = 'gnm_device_secret';
let cachedFingerprint: string | null = null;
let cachedDeviceSecret: string | null = null;

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

  // App-scoped random identity avoids collecting a platform hardware identifier
  // and prevents a reinstall from inheriting a server credential it cannot recover.
  const id = randomUUID();

  await AsyncStorage.setItem(KEY_FINGERPRINT, id).catch(() => undefined);
  cachedFingerprint = id;
  return id;
}

export async function getDeviceSecret(): Promise<string | null> {
  if (cachedDeviceSecret) return cachedDeviceSecret;
  cachedDeviceSecret = await AsyncStorage.getItem(KEY_DEVICE_SECRET).catch(() => null);
  return cachedDeviceSecret;
}

export async function storeDeviceSecret(deviceSecret: string): Promise<void> {
  if (!deviceSecret) return;
  await AsyncStorage.setItem(KEY_DEVICE_SECRET, deviceSecret);
  cachedDeviceSecret = deviceSecret;
}

export function getDeviceInfo() {
  return {
    deviceName: Device.deviceName ?? null,
    deviceModel: Device.modelName ?? null,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    platform: Platform.OS,
    appVersion: Application.nativeApplicationVersion ?? '1.0.0',
    buildNumber: Application.nativeBuildVersion ?? null
  };
}
