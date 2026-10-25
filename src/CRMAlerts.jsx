import React,{useEffect,useState} from 'react';
import {crmToday,crmDueTasks} from './crmUtils.js';
const localISO=crmToday;
export default function CRMAlerts({supabase,onNavigate}){
 const [items,setItems]=useState([]),[contacts,setContacts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  const [tasks,people]=await Promise.all([
   supabase.from('crm_tarefas_teste').select('id,contato_id,titulo,vencimento,situacao').eq('situacao','pendente').order('vencimento',{ascending:true}).limit(100),
   supabase.from('crm_contatos_teste').select('id,nome,etapa').order('created_at',{ascending:false}).limit(500)
  ]);
  if(tasks.error||people.error){setError('Os lembretes do CRM ainda não estão disponíveis. A migração do banco de testes pode estar pendente.');setItems([]);setContacts([]);}
  else {setItems(tasks.data||[]);setContacts(people.data||[]);}
  setLoading(false);
 }
 useEffect(()=>{refresh();},[supabase]);
 const now=localISO(),due=crmDueTasks(items,now),names=new Map(contacts.map(c=>[c.id,c.nome]));
 return <div className="premium-panel dashboard-appointments">
  <div className="dashboard-agenda-title"><div><h3>CRM · Pendências do atendimento</h3><p>Contatos e lembretes para acompanhar hoje.</p></div><button type="button" className="gold-button" onClick={()=>onNavigate('CRM')}>Abrir CRM →</button></div>
  {error&&<p className="form-message" role="status">{error}</p>}
  <div className="dashboard-kpis">
   <div className="dashboard-kpi"><small>Para hoje ou atrasados</small><strong>{loading?'…':due.length}</strong></div>
   <div className="dashboard-kpi"><small>Novos interessados</small><strong>{loading?'…':contacts.filter(c=>c.etapa==='novo').length}</strong></div>
   <div className="dashboard-kpi"><small>Todos os lembretes pendentes</small><strong>{loading?'…':items.length}</strong></div>
  </div>
  {!loading&&!error&&(due.length===0?<p className="record-empty">Nenhum contato pendente para hoje.</p>:<div className="calendar-entries">
   {due.slice(0,5).map(t=><div className="calendar-entry" key={t.id}>
    <div className="calendar-entry-time"><strong>{t.vencimento.split('-').reverse().join('/')}</strong></div>
    <div className="calendar-entry-detail"><strong>{names.get(t.contato_id)||'Contato'}</strong><span>{t.titulo}</span></div>
    <button type="button" className="outline-gold" onClick={()=>onNavigate('CRM')}>Abrir</button>
   </div>)}
  </div>)}
  <p className="profile-notice">Lembretes internos apenas. Nenhum WhatsApp será enviado automaticamente.</p>
 </div>;
}
