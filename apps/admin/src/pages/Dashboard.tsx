import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, CreditCard, Network, RadioTower, ShieldCheck, UsersRound, type LucideIcon } from 'lucide-react';
import { api, getAdmin } from '../api/client';

export default function Dashboard() {
  const [data,setData]=useState<any>(null); const [error,setError]=useState(''); const admin=getAdmin();
  useEffect(()=>{api<any>('/admin/dashboard').then(r=>setData(r.data)).catch((err:any)=>setError(err.message));},[]);
  const transition=data?.currentTransitionSettings;
  const metrics:Array<[string,string,LucideIcon,string]>=[
    ['Total rules',String(data?.totalRules??0),Network,'violet'],['Active rules',String(data?.activeRules??0),CheckCircle2,'success'],
    ['Operators',String(data?.operators??0),RadioTower,'blue'],['Payments today',String(data?.paymentsToday??0),CreditCard,'gold'],
  ];
  return <div className="dashboardPage">
    <div className="dashboardTop"><div><span className="eyebrow">OCEANBROWN OPERATIONS</span><h1>Welcome back, {admin?.fullName?.split(' ')[0]||admin?.username||'Owner'}</h1><p>Monitor the migration service and manage what reaches mobile devices.</p></div><div className="privacyStatus"><ShieldCheck size={20}/><span><b>Privacy protected</b><small>Contacts stay on users’ phones</small></span></div></div>
    {error&&<p className="notice errorNotice">{error}</p>}
    <section className="dashboardHero"><div><span className="heroKicker">PURA PHASE 1 · PRODUCTION CONTROL</span><h2>Safe number migration, managed from one place.</h2><p>Publish verified operator rules, control the transition period, support paid users and review every administrative action.</p><div className="heroActions"><NavLink className="heroButton" to="/rules">Review migration rules <ArrowRight size={18}/></NavLink><NavLink className="heroLink" to="/audit">View audit trail</NavLink></div></div><div className="heroSeal"><ShieldCheck size={42}/><strong>12</strong><span>verified rules</span></div></section>
    <section className="metricGrid">{metrics.map(([label,value,Icon,tone])=><article className="metricCard" key={label}><div className={`metricIcon ${tone}`}><Icon size={23} strokeWidth={2.2}/></div><div><span>{label}</span><strong>{value}</strong><small>{label==='Active rules'?'Ready for mobile sync':label==='Payments today'?'Confirmed today':'System total'}</small></div></article>)}</section>
    <section className="dashboardColumns">
      <article className="panel transitionPanel"><div className="panelHeading"><div><span className="eyebrow">LIVE CONFIGURATION</span><h2>Current transition</h2></div><CalendarDays size={24}/></div><div className="transitionState"><span className="statusDot"/><div><b>{transition?.defaultUpdateMode?'Configured and active':'Configuration unavailable'}</b><small>Default mode: {transition?.defaultUpdateMode||'duplicate'}</small></div></div><div className="dateRange"><div><span>START DATE</span><strong>{formatDate(transition?.transitionStartDate)}</strong></div><div className="dateLine"/><div><span>PARALLEL RUNNING ENDS</span><strong>{formatDate(transition?.transitionEndDate)}</strong></div></div><NavLink className="panelLink" to="/transition">Manage transition settings <ArrowRight size={17}/></NavLink></article>
      <article className="panel workflowPanel"><div className="panelHeading"><div><span className="eyebrow">RELEASE WORKFLOW</span><h2>Production checklist</h2></div><Activity size={24}/></div><Workflow n="1" title="Verify operator rules" done={Number(data?.activeRules)>0}/><Workflow n="2" title="Test official number samples" done={Number(data?.activeRules)===12}/><Workflow n="3" title="Publish and sync mobile rules" done={Boolean(data?.lastRulesPublishDate)}/><Workflow n="4" title="Enable free launch campaign" done={data?.campaignMode==='all'||data?.campaignMode==='first_n'}/></article>
    </section>
    <section className="panel activityPanel"><div className="panelHeading"><div><span className="eyebrow">SECURITY & ACCOUNTABILITY</span><h2>Recent activity</h2></div><NavLink className="panelLink" to="/audit">All activity <ArrowRight size={17}/></NavLink></div>{data?.recentActivity?.length?<div className="activityList">{data.recentActivity.slice(0,6).map((a:any,i:number)=><div className="activityRow" key={i}><div className="activityIcon"><UsersRound size={18}/></div><div><strong>{humanize(a.action)}</strong><span>{a.username||'System'} · {a.entity_type}</span></div><time>{new Date(a.created_at).toLocaleString()}</time></div>)}</div>:<p className="emptyMessage">No administrative activity has been recorded yet.</p>}</section>
  </div>;
}
function Workflow({n,title,done}:{n:string;title:string;done:boolean}){return <div className="workflowRow"><span className={done?'done':''}>{done?<CheckCircle2 size={17}/>:n}</span><div><strong>{title}</strong><small>{done?'Completed':'Action required before launch'}</small></div></div>}
function formatDate(value?:string){if(!value)return 'Not set';return new Date(`${value}T00:00:00`).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'});}
function humanize(value:string){return String(value||'system_event').replace(/_/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase());}
