import React,{useEffect,useState} from 'react';
import CarolProcedures from './CarolProcedures.jsx';
const dateBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const stamp=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'—';
export default function NurseProtocols({supabase}){
 const [protocols,setProtocols]=useState([]),[sessions,setSessions]=useState([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [draft,setDraft]=useState({}),[filter,setFilter]=useState('ativos'),[term,setTerm]=useState('');
 async function load(){
  setLoading(true);setError('');
  const [p,s]=await Promise.all([
   supabase.rpc('protocolos_operacionais_enfermagem_teste'),
   supabase.rpc('sessoes_operacionais_enfermagem_teste')
  ]);
  if(p.error||s.error)setError('Não foi possível carregar os protocolos: '+(p.error||s.error).message);
  else{setProtocols(p.data||[]);setSessions(s.data||[]);}
  setLoading(false);
 }
 useEffect(()=>{load()},[]);
 function update(id,k,v){setDraft(o=>({...o,[id]:{...(o[id]||{}),[k]:v}}));}
 async function reschedule(sess){
  const f=draft[sess.sessao_id]||{},date=f.date||sess.data_prevista,reason=(f.reason||'').trim();
  if(busy)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date===sess.data_prevista||reason.length<5||reason.length>500){
   setError('Escolha uma nova data e informe o motivo (5 a 500 caracteres).');return;
  }
  if(!window.confirm('Reagendar a sessão fictícia de '+dateBR(sess.data_prevista)+' para '+dateBR(date)+'? A checagem e o estoque não serão alterados.'))return;
  setBusy(sess.sessao_id);setError('');setMessage('');
  try{
   const {error:err}=await supabase.rpc('reagendar_sessao_enfermagem_teste',{
    p_sessao_id:sess.sessao_id,p_nova_data:date,p_motivo:reason
   });
   if(err)throw err;
   setDraft(o=>({...o,[sess.sessao_id]:{}}));
   await load();
   setMessage('Data prevista atualizada. Alteração registrada no histórico, sem checagem ou baixa.');
  }catch(err){setError('Não foi possível reagendar: '+err.message);}
  finally{setBusy('');}
 }
 const shown=protocols.filter(p=>(filter!=='ativos'||p.status==='ativo')&&
   [p.nome,p.paciente_nome].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR'))));
 const active=protocols.filter(p=>p.status==='ativo');
 const activeIds=new Set(active.map(p=>p.protocolo_id));
 const planned=sessions.filter(s=>activeIds.has(s.protocolo_id)&&s.status==='agendada');
 const done=planned.filter(s=>s.checado_em).length;
 const noItem=planned.filter(s=>!s.item_prescricao_id).length;
 return <section className="premium-panel nurse-protocols">
  <div className="panel-title"><span className="title-icon">◈</span><div><h3>Protocolos em acompanhamento — Enfermagem</h3><p>Agenda e progresso das sessões de teste, sem dados financeiros.</p></div></div>
  <p className="profile-notice">Somente simulação fictícia. A data planejada é uma estimativa e não comprova administração. O horário da checagem é registrado separadamente. Reagendar não altera a prescrição, o protocolo clínico ou o estoque. Datas fora da vigência devem ser avaliadas pelo médico antes de qualquer procedimento.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}
  {message&&<p className="form-message" role="status">{message}</p>}
  <CarolProcedures supabase={supabase}/>
  <div className="record-top"><h4>Visão operacional</h4><button type="button" className="outline-gold" disabled={loading||Boolean(busy)} onClick={load}>Atualizar</button></div>
  {!loading&&<div className="nursing-summary">
   <div><small>Protocolos ativos</small><strong>{active.length}</strong></div>
   <div><small>Sessões previstas</small><strong>{planned.length}</strong></div>
   <div><small>Checagens vinculadas</small><strong>{done}</strong></div>
   <div><small>Sessões sem prescrição associada</small><strong>{noItem}</strong></div>
  </div>}
  <div className="nursing-toolbar">
   <label>Exibir protocolos<select value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="ativos">Em andamento</option><option value="todos">Todos</option>
   </select></label>
   <label>Buscar paciente ou protocolo<input value={term} onChange={e=>setTerm(e.target.value)}
    placeholder="Buscar..." type="search" maxLength={100}/></label>
  </div>
  {loading?<p>Carregando protocolos...</p>:shown.length===0?<p className="record-empty">Nenhum protocolo encontrado neste filtro.</p>:
   <div className="record-list">{shown.map(p=>{
    const rows=sessions.filter(s=>s.protocolo_id===p.protocolo_id&&s.status!=='cancelada');
    return <div className="form-section nurse-protocol-card" key={p.protocolo_id}>
     <div className="administration-heading"><strong>{p.nome}</strong><span>{p.status==='ativo'?'Em andamento':p.status}</span></div>
     <p>Paciente: <strong>{p.paciente_nome}</strong> · Início: {dateBR(p.inicio)} · Duração: {p.duracao_dias} dias</p>
     <p>Sessões: {p.total_sessoes} · Com checagem: {p.sessoes_checadas} · Pendentes: {p.sessoes_pendentes}</p>
     {rows.length===0?<p>Sem sessões ativas planejadas.</p>:<div className="record-list">{rows.map(sess=>{
      const f=draft[sess.sessao_id]||{};
      const canChange=p.status==='ativo'&&!sess.checado_em;
      return <div className="nurse-protocol-session" key={sess.sessao_id}>
       <div><strong>{dateBR(sess.data_prevista)} · {sess.descricao}</strong>
        <p>{sess.checado_em?'Checagem registrada em '+stamp(sess.checado_em):'Aguardando checagem fictícia'}
         {sess.medicamento?' · '+sess.medicamento+' · '+(sess.dose||'')+' · '+(sess.via||''):' · Sem item prescrito associado'}</p>
       </div>
       {canChange&&<div className="administration-reschedule">
        <label>Nova data prevista<input type="date" value={f.date??sess.data_prevista}
         disabled={Boolean(busy)} onChange={e=>update(sess.sessao_id,'date',e.target.value)}/></label>
        <label>Motivo<input maxLength={500} value={f.reason||''} disabled={Boolean(busy)}
         placeholder="Motivo do reagendamento" onChange={e=>update(sess.sessao_id,'reason',e.target.value)}/></label>
        <button type="button" className="outline-gold" disabled={Boolean(busy)||!(f.reason||'').trim()||(f.date??sess.data_prevista)===sess.data_prevista}
         onClick={()=>reschedule(sess)}>{busy===sess.sessao_id?'Salvando...':'Alterar data'}</button>
       </div>}
      </div>;
     })}</div>}
    </div>;
   })}</div>}
 </section>;
}
