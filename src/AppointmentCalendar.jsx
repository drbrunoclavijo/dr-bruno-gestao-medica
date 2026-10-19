import React,{useEffect,useMemo,useState} from 'react';
import {localDate,shiftDay,displayDate,appointmentTypes,statuses,professionalDisplayName} from './ClinicCalendar.jsx';
const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const dayNames=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const admin=role=>['equipe','administrativo'].includes(role);
export const monthBounds=month=>{const [y,m]=month.split('-').map(Number);return [month+'-01',new Date(Date.UTC(y,m,0)).toISOString().slice(0,10)];};
export const monthGrid=month=>{
 const [first,last]=monthBounds(month);
 const offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
 const count=Math.ceil((offset+Number(last.slice(8)))/7)*7;
 return Array.from({length:count},(_,i)=>shiftDay(first,i-offset));
};
export default function AppointmentCalendar({supabase,role,userId,onOpenClinical,onEdit,onRefreshList,refreshSignal}){
 const today=localDate();
 const [month,setMonth]=useState(today.slice(0,7)),[selected,setSelected]=useState(today);
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [profs,setProfs]=useState([]),[scope,setScope]=useState('');
 const [open,setOpen]=useState(false);
 const [revision,setRevision]=useState(0);
 const [start,end]=monthBounds(month);
 useEffect(()=>{
  let active=true;
  setLoading(true);setError('');
  supabase.rpc('listar_agendamentos_teste',{p_de:start,p_ate:end}).then(({data,error:err})=>{
   if(!active)return;
   setRows(err?[]:(data||[]));setError(err?'Calendário indisponível: '+err.message:'');setLoading(false);
  });
  return ()=>{active=false;};
 },[supabase,month,revision,refreshSignal]);
 useEffect(()=>{
  if(!admin(role))return;
  let active=true;
  supabase.rpc('agenda_profissionais_teste').then(({data,error})=>{
   if(active&& !error)setProfs(data||[]);
  });
  return ()=>{active=false;};
 },[supabase,role]);
 const monthRows=useMemo(()=>rows.filter(a=>!scope||a.profissional_id===scope),[rows,scope]);
 const counts=useMemo(()=>{
  const map={};
  for(const r of monthRows){
   const d=String(r.inicio_local).slice(0,10);
   (map[d]??=[]).push(r);
  }
  for(const day of Object.keys(map))map[day].sort((a,b)=>String(a.inicio_local).localeCompare(String(b.inicio_local)));
  return map;
 },[monthRows]);
 const day=counts[selected]||[];
 const grid=monthGrid(month);
 const [year,m]=month.split('-').map(Number);
 const nextMonth=n=>{const d=new Date(Date.UTC(year,m-1+n,1));const next=d.toISOString().slice(0,7);setMonth(next);setSelected(next+'-01');setOpen(false);};
 const jumpToday=()=>{setMonth(today.slice(0,7));setSelected(today);setOpen(true);};
 const refresh=()=>{setRevision(n=>n+1);onRefreshList?.();};
 return <section className="premium-panel appointment-month-panel">
  <div className="appointment-month-top">
   <div><h3>Calendário de agendamentos</h3><p className="profile-notice">{admin(role)?'Agenda compartilhada da clínica — Bruno e Carol':'Somente os seus atendimentos'} · Clique em um dia para visualizar todos os pacientes.</p></div>
   <div className="appointment-month-actions">
    <button type="button" className="outline-gold" onClick={()=>nextMonth(-1)} aria-label="Mês anterior">←</button>
    <strong className="appointment-month-heading">{names[m-1]} de {year}</strong>
    <button type="button" className="outline-gold" onClick={()=>nextMonth(1)} aria-label="Próximo mês">→</button>
    <button type="button" className="outline-gold" onClick={jumpToday}>Hoje</button>
    <button type="button" className="outline-gold" onClick={refresh} disabled={loading}>Atualizar</button>
   </div>
  </div>
  {admin(role)&&<div className="appointment-scope">
   <label>Visualizar profissional<select value={scope} onChange={e=>{setScope(e.target.value);setOpen(false);}}>
    <option value="">Todos — Dr. Bruno e Dra. Carol</option>
    {profs.map(p=><option key={p.id} value={p.id}>{professionalDisplayName(p.nome)}</option>)}
   </select></label>
  </div>}
  {error&&<p className="form-message" role="alert">{error}</p>}
  <div className="appointment-month-grid" role="grid" aria-label="Calendário mensal">
   {dayNames.map(name=><div className="appointment-week-label" key={name} role="columnheader">{name}</div>)}
   {grid.map(d=>{
    const items=counts[d]||[];
    const outside=!d.startsWith(month),chosen=d===selected;
    const pending=items.filter(a=>a.status==='agendado').length;
    const confirmed=items.filter(a=>a.status==='confirmado').length;
    return <button type="button" key={d} role="gridcell" aria-selected={chosen}
     aria-label={displayDate(d)+', '+items.length+' agendamentos'}
     className={'appointment-date'+(outside?' appointment-date-outside':'')+(chosen?' appointment-date-selected':'')+(d===today?' appointment-date-today':'')}
     onClick={()=>{setSelected(d);setOpen(true);if(outside)setMonth(d.slice(0,7));}}>
     <span className="appointment-day-number">{Number(d.slice(8))}</span>
     {items.length>0&&<span className="appointment-day-count">{items.length} {items.length===1?'paciente':'pacientes'}</span>}
     <span className="appointment-status-line">{pending>0?'● '+pending+' pend. ':''}{confirmed>0?'● '+confirmed+' conf.':''}</span>
    </button>;
   })}
  </div>
  {loading&&<p className="profile-notice">Carregando os agendamentos do mês…</p>}
  {open&&!loading&&!error&&<div className="appointment-day-details">
   <div className="appointment-day-title">
    <h4>Agendamentos de {displayDate(selected)} — {day.length}</h4>
    <button type="button" className="outline-gold" onClick={()=>setOpen(false)}>Fechar</button>
   </div>
   {!day.length?<p className="record-empty">Nenhum agendamento para esse dia.</p>:
    <div className="appointment-day-list">{day.map(a=><div className="appointment-day-card" key={a.id}>
     <div className="appointment-day-time">{String(a.inicio_local).slice(11,16)}–{String(a.fim_local).slice(11,16)}</div>
     <div className="appointment-day-info"><strong>{a.paciente_nome}</strong>
      <span>{appointmentTypes[a.tipo]||a.tipo} · {professionalDisplayName(a.profissional_nome)}</span>
      <small>{statuses[a.status]||a.status}</small>
     </div>
     {role==='medico'&&a.profissional_id===userId&&a.paciente_id&&['consulta','retorno'].includes(a.tipo)&&!['cancelado','faltou'].includes(a.status)&&
      <button type="button" className="gold-button" onClick={()=>onOpenClinical?.(a)}>Abrir atendimento</button>}
     {['agendado','confirmado','reagendamento_solicitado'].includes(a.status)&&
      <button type="button" className="outline-gold" onClick={()=>onEdit(a)}>Remarcar</button>}
    </div>)}</div>}
  </div>}
  <p className="profile-notice">As datas e horários são apresentados no horário local de Foz do Iguaçu. O calendário não realiza envio de mensagens por si só.</p>
 </section>;
}
