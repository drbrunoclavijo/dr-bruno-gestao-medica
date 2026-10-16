import React,{useEffect,useState} from 'react';
import {useAppointments,localDate,shiftDay,displayDate,appointmentTypes,statuses} from './ClinicCalendar.jsx';
import StockAlerts from './StockAlerts.jsx';

// Apenas dados fictícios: nenhum custo, valor de protocolo ou medicamento à equipe administrativa.
const tz='America/Sao_Paulo';
const localISO=(date=new Date())=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const values=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return values.year+'-'+values.month+'-'+values.day;
};
const move=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const ptDate=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'—';
const tabs=[['hoje','Hoje'],['amanha','Amanhã'],['semana','Próximos 7 dias'],['atrasadas','Atrasadas'],['todas','Todas pendentes']];
const summary=(title,value,note)=> <div className="dashboard-kpi" key={title}><small>{title}</small><strong>{value}</strong>{note&&<span>{note}</span>}</div>;

export default function ClinicDashboard({supabase,role,onNavigate}){
 const clinical=role==='medico'||role==='enfermeira';
 const dateNow=localDate();
 const {rows:appointments,loading:appointmentsLoading,error:appointmentsError,refresh:refreshAppointments}=useAppointments(supabase,dateNow,shiftDay(dateNow,7));
 const todaysAppointments=appointments.filter(a=>a.inicio_local.slice(0,10)===dateNow&&a.status!=='cancelado');
 const nextAppointments=appointments.filter(a=>a.status==='agendado'||a.status==='confirmado'||a.status==='reagendamento_solicitado').sort((a,b)=>a.inicio_local.localeCompare(b.inicio_local));
 const [adminApplications,setAdminApplications]=useState([]),[adminApplicationsError,setAdminApplicationsError]=useState('');
 const [pendingRequests,setPendingRequests]=useState([]),[pendingRequestsError,setPendingRequestsError]=useState('');
 useEffect(()=>{
  if(role!=='equipe')return;
  let active=true;
  supabase.rpc('listar_pendencias_agenda_teste').then(({data,error})=>{
   if(!active)return;
   if(error)setPendingRequestsError('Pendências de reagendamento indisponíveis: '+error.message);
   else{setPendingRequests(data||[]);setPendingRequestsError('');}
  });
  return()=>{active=false;};
 },[role]);
 useEffect(()=>{
  if(role!=='equipe')return;
  let active=true;
  supabase.rpc('agenda_aplicacoes_administrativa_teste',{p_de:dateNow,p_ate:shiftDay(dateNow,7)})
    .then(({data,error})=>{if(!active)return;if(error)setAdminApplicationsError('Agenda de aplicações indisponível: '+error.message);
     else{setAdminApplications(data||[]);setAdminApplicationsError('');}});
  return()=>{active=false;};
 },[role,dateNow]);
 const [protocols,setProtocols]=useState([]),[sessions,setSessions]=useState([]),[patientCount,setPatientCount]=useState(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('hoje'),[query,setQuery]=useState('');
 async function load(){
  setLoading(true);setError('');
  try{
   if(clinical){
    const [p,s]=await Promise.all([
     supabase.rpc('protocolos_operacionais_enfermagem_teste'),
     supabase.rpc('sessoes_operacionais_enfermagem_teste')
    ]);
    if(p.error||s.error)throw p.error||s.error;
    setProtocols(p.data||[]);setSessions(s.data||[]);
   }else if(role==='equipe'){
    // Somente contagem agregada, sem histórico médico, protocolo, prescrição ou agenda clínica.
    const {count,error:err}=await supabase.from('pacientes').select('id',{count:'exact',head:true});
    if(err)throw err;
    setPatientCount(count??0);
   }
  }catch(e){setError('Não foi possível atualizar o painel: '+(e.message||'erro desconhecido'));}
  finally{setLoading(false);}
 }
 useEffect(()=>{load();},[role]);
 const today=localISO(),tomorrow=move(today,1),endWeek=move(today,6);
 const active=protocols.filter(p=>p.status==='ativo');
 const activeIds=new Set(active.map(p=>p.protocolo_id));
 const patientByProtocol=new Map(protocols.map(p=>[p.protocolo_id,p]));
 const planned=sessions.filter(s=>activeIds.has(s.protocolo_id)&&s.status==='agendada');
 const unchecked=planned.filter(s=>!s.checado_em);
 const rows=unchecked.filter(s=>{
  const date=s.data_prevista;
  return filter==='hoje'?date===today:filter==='amanha'?date===tomorrow:
   filter==='semana'?date>=today&&date<=endWeek:
   filter==='atrasadas'?date<today:true;
 }).filter(s=>{
  const p=patientByProtocol.get(s.protocolo_id);
  return [p?.paciente_nome,p?.nome,s.descricao,s.medicamento].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
 }).sort((a,b)=>String(a.data_prevista).localeCompare(String(b.data_prevista))||String(a.sessao_id).localeCompare(String(b.sessao_id)));
 return <section className="clinic-dashboard">
  <div className="premium-panel dashboard-intro">
   <div className="panel-title"><span className="title-icon" aria-hidden="true">◈</span><div>
    <h3>Visão geral da clínica</h3><p>{role==='medico'?'Painel médico operacional':role==='enfermeira'?'Painel de enfermagem':'Painel administrativo'} · {ptDate(today)}</p>
   </div></div>
   <p className="profile-notice">Ambiente de testes com dados exclusivamente fictícios. Os agendamentos são datas previstas; não comprovam a administração. Os indicadores mostram apenas registros visíveis para seu perfil.</p>
   {error&&<p className="form-message" role="alert">{error}</p>}
   <div className="form-actions"><button className="outline-gold" type="button" onClick={load} disabled={loading}>{loading?'Atualizando...':'↻ Atualizar painel'}</button></div>
  </div>
  <div className="premium-panel dashboard-appointments">
    <div className="dashboard-agenda-title"><div><h3>{role==='medico'?'Minhas consultas — Dr. Bruno':role==='enfermeira'?'Meus atendimentos — Dra. Carol':'Agenda completa de consultas e atendimentos'}</h3><p>{role==='equipe'?'Todos os profissionais':'Somente os atendimentos associados ao seu usuário'} · {displayDate(dateNow)}</p></div>
      <button type="button" className="gold-button" onClick={()=>onNavigate('Agenda')}>Abrir agenda completa →</button></div>
    {appointmentsError&&<p className="form-message" role="alert">{appointmentsError}</p>}
    <div className="dashboard-kpis">
      {summary('Atendimentos hoje',appointmentsLoading?'…':todaysAppointments.length,'Inclui confirmados e realizados')}
      {summary('Aguardando confirmação',appointmentsLoading?'…':appointments.filter(a=>a.status==='agendado').length,'Próximos oito dias')}
    </div>
    {appointmentsLoading?<p>Carregando agendamentos...</p>:nextAppointments.length===0?<p className="record-empty">Nenhuma consulta pendente cadastrada para os próximos oito dias.</p>:
      <div className="calendar-entries">{nextAppointments.slice(0,8).map(a=><div key={a.id} className="calendar-entry">
       <div className="calendar-entry-time"><strong>{displayDate(a.inicio_local)}</strong><span>{a.inicio_local.slice(11,16)}</span></div>
       <div className="calendar-entry-detail"><strong>{a.paciente_nome}</strong><span>{appointmentTypes[a.tipo]} · {a.profissional_nome}</span><small>{statuses[a.status]}</small></div>
       <button type="button" className="outline-gold" onClick={()=>onNavigate('Agenda')}>Abrir</button>
      </div>)}</div>}
    <p className="profile-notice">Lembretes internos: acompanhe os atendimentos aqui ao abrir o aplicativo. Avisos automáticos ao profissional e confirmação por resposta do paciente ainda dependem de integração com mensageria.</p>
  </div>
  <StockAlerts supabase={supabase} onNavigate={onNavigate} compact/>
  {!clinical?<><div className="premium-panel dashboard-appointments">
   <div className="dashboard-agenda-title"><div><h3>Reagendamentos — Atenção, Amanda</h3>
    <p>Pedidos feitos por pacientes fictícios na simulação de confirmação.</p></div>
    <button type="button" className="gold-button" onClick={()=>onNavigate('Agenda')}>Abrir pendências →</button></div>
   {pendingRequestsError&&<p role="alert" className="form-message">{pendingRequestsError}</p>}
   <div className="dashboard-kpis">{summary('Solicitações pendentes',pendingRequestsError?'—':pendingRequests.length,'Entrar em contato para remarcar')}</div>
   {pendingRequests.slice(0,5).map(p=><div key={p.pendencia_id} className="calendar-entry">
    <div className="calendar-entry-time"><strong>{displayDate(p.inicio_local)}</strong><span>{p.inicio_local?.slice(11,16)}</span></div>
    <div className="calendar-entry-detail"><strong>{p.paciente_nome}</strong><span>{p.profissional_nome}</span><small>Reagendamento solicitado — aguardando contato</small></div>
    <button type="button" className="outline-gold" onClick={()=>onNavigate('Agenda')}>Abrir agenda</button>
   </div>)}
  </div><div className="premium-panel dashboard-agenda">
   <div className="dashboard-agenda-title"><div><h3>Agenda de aplicações — Visão administrativa</h3>
    <p>Todos os pacientes com sessão planejada, sem exibir medicamentos, doses ou prescrições.</p></div>
    <button type="button" className="outline-gold" onClick={()=>onNavigate('Agenda')}>Abrir agenda completa →</button></div>
   {adminApplicationsError&&<p role="alert" className="form-message">{adminApplicationsError}</p>}
   {!adminApplicationsError&&adminApplications.length===0?<p className="record-empty">Nenhuma aplicação fictícia prevista nos próximos oito dias.</p>:
    <div className="calendar-entries">{adminApplications.slice(0,30).map(a=><div className="calendar-entry" key={a.sessao_id}>
     <div className="calendar-entry-time"><strong>{displayDate(a.data_prevista)}</strong></div>
     <div className="calendar-entry-detail"><strong>{a.paciente_nome}</strong><span>Aplicação · {a.profissional_nome}</span><small>{a.status==='checada'?'Checagem registrada':'Pendente'}</small></div>
    </div>)}</div>}
  </div><div className="premium-panel">
   <h3>Atendimento e cadastros</h3>
   <div className="dashboard-kpis">{summary('Pacientes cadastrados',loading?'…':patientCount??'—','Total de registros fictícios')}</div>
   <p className="profile-notice">A equipe administrativa pode consultar a agenda compartilhada de atendimentos, sem acesso às prescrições ou às sessões clínicas dos protocolos.</p>
   <button className="gold-button" type="button" onClick={()=>onNavigate('Pacientes')}>Abrir pacientes →</button>
  </div></>:<>
   <div className="dashboard-kpis">
    {summary('Protocolos ativos',loading?'…':active.length,'Em andamento')}
    {summary('Aplicações hoje',loading?'…':unchecked.filter(s=>s.data_prevista===today).length,'Pendentes de checagem')}
    {summary('Atrasadas',loading?'…':unchecked.filter(s=>s.data_prevista<today).length,'Data prevista já passou')}
    {summary('Próximos 7 dias',loading?'…':unchecked.filter(s=>s.data_prevista>=today&&s.data_prevista<=endWeek).length,'Inclui hoje')}
    {summary('Sem item vinculado',loading?'…':unchecked.filter(s=>!s.item_prescricao_id).length,'Requer associação médica')}
   </div>
   <div className="premium-panel dashboard-agenda">
    <div className="dashboard-agenda-title"><div><h3>Agenda de aplicações</h3><p>Somente sessões pendentes de protocolos ativos. Não é uma confirmação de procedimento.</p></div>
     <button className="outline-gold" type="button" onClick={()=>onNavigate('Protocolos')}>Abrir protocolos →</button>
    </div>
    <div className="dashboard-filters" role="group" aria-label="Filtrar aplicações por período">
     {tabs.map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} className={filter===id?'dashboard-filter-active':''} onClick={()=>setFilter(id)}>{label}</button>)}
    </div>
    <label className="dashboard-search">Buscar na agenda<input type="search" maxLength={120} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Paciente, protocolo ou descrição"/></label>
    {loading?<p>Carregando agenda de testes...</p>:rows.length===0?<p className="record-empty">Nenhuma aplicação pendente encontrada para esse filtro.</p>:
    <div className="dashboard-agenda-list">{rows.slice(0,100).map(s=>{
     const p=patientByProtocol.get(s.protocolo_id);
     return <div className="dashboard-agenda-row" key={s.sessao_id}>
      <div className="dashboard-agenda-date"><strong>{ptDate(s.data_prevista)}</strong><small>{s.data_prevista<today?'Atrasada':s.data_prevista===today?'Hoje':'Agendada'}</small></div>
      <div className="dashboard-agenda-info"><strong>{p?.paciente_nome||'Paciente de teste'}</strong><span>{p?.nome||'Protocolo'} · {s.descricao||'Sessão'}</span>
       <small>{s.item_prescricao_id?'Item prescrito associado':'Aguardando vínculo a item prescrito'}{s.medicamento?' · '+s.medicamento:''}</small></div>
      <button type="button" className="outline-gold" onClick={()=>onNavigate('Protocolos')}>Ver protocolo</button>
     </div>;
    })}{rows.length>100&&<p className="record-empty">Exibindo as primeiras 100 sessões. Refine os filtros.</p>}</div>}
    {sessions.length>=2500&&<p className="profile-notice">O serviço de sessões retornou o limite de 2.500 registros. Os números e a agenda podem estar incompletos.</p>}
   </div>
   <div className="dashboard-shortcuts">
    <button className="outline-gold" onClick={()=>onNavigate('Administrações')} type="button">Checagens de enfermagem →</button>
    {role==='medico'&&<button className="outline-gold" onClick={()=>onNavigate('Prescrições')} type="button">Nova prescrição →</button>}
    {role==='medico'&&<button className="outline-gold" onClick={()=>onNavigate('Custos')} type="button">Custos dos protocolos →</button>}
   </div>
  </>}
 </section>;
}
