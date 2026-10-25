import React,{useEffect,useMemo,useState} from 'react';
import {crmToday,crmPhoneDigits,crmValidBrazilianPhone,crmWhatsAppUrl,crmDueTasks} from './crmUtils.js';

const origins={instagram:'Instagram',google:'Google',whatsapp:'WhatsApp',indicacao:'Indicação',outro:'Outro'};
const interests={emagrecimento:'Emagrecimento',saude_hormonal:'Saúde hormonal',botox:'Botox',preenchimento:'Preenchimento',bioestimulador:'Bioestimulador',outro:'Outro'};
const stages={novo:'Novo contato',conversa:'Em conversa',agendado:'Agendado',atendido:'Atendido',encerrado:'Encerrado'};
const initial={paciente_id:'',nome:'',telefone:'',origem:'whatsapp',interesse:'outro',responsavel:'amanda',etapa:'novo',observacao:'',permite_contato:false};
const localToday=crmToday;
const phoneDigits=crmPhoneDigits;
const validPhone=crmValidBrazilianPhone;
const whatsappUrl=crmWhatsAppUrl;
export default function CRMRelacionamento({supabase,role}){
 const [contatos,setContatos]=useState([]),[tarefas,setTarefas]=useState([]);
 const [patients,setPatients]=useState([]),[agenda,setAgenda]=useState([]),[agendaError,setAgendaError]=useState('');
 const [form,setForm]=useState(initial),[editing,setEditing]=useState(null);
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('todos'),[taskContact,setTaskContact]=useState('');
 const [taskTitle,setTaskTitle]=useState('Retomar contato'),[taskDate,setTaskDate]=useState(localToday());
 const [reschedules,setReschedules]=useState({});
 const [historyContact,setHistoryContact]=useState(''),[historyType,setHistoryType]=useState('whatsapp'),[historyText,setHistoryText]=useState(''),[history,setHistory]=useState([]),[historyError,setHistoryError]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const canWrite=['equipe','administrativo','medico','enfermeira'].includes(role);
 async function reload(){
  setBusy(true);setError('');
  const [a,b,p]=await Promise.all([
   supabase.from('crm_contatos_teste').select('*').order('created_at',{ascending:false}).limit(500),
   supabase.from('crm_tarefas_teste').select('*').order('vencimento',{ascending:true}).limit(500),
   supabase.from('pacientes').select('id,nome').order('nome').limit(300)
  ]);
  if(a.error||b.error)setError('CRM ainda indisponível. Verifique se a migração SQL foi aplicada no Supabase e as permissões estão corretas. '+(a.error?.message||b.error?.message||''));
  else {setContatos(a.data||[]);setTarefas(b.data||[]);}
  if(p.error)setAgendaError('Lista de pacientes indisponível para este perfil.');else setPatients(p.data||[]);
  setBusy(false);
 }
 useEffect(()=>{reload();},[supabase]);
 useEffect(()=>{
  if(!historyContact){setHistory([]);setHistoryError('');return;}
  let active=true;
  supabase.from('crm_interacoes_teste').select('id,tipo,resumo,criado_em').eq('contato_id',historyContact).order('criado_em',{ascending:false}).limit(100).then(({data,error})=>{
   if(!active)return;
   if(error){setHistoryError('Histórico indisponível. Execute a segunda migração SQL do CRM.');setHistory([]);}
   else {setHistoryError('');setHistory(data||[]);}
  });
  return ()=>{active=false;};
 },[supabase,historyContact]);
 const pending=tarefas.filter(t=>t.situacao==='pendente');
 const today=localToday();
 const due=crmDueTasks(pending,today);
 const metrics=[['Novos contatos',contatos.filter(c=>c.etapa==='novo').length],['Em conversa',contatos.filter(c=>c.etapa==='conversa').length],['Agendados',contatos.filter(c=>c.etapa==='agendado').length],['Lembretes vencidos/hoje',due.length]];
 const filtered=useMemo(()=>contatos.filter(c=>(filter==='todos'||c.etapa===filter)&&[c.nome,c.telefone,interests[c.interesse]].join(' ').toLowerCase().includes(search.toLowerCase())),[contatos,filter,search]);
 async function saveContact(e){
  e.preventDefault();setError('');setNotice('');
  if(!validPhone(form.telefone)){setError('Informe telefone com DDD brasileiro, com 10 ou 11 dígitos.');return;}
  if(!form.nome.trim()){setError('Informe o nome.');return;}
  setBusy(true);
  const value={...form,paciente_id:form.paciente_id||null,nome:form.nome.trim(),telefone:phoneDigits(form.telefone),observacao:form.observacao.trim(),updated_at:new Date().toISOString()};
  const result=editing?await supabase.from('crm_contatos_teste').update(value).eq('id',editing):await supabase.from('crm_contatos_teste').insert(value);
  if(result.error){setError('Não foi possível salvar: '+result.error.message);setBusy(false);return;}
  setForm(initial);setEditing(null);setNotice('Contato salvo.');await reload();
 }
 async function addTask(e){
  e.preventDefault();setError('');setNotice('');
  if(!taskContact||!taskTitle.trim()||!taskDate){setError('Selecione um contato, descreva a tarefa e escolha uma data.');return;}
  setBusy(true);
  const {error:err}=await supabase.from('crm_tarefas_teste').insert({contato_id:taskContact,titulo:taskTitle.trim(),vencimento:taskDate});
  if(err){setError('Não foi possível criar o lembrete: '+err.message);setBusy(false);return;}
  setTaskTitle('Retomar contato');setNotice('Lembrete criado.');await reload();
 }
 async function finishTask(id){
  setBusy(true);setError('');
  const {error:err}=await supabase.from('crm_tarefas_teste').update({situacao:'concluida'}).eq('id',id);
  if(err){setError('Não foi possível concluir a tarefa: '+err.message);setBusy(false);return;}
  setNotice('Lembrete concluído.');await reload();
 }
 async function rescheduleTask(t){
  const date=reschedules[t.id]||t.vencimento;
  if(!date){setError('Escolha uma nova data.');return;}
  setBusy(true);setError('');
  const {error:err}=await supabase.from('crm_tarefas_teste').update({vencimento:date}).eq('id',t.id);
  if(err){setError('Não foi possível reagendar: '+err.message);setBusy(false);return;}
  setNotice('Lembrete reagendado.');setReschedules(old=>({...old,[t.id]:undefined}));await reload();
 }
 async function addHistory(e){
  e.preventDefault();setError('');setNotice('');
  if(!historyContact||historyText.trim().length<2){setError('Selecione o contato e escreva um resumo administrativo.');return;}
  setBusy(true);
  const {error:err}=await supabase.from('crm_interacoes_teste').insert({contato_id:historyContact,tipo:historyType,resumo:historyText.trim()});
  if(err){setError('Não foi possível registrar a interação: '+err.message);setBusy(false);return;}
  const {data,error:readError}=await supabase.from('crm_interacoes_teste').select('id,tipo,resumo,criado_em').eq('contato_id',historyContact).order('criado_em',{ascending:false}).limit(100);
  if(readError)setHistoryError(readError.message);else {setHistory(data||[]);setHistoryError('');}
  setHistoryText('');setNotice('Interação registrada.');setBusy(false);
 }
 async function loadAgenda(patientId){
  setAgenda([]);setAgendaError('');
  if(!patientId)return;
  const now=crmToday();const start=new Date(now+'T12:00:00Z');start.setUTCDate(start.getUTCDate()-90);
  const end=new Date(now+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+180);
  const ranges=[{p_de:start.toISOString().slice(0,10),p_ate:now},{p_de:now,p_ate:end.toISOString().slice(0,10)}];
  const responses=await Promise.all(ranges.map(params=>supabase.rpc('listar_agendamentos_teste',params)));
  if(responses.some(x=>x.error)){setAgendaError('Não foi possível consultar agendamentos. Verifique a permissão da agenda.');return;}
  const unique=new Map();
  for(const response of responses)for(const a of response.data||[])if(a.paciente_id===patientId)unique.set(a.id,a);
  setAgenda([...unique.values()].sort((a,b)=>String(b.inicio_local).localeCompare(String(a.inicio_local))));
 }
 function editContact(c){setEditing(c.id);setForm({nome:c.nome,telefone:c.telefone,origem:c.origem,interesse:c.interesse,responsavel:c.responsavel,etapa:c.etapa,observacao:c.observacao||'',permite_contato:c.permite_contato,paciente_id:c.paciente_id||''});window.scrollTo({top:0,behavior:'smooth'});}
 const label=(title,child)=><label>{title}{child}</label>;
 return <section className="patients-page crm-page">
  <div className="page-intro"><div><p className="eyebrow">MAJESTIC SANTÉ · RELACIONAMENTO</p><p className="muted">Ambiente de testes. Use apenas contatos fictícios. Nenhuma mensagem é enviada automaticamente.</p></div></div>
  <div className="patient-follow-up-metrics">{metrics.map(([title,value])=><div key={title}><small>{title}</small><strong>{busy?'…':value}</strong></div>)}</div>
  {error&&<p className="form-message" role="alert">{error}</p>}
  {notice&&<p className="form-message" role="status">{notice}</p>}
  <form className="premium-panel registration-panel crm-form" onSubmit={saveContact}>
   <div className="panel-title"><div><h3>{editing?'Editar interessado':'Novo interessado'}</h3><p>Cadastro administrativo, sem informações clínicas sensíveis.</p></div></div>
   <div className="patient-grid contact-grid">
    {label('Paciente cadastrado (vínculo opcional)',<select value={form.paciente_id} onChange={e=>setForm({...form,paciente_id:e.target.value})}><option value="">Não vincular</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select>)}
    {label('Nome',<input required maxLength={150} value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/>)}
    {label('Telefone com DDD',<input required type="tel" maxLength={20} placeholder="(45) 99999-9999" value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/>)}
    {label('Origem',<select value={form.origem} onChange={e=>setForm({...form,origem:e.target.value})}>{Object.entries(origins).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>)}
    {label('Interesse',<select value={form.interesse} onChange={e=>setForm({...form,interesse:e.target.value})}>{Object.entries(interests).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>)}
    {label('Responsável',<select value={form.responsavel} onChange={e=>setForm({...form,responsavel:e.target.value})}><option value="amanda">Amanda</option><option value="bruno">Dr. Bruno</option><option value="carol">Dra. Carol</option></select>)}
    {label('Etapa',<select value={form.etapa} onChange={e=>setForm({...form,etapa:e.target.value})}>{Object.entries(stages).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select>)}
   </div>
   <div className="crm-notes">{label('Observação administrativa (não inserir dados clínicos)',<textarea maxLength={1000} rows={2} value={form.observacao} onChange={e=>setForm({...form,observacao:e.target.value})}/>)}</div>
   <label className="crm-consent"><input type="checkbox" checked={form.permite_contato} onChange={e=>setForm({...form,permite_contato:e.target.checked})}/> Contato autorizou mensagens de acompanhamento (registre autorização verificável antes de uso real)</label>
   <div className="form-actions">{editing&&<button type="button" className="outline-gold" onClick={()=>{setEditing(null);setForm(initial);}}>Cancelar</button>}<button type="submit" className="gold-button" disabled={busy||!canWrite}>{busy?'Salvando...':'Salvar contato'}</button></div>
  </form>
  <form className="premium-panel crm-form" onSubmit={addTask}>
   <div className="panel-title"><div><h3>Criar lembrete</h3><p>O lembrete aparece nesta tela, sem disparar WhatsApp.</p></div></div>
   <div className="patient-grid contact-grid">
    {label('Contato',<select required value={taskContact} onChange={e=>setTaskContact(e.target.value)}><option value="">Selecione</option>{contatos.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>)}
    {label('Lembrar em',<input type="date" required value={taskDate} onChange={e=>setTaskDate(e.target.value)}/>)}
    {label('Tarefa',<input required maxLength={150} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/>)}
   </div>
   <div className="form-actions"><button type="submit" className="gold-button" disabled={busy||!canWrite}>Criar lembrete</button></div>
  </form>
  <div className="premium-panel">
   <div className="panel-title"><div><h3>Lembretes pendentes</h3><p>Prioridade para tarefas de hoje e anteriores.</p></div></div>
   {pending.length===0?<p>Nenhum lembrete pendente.</p>:<div className="patient-follow-up-list">{pending.map(t=>{const c=contatos.find(c=>c.id===t.contato_id);return <div className="patient-follow-up-entry" key={t.id}><strong>{t.vencimento.split('-').reverse().join('/')} · {c?.nome||'Contato indisponível'}</strong><span>{t.titulo}{t.vencimento<=today?' · Precisa de atenção':''}</span><div className="form-actions"><label>Nova data<input aria-label={"Nova data para "+(c?.nome||"contato")} type="date" value={reschedules[t.id]||t.vencimento} onChange={e=>setReschedules(old=>({...old,[t.id]:e.target.value}))}/></label><button type="button" className="outline-gold" disabled={busy} onClick={()=>rescheduleTask(t)}>Reagendar</button><button type="button" className="gold-button" disabled={busy} onClick={()=>finishTask(t.id)}>Concluir</button></div></div>})}</div>}
  </div>
  <div className="premium-panel crm-form">
   <div className="panel-title"><div><h3>Agenda vinculada ao CRM</h3><p>Selecione um contato previamente vinculado a um cadastro de paciente. O vínculo é manual, sem identificação por telefone.</p></div></div>
   <label>Contato<select defaultValue="" onChange={e=>{const c=contatos.find(x=>x.id===e.target.value);loadAgenda(c?.paciente_id);}}><option value="">Selecione</option>{contatos.filter(c=>c.paciente_id).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
   {agendaError&&<p className="form-message" role="alert">{agendaError}</p>}
   {agenda.length===0?<p className="record-empty">Nenhum atendimento encontrado no intervalo consultado, ou nenhum contato selecionado.</p>:<div className="patient-follow-up-list">{agenda.map(a=><div className="patient-follow-up-entry" key={a.id}><strong>{String(a.inicio_local).slice(0,10).split('-').reverse().join('/')} · {String(a.inicio_local).slice(11,16)}</strong><span>{a.tipo} · {a.status} · {a.profissional_nome}</span></div>)}</div>}
   <p className="profile-notice">Somente agendamentos administrativos já autorizados pela agenda. A atualização é manual nesta fase; não altera horários ou prontuários.</p>
  </div>
  <form className="premium-panel crm-form" onSubmit={addHistory}>
   <div className="panel-title"><div><h3>Histórico de relacionamento</h3><p>Registre chamadas e conversas administrativas, sem informações médicas ou dados sensíveis.</p></div></div>
   <div className="patient-grid contact-grid">
    {label('Contato',<select value={historyContact} required onChange={e=>setHistoryContact(e.target.value)}><option value="">Selecione</option>{contatos.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select>)}
    {label('Canal',<select value={historyType} onChange={e=>setHistoryType(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="ligacao">Ligação</option><option value="presencial">Presencial</option><option value="outro">Outro</option></select>)}
   </div>
   <div className="crm-notes">{label('Resumo administrativo',<textarea required minLength={2} maxLength={500} rows={3} value={historyText} onChange={e=>setHistoryText(e.target.value)} placeholder="Exemplo: Pediu para retornar o contato na próxima semana."/>)}</div>
   <div className="form-actions"><button type="submit" className="gold-button" disabled={busy||!historyContact}>Registrar interação</button></div>
   {historyError&&<p role="alert" className="form-message">{historyError}</p>}
   {historyContact&&(history.length===0?<p className="record-empty">Nenhuma interação registrada.</p>:<div className="patient-follow-up-list">{history.map(item=><div className="patient-follow-up-entry" key={item.id}><strong>{({whatsapp:'WhatsApp',ligacao:'Ligação',presencial:'Presencial',outro:'Outro'})[item.tipo]} · {new Date(item.criado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</strong><span>{item.resumo}</span></div>)}</div>)}
  </form>
  <div className="premium-panel directory-panel">
   <div className="panel-title"><div><h3>Contatos cadastrados</h3><p>Abertura do WhatsApp é manual e não envia mensagens.</p></div></div>
   <div className="search-row"><input type="search" aria-label="Buscar contato" placeholder="Buscar nome, telefone ou interesse" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filtrar etapa" value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todas as etapas</option>{Object.entries(stages).map(([id,n])=><option key={id} value={id}>{n}</option>)}</select><button type="button" className="outline-gold" disabled={busy} onClick={reload}>Atualizar</button></div>
   {filtered.length===0?<p>Nenhum contato encontrado.</p>:<div className="patient-follow-up-list">{filtered.map(c=><div className="patient-follow-up-entry" key={c.id}><strong>{c.nome} · {stages[c.etapa]}</strong><span>{interests[c.interesse]} · {origins[c.origem]} · {c.telefone}</span><div className="form-actions"><button type="button" className="outline-gold" onClick={()=>editContact(c)}>Editar</button>{c.permite_contato&&whatsappUrl(c.telefone)&&<a className="gold-button" href={whatsappUrl(c.telefone)} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}</div></div>)}</div>}
  </div>
 </section>;
}
