import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BackHeader, Card, EmptyState, NoticeCard, Screen } from '../src/components/UI';
import { Button } from '../src/components/Button';
import { AppIcon } from '../src/components/AppIcon';
import { getNotifications } from '../src/services/api';
import { getDeviceFingerprint } from '../src/services/deviceService';
import { getJson, setJson, keys } from '../src/services/storage';
import { useAppTheme, useResponsive } from '../src/appTheme';
import { setupNotifications } from '../src/services/notificationService';

export default function NotificationInbox() {
  const { colors, styles } = useAppTheme();
  const responsive = useResponsive();
  const [items, setItems] = useState<any[]>([]); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState<any>(null); const [enabling, setEnabling] = useState(false);
  const load = useCallback(async () => { try { const list = await getNotifications(await getDeviceFingerprint()); setItems(list); await setJson(keys.notifications, list); setError(''); } catch (e: any) { setItems(await getJson<any[]>(keys.notifications, [])); setError(e?.message || 'Showing saved notifications while offline.'); } }, []);
  useFocusEffect(useCallback(() => { load(); getJson<any>(keys.notificationStatus, null).then(setPushStatus); }, [load]));
  async function enablePush() { setEnabling(true); const result = await setupNotifications(); setPushStatus(result); setEnabling(false); }
  return <Screen padded={false} scroll={false}><BackHeader title="Notifications" subtitle="Updates sent by the administrator." compact />
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);await load();setRefreshing(false);}} />} contentContainerStyle={[styles.scrollContent,{paddingHorizontal:responsive.horizontalPadding,paddingTop:14,paddingBottom:36,width:'100%',maxWidth:responsive.maxWidth as any,alignSelf:'center'}]}>
      <NoticeCard title={pushStatus?.enabled ? 'Push notifications enabled' : 'Push notifications need attention'} text={pushStatus?.enabled ? 'This device is registered for important alerts. Pull down to refresh the in-app inbox at any time.' : pushStatus?.reason || 'Tap Enable Notifications to register this device.'} tone={pushStatus?.enabled ? 'success' : 'warning'} icon={pushStatus?.enabled ? 'check' : 'warning'} />
      {!pushStatus?.enabled ? <Button title="Enable Notifications" icon="notification" loading={enabling} disabled={enabling} onPress={enablePush} style={{ marginBottom: 14, minHeight: 54 }} /> : null}
      {error ? <Card><Text style={{color:colors.warning,fontWeight:'800'}}>{error}</Text></Card> : null}
      {!items.length ? <EmptyState icon="notification" title="No notifications" text="Important migration and service updates will appear here." /> : items.map((item) => <Card key={item.id} elevated style={{marginBottom:12}}><View style={[styles.row,{gap:12}]}><View style={{width:46,height:46,borderRadius:18,backgroundColor:colors.primarySoft,alignItems:'center',justifyContent:'center'}}><AppIcon name="notification" color={colors.primary} size={22}/></View><View style={{flex:1}}><Text style={{color:colors.text,fontSize:17,fontWeight:'900'}}>{item.title}</Text><Text style={[styles.body,{marginTop:4}]}>{item.message}</Text><Text style={[styles.small,{marginTop:8}]}>{new Date(item.sent_at || item.created_at).toLocaleString()}</Text></View></View></Card>)}
    </ScrollView></Screen>;
}
