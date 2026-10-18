import React,{useEffect,useState} from 'react';
import {displayDate,appointmentTypes,statuses,professionalDisplayName,localDate,shiftDay} from './ClinicCalendar.jsx';

// Visao sem diagnosticos e sem dados financeiros. Autoridade de acesso permanece no Supabase.
const clinicalRoles=['medico','enfermeira'];
const adminRoles=['equipe','administrativo'];
export const patientSectionsFor=role=>[
 ['acompanhamento','Acompanhamento'],
 ['cadastro','Cadastro'],
 ...(role==='medico'?[['prontuario','Prontuário'],['documentos','Documentos'],['prescricoes','Prescrições']]:[]),
 ...(clinicalRoles.includes(role)?[['administracoes','Administrações']]:[])
];
export const currentAgendaWindow=()=>{
 const today=localDate();
 return [
  {p_de:shiftDay(today,-119),p_ate:today},
  {p_de:shiftDay(today,1),p_ate:shiftDay(today,120)}
 ];
};
const protocolRpc=role=>role==='medico'?'listar_protocolos_com_insumos_teste':role==='enfermeira'?'protocolos_operacionais_enfermagem_teste':null;
export default function PatientJourney({supabase,patientId,role}){
 const [appointments,setAppointments]=useState([]),[protocols,setProtocols]=useState([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 async function refresh(){
  if(!patientId)return;
  setLoading(true);setError('');
  // Agenda ja é filtrada pela permissão de cada perfil na função SQL.
  const ranges=currentAgendaWindow();
  const rpc=protocolRpc(role);
  const results=await Promise.all([
   ...ranges.map(params=>supabase.rpc('listar_agendamentos_teste',params)),
   ...(rpc?[supabase.rpc(rpc)]:[])
  ]);
  const faults=results.filter(x=>x.error);
  if(faults.length)setError('Não foi possível carregar parte do acompanhamento: '+faults.map(x=>x.error.message).join('; '));
  const unique=new Map();
  for(const result of results.slice(0,ranges.length)){
   for(const a of result.data||[])if(a.paciente_id===patientId)unique.set(a.id,a);
  }
  setAppointments([...unique.values()].sort((a,b)=>String(b.inicio_local).localeCompare(String(a.inicio_local))));
  const raw=rpc?(results[ranges.length].data||[]):[];
  setProtocols(raw.filter(p=>p.paciente_id===patientId));
  setLoading(false);
 }
 useEffect(()=>{let alive=true;const load=async()=>{
  setLoading(true);setError('');
  const rpc=protocolRpc(role);
  const ranges=currentAgendaWindow();
  const results=await Promise.all([
   ...ranges.map(params=>supabase.rpc('listar_agendamentos_teste',params)),
   ...(rpc?[supabase.rpc(rpc)]:[])
  ]);
  if(!alive)return;
  const failures=results.filter(r=>r.error);
  if(failures.length)setError('Alguns dados não puderam ser carregados: '+failures.map(r=>r.error.message).join('; '));
  const unique=new Map();
  for(const result of results.slice(0,2))for(const a of result.data||[]){
   if(a.paciente_id===patientId)unique.set(a.id,a);
  }
  setAppointments([...unique.values()].sort((a,b)=>String(b.inicio_local).localeCompare(String(a.inicio_local))));
  setProtocols(rpc?(results[2].data||[]).filter(p=>p.paciente_id===patientId):[]);
  setLoading(false);
 };
 load();
 return ()=>{alive=false};
 },[supabase,patientId,role]);
 const next=appointments.filter(a=>a.inicio_local.slice(0,10)>=localDate()&&!['cancelado','faltou','realizado'].includes(a.status)).sort((a,b)=>a.inicio_local.localeCompare(b.inicio_local))[0];
 return <section className="premium-panel patient-follow-up" id="paciente-acompanhamento">
  <div className="dashboard-agenda-title">
   <div><h3>Resumo do acompanhamento</h3><p>Histórico operacional autorizado para este perfil · dados fictícios</p></div>
   <button type="button" className="outline-gold" disabled={loading} onClick={refresh}>↻ Atualizar histórico</button>
  </div>
  {error&&<p role="alert" className="form-message">{error}</p>}
  <div className="patient-follow-up-metrics">
   <div><small>Agendamentos no período</small><strong>{loading?'…':appointments.length}</strong></div>
   {clinicalRoles.includes(role)&&<div><small>Protocolos vinculados</small><strong>{loading?'…':protocols.length}</strong></div>}
   <div><small>Próximo atendimento</small><strong>{loading?'…':next?displayDate(next.inicio_local)+' · '+next.inicio_local.slice(11,16):'Não agendado'}</strong></div>
  </div>
  <p className="profile-notice">A agenda resume os últimos 119 dias e os próximos 120 dias, sem substituir o histórico integral do prontuário. O acesso médico e de enfermagem às suas respectivas informações continua restrito pelas permissões do banco.</p>
  <h4>Agendamentos e retornos</h4>
  {loading?<p>Carregando histórico...</p>:appointments.length===0?<p className="record-empty">Nenhum agendamento visível neste intervalo.</p>:
   <div className="patient-follow-up-list">{appointments.map(a=><div key={a.id} className="patient-follow-up-entry">
    <strong>{displayDate(a.inicio_local)} · {a.inicio_local.slice(11,16)}</strong>
    <span>{appointmentTypes[a.tipo]||a.tipo} · {professionalDisplayName(a.profissional_nome)}</span>
    <small>{statuses[a.status]||a.status}</small>
   </div>)}</div>}
  {clinicalRoles.includes(role)&&<><h4>Protocolos em acompanhamento</h4>
   {loading?<p>Carregando protocolos...</p>:protocols.length===0?<p className="record-empty">Nenhum protocolo clínico visível para este perfil.</p>:
    <div className="patient-follow-up-list">{protocols.map((p,i)=><div className="patient-follow-up-entry" key={p.protocolo_id||i}>
     <strong>{p.nome||'Protocolo'}</strong>
     <span>Início: {displayDate(p.inicio)} · {p.status||'Situação não informada'}</span>
     {role==='enfermeira'&&<small>Sessões: {p.total_sessoes??'—'} · Checadas: {p.sessoes_checadas??'—'}</small>}
    </div>)}</div>}
  </>}
  {adminRoles.includes(role)&&<p className="profile-notice">A equipe administrativa visualiza somente agendamentos e dados cadastrais. Prontuário, prescrições e protocolos clínicos não são consultados nesta visão.</p>}
 </section>;
}
