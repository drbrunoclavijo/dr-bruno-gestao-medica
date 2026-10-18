import React,{useEffect,useState} from 'react';
import {localDate,shiftDay,displayDate,appointmentTypes,statuses,professionalDisplayName} from './ClinicCalendar.jsx';

// Leitura por perfil: nao requisitar prontuarios nem prescricoes para perfis administrativos.
// A autorizacao final depende das politicas/RPCs do Supabase, nao apenas desta interface.
const clinical=role=>role==='medico';
const care=role=>role==='medico'||role==='enfermeira';
const limit=60;
const when=v=>displayDate(v)+(String(v||'').length>=16?' · '+String(v).slice(11,16):'');
export default function PatientOverview({supabase,patientId,role}){
 const [agenda,setAgenda]=useState([]),[consultations,setConsultations]=useState([]),
  [prescriptions,setPrescriptions]=useState([]),[protocols,setProtocols]=useState([]),
  [sessions,setSessions]=useState([]),[errors,setErrors]=useState([]),[busy,setBusy]=useState(true),
  [reload,setReload]=useState(0);
 useEffect(()=>{
  let alive=true;
  setBusy(true);setErrors([]);
  setAgenda([]);setConsultations([]);setPrescriptions([]);setProtocols([]);setSessions([]);
  const current=localDate();
  const requests=[
   ['agenda',supabase.rpc('listar_agendamentos_teste',{p_de:shiftDay(current,-60),p_ate:shiftDay(current,60)})]
  ];
  if(clinical(role)){
   requests.push(['consultas',supabase.from('consultas_teste').select('id,data_consulta,motivo,criado_em').eq('paciente_id',patientId).order('data_consulta',{ascending:false}).limit(limit)]);
   requests.push(['prescricoes',supabase.from('prescricoes_teste').select('id,criado_em,consulta_id').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(limit)]);
   requests.push(['protocolos',supabase.rpc('listar_protocolos_com_insumos_teste')]);
  }
  if(role==='enfermeira'){
   requests.push(['sessoes',supabase.rpc('sessoes_paciente_enfermagem_teste',{p_paciente_id:patientId})]);
  }
  Promise.all(requests.map(async ([key,promise])=>({key,...await promise}))).then(results=>{
   if(!alive)return;
   const issues=[];
   for(const x of results){
    if(x.error){issues.push(x.key+': '+x.error.message);continue;}
    if(x.key==='agenda')setAgenda((x.data||[]).filter(a=>a.paciente_id===patientId).sort((a,b)=>String(b.inicio_local).localeCompare(String(a.inicio_local))));
    if(x.key==='consultas')setConsultations(x.data||[]);
    if(x.key==='prescricoes')setPrescriptions(x.data||[]);
    if(x.key==='protocolos')setProtocols((x.data||[]).filter(p=>p.paciente_id===patientId));
    if(x.key==='sessoes')setSessions(x.data||[]);
   }
   setErrors(issues);setBusy(false);
  }).catch(err=>{if(alive){setErrors([err.message||'Falha ao carregar histórico']);setBusy(false);}});
  return()=>{alive=false;};
 },[supabase,patientId,role,reload]);
 const upcoming=agenda.filter(a=>a.inicio_local?.slice(0,10)>=localDate()&&!['cancelado','faltou','realizado'].includes(a.status));
 return <div className="premium-panel patient-overview">
  <div className="patient-overview-heading">
   <div><h3>Visão geral do paciente</h3><p className="muted">Dados do cadastro atual · histórico de agendamentos dos últimos 60 dias e próximos 60 dias</p></div>
   <button className="outline-gold" type="button" onClick={()=>setReload(x=>x+1)} disabled={busy}>↻ Atualizar</button>
  </div>
  <p className="profile-notice">{clinical(role)?'Resumo clínico visível somente ao médico. Consulte os módulos abaixo para informações completas.':role==='enfermeira'?'Agenda e sessões permitidas à enfermagem, sem acesso ao prontuário médico.':'Visão estritamente administrativa: não exibe prontuário, prescrições ou dados clínicos.'}</p>
  {errors.length>0&&<p className="form-message" role="alert">Algumas informações não puderam ser carregadas: {errors.join(' | ')}</p>}
  {busy?<p>Carregando histórico do paciente…</p>:<>
   <div className="patient-overview-stats">
    <div><small>Agendamentos no período</small><strong>{agenda.length}</strong></div>
    <div><small>Próximos atendimentos</small><strong>{upcoming.length}</strong></div>
    {clinical(role)&&<><div><small>Consultas registradas</small><strong>{consultations.length}</strong></div>
    <div><small>Prescrições</small><strong>{prescriptions.length}</strong></div>
    <div><small>Protocolos</small><strong>{protocols.length}</strong></div></>}
    {role==='enfermeira'&&<div><small>Sessões de enfermagem</small><strong>{sessions.length}</strong></div>}
   </div>
   <section className="patient-overview-section">
    <h4>Agenda e retornos</h4>
    {!agenda.length?<p className="record-empty">Nenhum agendamento visível neste período.</p>:
    <div className="patient-overview-list">{agenda.slice(0,20).map(a=><div key={a.id} className="patient-overview-item">
     <strong>{when(a.inicio_local)}</strong><span>{appointmentTypes[a.tipo]||a.tipo} · {professionalDisplayName(a.profissional_nome)}</span>
     <small>{statuses[a.status]||a.status}</small>
    </div>)}</div>}
    {agenda.length>20&&<small>Exibindo os 20 mais recentes. Consulte o calendário para a agenda completa.</small>}
   </section>
   {clinical(role)&&<>
    <section className="patient-overview-section"><h4>Consultas médicas</h4>
     {!consultations.length?<p className="record-empty">Nenhuma consulta registrada.</p>:
      <div className="patient-overview-list">{consultations.slice(0,10).map(c=><div key={c.id} className="patient-overview-item">
       <strong>{displayDate(c.data_consulta)}</strong><span>{c.motivo||'Consulta médica'}</span>
      </div>)}</div>}
     <small>Abra o prontuário abaixo para visualizar os registros clínicos.</small>
    </section>
    <section className="patient-overview-section"><h4>Prescrições e protocolos</h4>
     <div className="patient-overview-columns">
      <div><strong>Prescrições</strong>{!prescriptions.length?<p className="record-empty">Nenhuma no sistema.</p>:prescriptions.slice(0,8).map(p=><p key={p.id}>{when(p.criado_em)} · Prescrição registrada</p>)}</div>
      <div><strong>Protocolos</strong>{!protocols.length?<p className="record-empty">Nenhum no sistema.</p>:protocols.slice(0,8).map(p=><p key={p.protocolo_id||p.id}>{p.nome||'Protocolo'} · {p.status||'Registrado'}</p>)}</div>
     </div>
     <small>Somente resumo. Detalhes disponíveis nos módulos autorizados.</small>
    </section>
   </>}
   {role==='enfermeira'&&<section className="patient-overview-section"><h4>Sessões de enfermagem</h4>
    {!sessions.length?<p className="record-empty">Nenhuma sessão vinculada.</p>:
     <div className="patient-overview-list">{sessions.slice(0,15).map((s,i)=><div className="patient-overview-item" key={s.sessao_id||s.item_prescricao_id||i}>
      <strong>{displayDate(s.data_prevista)}</strong><span>{s.status==='checada'?'Checada':'Prevista'}</span>
     </div>)}</div>}
    <small>Detalhes de administração ficam no módulo autorizado da enfermagem.</small>
   </section>}
  </>}
 </div>;
}
