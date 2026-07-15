import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { router } from 'expo-router';
import { syncConfig, syncRules, syncTransition } from '../src/services/api';
import { getJson, keys } from '../src/services/storage';
import { useAppTheme } from '../src/appTheme';
import { AppIcon } from '../src/components/AppIcon';

export default function Splash() {
  const { colors, styles } = useAppTheme();
  useEffect(() => {
    const timer = setTimeout(() => {
      (async () => {
        await Promise.allSettled([syncRules(), syncTransition(), syncConfig()]);
        const onboarded = await getJson(keys.onboarded, false);
        router.replace(onboarded ? '/dashboard' : '/onboarding');
      })();
    }, 750);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={[styles.screen, { alignItems: 'center', justifyContent: 'center', padding: 24, overflow: 'hidden' }]}> 
      <View style={{ position: 'absolute', top: -120, right: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.primarySoft }} />
      <View style={{ position: 'absolute', bottom: -120, left: -120, width: 300, height: 300, borderRadius: 150, backgroundColor: colors.secondarySoft }} />
      <View style={{ width: 112, height: 112, borderRadius: 32, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 6 }}>
        <AppIcon name="update" color={colors.primary} size={44} />
      </View>
      <Text style={[styles.largeTitle, { marginTop: 24, textAlign: 'center', color: colors.title }]}>Gambia Number{`\n`}Migrator</Text>
      <Text style={[styles.body, { marginTop: 10, textAlign: 'center' }]}>Smart. Secure. Seamless.</Text>
      <ActivityIndicator color={colors.primary} style={{ marginTop: 38 }} />
      <Text style={[styles.small, { position: 'absolute', bottom: 32, textAlign: 'center' }]}>Contacts stay on your device</Text>
    </View>
  );
}
