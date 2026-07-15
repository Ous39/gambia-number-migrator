import { StyleSheet } from 'react-native';
export const colors = { primary:'#0EA47A', bg:'#F7F8FA', text:'#1A1A2E', muted:'#6B7280', card:'#FFFFFF', danger:'#DC2626', border:'#E5E7EB' };
export const styles = StyleSheet.create({
  screen:{ flex:1, backgroundColor:colors.bg, padding:20 },
  title:{ fontSize:30, fontWeight:'800', color:colors.text, marginBottom:8 },
  subtitle:{ fontSize:15, color:colors.muted, lineHeight:22 },
  card:{ backgroundColor:colors.card, borderRadius:22, padding:18, marginVertical:8, borderWidth:1, borderColor:colors.border },
  btn:{ backgroundColor:colors.primary, paddingVertical:14, paddingHorizontal:16, borderRadius:16, alignItems:'center', marginVertical:6 },
  btnText:{ color:'white', fontWeight:'800', fontSize:16 },
  btnSecondary:{ backgroundColor:'#EAF8F3' },
  btnSecondaryText:{ color:'#08785A', fontWeight:'800' },
  metric:{ flex:1, minWidth:145, backgroundColor:'white', borderRadius:18, padding:14, borderWidth:1, borderColor:colors.border },
  metricValue:{ fontSize:24, fontWeight:'900', color:colors.text },
  input:{ backgroundColor:'white', borderColor:colors.border, borderWidth:1, borderRadius:14, padding:12, marginVertical:8 },
  row:{ flexDirection:'row', gap:10, flexWrap:'wrap' },
  badge:{ alignSelf:'flex-start', backgroundColor:'#EAF8F3', color:'#08785A', paddingVertical:4, paddingHorizontal:8, borderRadius:999, overflow:'hidden', fontWeight:'700' }
});
