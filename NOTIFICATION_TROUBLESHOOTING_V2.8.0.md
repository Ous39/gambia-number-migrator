# Notification Troubleshooting v2.8.0

1. Use a physical device. Push delivery is not a reliable Expo Go, simulator, or emulator acceptance test.
2. Grant notification permission and confirm the device registered an Expo push token.
3. Use a development or production build with the configured Expo project.
4. On Android, confirm the `general` channel, sound, vibration, lock-screen permission, battery optimization, and app notification settings.
5. On iOS, confirm APNs credentials, Push Notifications capability, background mode where required, and permission status.
6. In Admin, send a short test to a narrow audience and inspect sent/failed totals.
7. Refresh the token after reinstall or token rotation; inactive/expired tokens must be cleaned up.
8. Test foreground receipt, background receipt, terminated-state tap, inbox/read state, and deep link separately.

Expo Go is for limited development. A development build exercises native configuration. Production builds require valid FCM/APNs credentials. Simulators do not replace physical-device delivery testing.
