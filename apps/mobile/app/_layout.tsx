import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Slot } from 'expo-router';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { AppThemeProvider } from '../src/appTheme';

// Keep the native splash visible until the first application frame is ready.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  useEffect(() => {
    // Expo Go no longer supports remote push on SDK 53+. Load notifications only
    // in development/production builds so local Expo Go testing stays warning-free.
    if (Constants.appOwnership === 'expo') return;
    let remove: (() => void) | undefined;
    Promise.all([import('expo-notifications'), import('../src/services/notificationService')]).then(([Notifications, service]) => {
      const register = () => service.setupNotifications().catch(() => undefined);
      register();
      Notifications.getLastNotificationResponseAsync().then((last) => {
        if (last?.notification) { Notifications.setBadgeCountAsync(0).catch(() => undefined); router.push('/notifications'); }
      }).catch(() => undefined);
      const subscription = Notifications.addNotificationResponseReceivedListener(() => {
        Notifications.setBadgeCountAsync(0).catch(() => undefined);
        router.push('/notifications');
      });
      const appStateSubscription = AppState.addEventListener('change', (state) => { if (state === 'active') register(); });
      remove = () => { subscription.remove(); appStateSubscription.remove(); };
    }).catch(() => undefined);
    return () => remove?.();
  }, []);
  return (
    <AppThemeProvider>
      <Slot />
    </AppThemeProvider>
  );
}
