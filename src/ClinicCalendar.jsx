import React,{useEffect,useState} from 'react';
import AppointmentCalendar from './AppointmentCalendar.jsx';
const tz='America/Sao_Paulo';
export const localDate=()=>{
 const d=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const p=Object.fromEntries(d.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
};
export const shiftDay=(s,n)=>{const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const displayDate=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'—';
export const appointmentTypes={consulta:'Consulta',retorno:'Retorno',procedimento:'Procedimento',outro:'Outro agendamento'};
export const statuses={agendado:'Aguardando confirmação',confirmado:'Confirmado',realizado:'Realizado',cancelado:'Cancelado',faltou:'Faltou',reagendamento_solicitado:'Reagendamento solicitado'};
export const professionalDisplayName=name=>{
 const value=String(name||'').trim();
 if(/bruno.*clavijo/i.test(value))return 'Dr. Bruno Clavijo';
 if(/carol/i.test(value)&&/klaus/i.test(value))return 'Dra. Carol Klaus';
 return value;
};
export const confirmationText=a=>{
 const name=professionalDisplayName(a.profissional_nome);
 const date=displayDate(a.inicio_local),time=String(a.inicio_local||'').slice(11,16);
 return 'Olá! Sua consulta no Majestic Santé Institute com '+name+' está agendada para '+date+', às '+time+'.\n\n'
 +'Responda 1 para confirmar sua presença ou 2 para solicitar reagendamento.\n\nAguardamos você!';
};
export const confirmedText=a=>'Sua consulta com '+professionalDisplayName(a.profissional_nome)+' no Majestic Santé Institute está confirmada para '+displayDate(a.inicio_local)+', às '+String(a.inicio_local||'').slice(11,16)+'.\n\nSerá um prazer recebê-lo(a). Até breve!';
export const rescheduleText=()=> 'Recebemos sua solicitação de reagendamento. Nossa equipe de relacionamento entrará em contato para encontrar um novo horário que seja conveniente para você.\n\nMajestic Santé Institute — será um prazer recebê-lo(a)!';
export function useAppointments(supabase,from,to){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  const {data,error:err}=await supabase.rpc('listar_agendamentos_teste',{p_de:from,p_ate:to});
  if(err){setError('Agenda indisponível: '+err.message+'. Verifique se o SQL da agenda foi executado.');setRows([]);}
  else setRows(data||[]);
  setLoading(false);
 }
 useEffect(()=>{refresh();},[from,to]);
 return {rows,loading,error,refresh};
}
const initial=()=>({id:'',patient:'',professional:'',type:'consulta',date:localDate(),hour:'09:00',duration:'30',note:''});
export default function ClinicCalendar({supabase,role}){
 const [calendarRevision,setCalendarRevision]=useState(0);
 const [from,setFrom]=useState(localDate()),[view,setView]=useState('semana'),[filter,setFilter]=useState(''),[term,setTerm]=useState('');
 const to=view==='dia'?from:view==='semana'?shiftDay(from,6):shiftDay(from,29);
 const {rows,loading,error,refresh}=useAppointments(supabase,from,to);
 const [applications,setApplications]=useState([]),[applicationsLoading,setApplicationsLoading]=useState(true),[applicationsError,setApplicationsError]=useState('');
 async function reloadApplications(){
  setApplicationsLoading(true);setApplicationsError('');
  const {data,error:err}=await supabase.rpc('agenda_aplicacoes_administrativa_teste',{p_de:from,p_ate:to});
  if(err){setApplicationsError('Agenda de aplicações indisponível: '+err.message);setApplications([]);}
  else setApplications(data||[]);
  setApplicationsLoading(false);
 }
 useEffect(()=>{reloadApplications();},[from,to]);
 const [replyPreview,setReplyPreview]=useState(''),[pending,setPending]=useState([]),[pendingError,setPendingError]=useState('');
 async function loadPending(){if(!['equipe','administrativo'].includes(role))return;const {data,error:err}=await supabase.rpc('listar_pendencias_agenda_teste');if(err)setPendingError(err.message);else{setPending(data||[]);setPendingError('');}}
 useEffect(()=>{loadPending();},[role]);
 const [patients,setPatients]=useState([]),[professionals,setProfessionals]=useState([]),[form,setForm]=useState(initial),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[formError,setFormError]=useState('');
 useEffect(()=>{(async()=>{
  const [p,pro]=await Promise.all([supabase.from('pacientes').select('id,nome').order('nome').limit(300),supabase.rpc('agenda_profissionais_teste')]);
  if(p.error||pro.error)setFormError('Não foi possível carregar os pacientes ou profissionais: '+(p.error||pro.error).message);
  else{setPatients(p.data||[]);setProfessionals(pro.data||[]);}
 })();},[]);
 const field=(k,v)=>setForm(o=>({...o,[k]:v}));
 const selectedRows=rows.filter(a=>(!filter||a.profissional_id===filter)&&[a.paciente_nome,a.profissional_nome,appointmentTypes[a.tipo]].some(v=>String(v||'').toLowerCase().includes(term.toLowerCase())));
 function edit(a){
  setForm({id:a.id,patient:a.paciente_id,professional:a.profissional_id,type:a.tipo,
   date:a.inicio_local.slice(0,10),hour:a.inicio_local.slice(11,16),
   duration:String(Math.round((new Date(a.fim_local+'Z')-new Date(a.inicio_local+'Z'))/60000)),
   note:a.observacao_administrativa||''});
  setFormError('');setOpen(true);
 }
 async function save(e){
  e.preventDefault();setBusy(true);setFormError('');setMessage('');
  try{
   const {error:err}=await supabase.rpc('salvar_agendamento_teste',{
    p_paciente_id:form.patient,p_profissional_id:form.professional,p_tipo:form.type,
    p_inicio_local:form.date+'T'+form.hour+':00',p_duracao_min:Number(form.duration),
    p_observacao:form.note.trim()||null,p_agendamento_id:form.id||null
   });
   if(err)throw err;
   setCalendarRevision(n=>n+1);
   setOpen(false);setForm(initial());setMessage('Agendamento fictício salvo na agenda compartilhada. Nenhuma mensagem foi enviada.');
   await loadPending();
   if(form.date<from||form.date>to){setFrom(form.date);setView('dia');}else await refresh();
  }catch(err){setFormError('Não foi possível salvar: '+err.message);}
  finally{setBusy(false);}
 }
 async function status(a,next){
  if(!window.confirm('Alterar '+a.paciente_nome+' para '+statuses[next]+'? Essa confirmação é manual; não representa resposta automática do paciente.'))return;
  setBusy(true);setFormError('');setMessage('');
  const {error:err}=await supabase.rpc('atualizar_status_agendamento_teste',{p_agendamento_id:a.id,p_status:next});
  if(err)setFormError('Não foi possível alterar: '+err.message);
  else{setCalendarRevision(n=>n+1);setMessage('Status alterado manualmente.');await refresh();await loadPending();}
  setBusy(false);
 }
 async function simulateReply(a,answer){
  if(busy)return;
  if(!window.confirm('SIMULAÇÃO — processar resposta '+answer+' do paciente fictício '+a.paciente_nome+'? Nenhuma mensagem será enviada pelo WhatsApp.'))return;
  setBusy(true);setFormError('');setMessage('');setReplyPreview('');
  try{
   const {error:err}=await supabase.rpc('simular_resposta_agendamento_teste',{p_agendamento_id:a.id,p_resposta:answer});
   if(err)throw err;
   setReplyPreview(answer==='1'?confirmedText(a):rescheduleText());
   setMessage(answer==='1'?'Confirmação simulada registrada. Resposta pronta, ainda NÃO enviada.':'Reagendamento solicitado na simulação. Pendência criada para Amanda; resposta pronta, NÃO enviada.');
   setCalendarRevision(n=>n+1);await refresh();await loadPending();
  }catch(err){setFormError('Erro ao simular resposta: '+err.message);}
  finally{setBusy(false);}
 }
 const sort=[...selectedRows].sort((a,b)=>a.inicio_local.localeCompare(b.inicio_local));
 const today=localDate();
 return <section className="clinic-calendar">
  <div className="premium-panel">
   <div className="panel-title"><span className="title-icon" aria-hidden="true">▦</span><div><h3>{['equipe','administrativo'].includes(role)?'Agenda completa da clínica':role==='medico'?'Minha agenda — Dr. Bruno':'Minha agenda — Dra. Carol'}</h3><p>Consultas, retornos e procedimentos fictícios · Horário de Foz do Iguaçu</p></div></div>
   <p className="profile-notice">As consultas exibidas para médico e enfermeira são somente as próprias. A equipe administrativa visualiza consultas de todos os profissionais e a agenda administrativa de aplicações. Confirmações feitas aqui são MANUAIS. Envio e recebimento automático de mensagens ainda não estão conectados.</p>
   {error&&<p className="form-message" role="alert">{error}</p>}
   {formError&&<p className="form-message" role="alert">{formError}</p>}
   {message&&<p className="form-message" role="status">{message}</p>}
   {replyPreview&&<div className="form-section"><strong>Mensagem preparada — não enviada</strong><p style={{whiteSpace:'pre-line'}}>{replyPreview}</p><button className="outline-gold" type="button" onClick={()=>navigator.clipboard.writeText(replyPreview).then(()=>setMessage('Mensagem copiada.')).catch(()=>setFormError('Não foi possível copiar automaticamente.'))}>Copiar resposta</button></div>}
   <div className="calendar-tools">
    <label>Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
    <label>Exibir<select value={view} onChange={e=>setView(e.target.value)}><option value="dia">Dia</option><option value="semana">7 dias</option><option value="mes">30 dias</option></select></label>
    {['equipe','administrativo'].includes(role)&&<label>Profissional<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos</option>{professionals.map(p=><option value={p.id} key={p.id}>{p.nome}</option>)}</select></label>}
    <label>Buscar<input type="search" placeholder="Paciente ou atendimento" value={term} onChange={e=>setTerm(e.target.value)}/></label>
   </div>
   <div className="form-actions">
    <button type="button" className="outline-gold" onClick={()=>{setFrom(shiftDay(from,view==='dia'?-1:view==='semana'?-7:-30));}}>← Anterior</button>
    <button type="button" className="outline-gold" onClick={()=>setFrom(today)}>Hoje</button>
    <button type="button" className="outline-gold" onClick={()=>setFrom(shiftDay(from,view==='dia'?1:view==='semana'?7:30))}>Próximo →</button>
    <button type="button" className="outline-gold" onClick={refresh} disabled={loading}>Atualizar</button>
    <button type="button" className="gold-button" onClick={()=>{setForm(initial());setOpen(true);setFormError('');}}>+ Novo agendamento</button>
   </div>
  </div>
  <AppointmentCalendar supabase={supabase} role={role} onEdit={edit} onRefreshList={refresh} refreshSignal={calendarRevision}/>
  {open&&<div className="premium-panel">
   <h3>{form.id?'Remarcar atendimento':'Novo agendamento'}</h3>
   <form onSubmit={save} className="calendar-tools">
    <label>Paciente *<select required value={form.patient} onChange={e=>field('patient',e.target.value)}><option value="">Selecione um paciente fictício</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label>Profissional *<select required value={form.professional} onChange={e=>field('professional',e.target.value)}><option value="">Selecione</option>{professionals.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label>Tipo *<select value={form.type} onChange={e=>field('type',e.target.value)}>{Object.entries(appointmentTypes).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Data *<input type="date" required value={form.date} onChange={e=>field('date',e.target.value)}/></label>
    <label>Horário *<input type="time" required value={form.hour} onChange={e=>field('hour',e.target.value)}/></label>
    <label>Duração *<select value={form.duration} onChange={e=>field('duration',e.target.value)}>{[15,20,30,40,45,60,90,120].map(n=><option value={n} key={n}>{n} minutos</option>)}</select></label>
    <label className="calendar-note">Observação administrativa (sem dados clínicos)<input maxLength={300} value={form.note} onChange={e=>field('note',e.target.value)} placeholder="Opcional"/></label>
    <div className="form-actions calendar-form-actions"><button className="outline-gold" type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="gold-button" type="submit" disabled={busy}>{busy?'Salvando...':'Salvar agendamento'}</button></div>
   </form>
  </div>}
  {['equipe','administrativo'].includes(role)&&<div className="premium-panel">
   <div className="dashboard-agenda-title"><div><h3>Pendências administrativas</h3><p>Pedidos de reagendamento registrados. Contate o paciente e escolha uma nova data.</p></div>
    <button type="button" className="outline-gold" onClick={loadPending}>Atualizar pendências</button></div>
   {pendingError&&<p role="alert" className="form-message">{pendingError}</p>}
   {pending.length===0?<p className="record-empty">Nenhuma solicitação de reagendamento pendente.</p>:
    <div className="calendar-entries">{pending.map(p=><div key={p.pendencia_id} className="calendar-entry">
     <div className="calendar-entry-time"><strong>{displayDate(p.inicio_local)}</strong><span>{p.inicio_local?.slice(11,16)}</span></div>
     <div className="calendar-entry-detail"><strong>{p.paciente_nome}</strong><span>{professionalDisplayName(p.profissional_nome)}</span><small>Solicitou reagendamento — atendimento pendente</small></div>
     <button className="outline-gold" type="button" onClick={()=>{setFrom(p.inicio_local.slice(0,10));setView('dia');setMessage('Localize o paciente na agenda abaixo e clique em Remarcar.');}}>Localizar</button>
    </div>)}</div>}
  </div>}
  <div className="premium-panel">
   <h3>Atendimentos de {displayDate(from)} até {displayDate(to)}</h3>
   {loading?<p>Carregando...</p>:sort.length===0?<p className="record-empty">Nenhum atendimento encontrado para este período.</p>:
    <div className="calendar-entries">{sort.map(a=><div className="calendar-entry" key={a.id}>
     <div className="calendar-entry-time"><strong>{displayDate(a.inicio_local)}</strong><span>{a.inicio_local.slice(11,16)}–{a.fim_local.slice(11,16)}</span></div>
     <div className="calendar-entry-detail"><strong>{a.paciente_nome}</strong><span>{appointmentTypes[a.tipo]} · {a.profissional_nome}</span><small>{statuses[a.status]||a.status}</small>{a.observacao_administrativa&&<small>{a.observacao_administrativa}</small>}</div>
     <div className="calendar-entry-actions">
      {['agendado','confirmado','reagendamento_solicitado'].includes(a.status)&&<button className="outline-gold" onClick={()=>edit(a)}>Remarcar</button>}
      {a.status==='agendado'&&<button className="outline-gold" disabled={busy} onClick={()=>status(a,'confirmado')}>Confirmar manualmente</button>}
      {a.status==='agendado'&&<><button className="outline-gold" type="button" disabled={busy} onClick={()=>simulateReply(a,'1')}>Testar resposta 1</button><button className="outline-gold" type="button" disabled={busy} onClick={()=>simulateReply(a,'2')}>Testar resposta 2</button></>}}
      {['agendado','confirmado'].includes(a.status)&&<button type="button" className="outline-gold"
        onClick={async()=>{try{await navigator.clipboard.writeText(confirmationText(a));setMessage('Mensagem de confirmação copiada. Nenhum WhatsApp foi enviado pelo sistema.');}
          catch{setMessage('Não foi possível copiar automaticamente; configure a permissão da área de transferência no navegador.');}}}>Copiar mensagem WhatsApp</button>}
      {['agendado','confirmado'].includes(a.status)&&<button className="outline-gold" disabled={busy} onClick={()=>status(a,'realizado')}>Realizado</button>}
      {['agendado','confirmado'].includes(a.status)&&<button className="outline-gold" disabled={busy} onClick={()=>status(a,'cancelado')}>Cancelar</button>}
     </div>
    </div>)}</div>}
  </div>
  <div className="premium-panel dashboard-agenda">
   <div className="dashboard-agenda-title"><div><h3>Agenda de aplicações</h3><p>Agenda compartilhada de sessões planejadas · sem dados de medicação nesta visualização.</p></div>
    <button type="button" className="outline-gold" disabled={applicationsLoading} onClick={reloadApplications}>Atualizar aplicações</button></div>
   {applicationsError&&<p role="alert" className="form-message">{applicationsError}</p>}
   {applicationsLoading?<p>Carregando sessões...</p>:applications.length===0?<p className="record-empty">Nenhuma aplicação planejada neste período.</p>:
    <div className="calendar-entries">{applications.map(a=><div className="calendar-entry" key={a.sessao_id}>
     <div className="calendar-entry-time"><strong>{displayDate(a.data_prevista)}</strong><span>Aplicação</span></div>
     <div className="calendar-entry-detail"><strong>{a.paciente_nome}</strong><span>{a.profissional_nome}</span><small>{a.status==='checada'?'Checada':'Pendente'}</small></div>
    </div>)}</div>}
   {applications.length>=1500&&<p className="profile-notice">Limite de resultados atingido. Selecione um período menor.</p>}
  </div>
 </section>;
}
