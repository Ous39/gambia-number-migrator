import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../src/components/Button';
import { Card, NoticeCard, Screen, StepDots, TopNav, useAppDialog } from '../src/components/UI';
import { AppIcon } from '../src/components/AppIcon';
import { ensureContactPermission } from '../src/services/contactsService';
import { keys, setJson } from '../src/services/storage';
import { getTone, useAppTheme, useResponsive } from '../src/appTheme';

const pages = [
  {
    tag: 'Number reform',
    icon: '7→9',
    title: 'Phone Numbers Are Changing',
    text: 'Gambian phone numbers are changing from 7 digits to 9 digits. This app helps update the numbers saved on your phone.',
    note: 'Example: the correct two digits are added to the old number.',
  },
  {
    tag: 'Guided update',
    icon: 'update',
    title: 'Scan, Check, Then Update',
    text: 'First scan your contacts. Next check every change. The app updates contacts only after you press Confirm.',
    note: 'Nothing changes without your confirmation.',
  },
  {
    tag: 'Privacy first',
    icon: 'lock',
    title: 'Your Contacts Stay Private',
    text: 'Your contact names and phone numbers stay on your phone. They are not uploaded to our server.',
    note: 'Contacts access is used only to scan and update your phonebook.',
  },
];

export default function Onboarding() {
  const { colors, styles } = useAppTheme();
  const { showDialog, Dialog } = useAppDialog();
  const r = useResponsive();
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const tone = getTone(colors, index === 2 ? 'blue' : index === 1 ? 'teal' : 'primary');

  async function finish(requestPermission = true) {
    try {
      if (requestPermission) await ensureContactPermission();
    } catch (e: any) {
      if (requestPermission) showDialog({ title: 'Contacts permission', message: e?.message || 'You can allow contacts access later from the dashboard.', tone: 'warning', icon: 'warning' });
    }
    await setJson(keys.onboarded, true);
    router.replace('/notification-permission');
  }

  function next() {
    if (index < pages.length - 1) setIndex(index + 1);
    else finish(true);
  }

  return (
    <Screen>
      <TopNav title="Gambia Number Migrator" compact right={<TouchableOpacity accessibilityRole="button" accessibilityLabel="Skip introduction" onPress={() => finish(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: colors.primary, fontWeight: '900' }}>Skip</Text></TouchableOpacity>} />
      <View style={{ minHeight: r.compact ? 450 : 560, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: r.compact ? 138 : 174, height: r.compact ? 138 : 174, borderRadius: r.compact ? 69 : 87, backgroundColor: tone.bg, borderWidth: 1, borderColor: tone.border, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: r.compact ? 92 : 116, height: r.compact ? 92 : 116, borderRadius: 28, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 3 }}>
              <AppIcon name={page.icon} color={tone.fg} size={index === 0 ? 26 : 34} />
            </View>
          </View>
          <Text style={[styles.eyebrow, { marginTop: 20, color: tone.fg }]}>{page.tag}</Text>
          <Text style={[styles.largeTitle, { textAlign: 'center', marginTop: 10, color: colors.title }]}>{page.title}</Text>
          <Text style={[styles.body, { textAlign: 'center', marginTop: 12, maxWidth: 430 }]}>{page.text}</Text>
        </View>
        <NoticeCard title="Good to know" text={page.note} tone={index === 2 ? 'blue' : 'primary'} icon="info" />
        {index === 2 ? (
          <Card style={{ gap: 12 }}>
            {[['Contacts stay local', 'No uploads, no analytics, no tracking.'], ['Review first', 'You approve all changes before updating.'], ['Backup protected', 'A local backup is created before changes.']].map(([title, text]) => (
              <View key={title} style={[styles.row, { gap: 12 }]}> 
                <AppIcon name="check" color={colors.success} size={16} />
                <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{title}</Text><Text style={styles.small}>{text}</Text></View>
              </View>
            ))}
          </Card>
        ) : null}
      </View>
      <StepDots count={pages.length} active={index} />
      <Button title={index === pages.length - 1 ? 'Allow Contacts Access' : 'Next'} icon={index === pages.length - 1 ? 'lock' : 'right'} onPress={next} style={{ marginTop: 22 }} />
      {index === pages.length - 1 ? <Button title="Not Now" variant="ghost" onPress={() => finish(false)} style={{ marginTop: 8 }} /> : null}
      <Dialog />
    </Screen>
  );
}
