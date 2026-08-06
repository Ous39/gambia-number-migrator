import React, { useEffect } from 'react';
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
    import('expo-notifications').then((Notifications) => {
      Notifications.getLastNotificationResponseAsync().then((last) => {
        if (last?.notification) { Notifications.setBadgeCountAsync(0).catch(() => undefined); router.push('/notifications'); }
      }).catch(() => undefined);
      const subscription = Notifications.addNotificationResponseReceivedListener(() => {
        Notifications.setBadgeCountAsync(0).catch(() => undefined);
        router.push('/notifications');
      });
      remove = () => { subscription.remove(); };
    }).catch(() => undefined);
    return () => remove?.();
  }, []);
  return (
    <AppThemeProvider>
      <Slot />
    </AppThemeProvider>
  );
}
