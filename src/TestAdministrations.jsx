import React,{useEffect,useState} from 'react';
const stamp=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Data indisponível':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)};
export default function TestAdministrations({supabase,patientId,role}){
 const [entries,setEntries]=useState([]),[checks,setChecks]=useState({}),[busy,setBusy]=useState(''),[notes,setNotes]=useState({}),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const canCheck=role==='enfermeira';
 async function load(){
  setLoading(true);setError('');
  const rx=await supabase.from('prescricoes_teste').select('id,criado_em').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100);
  if(rx.error){setError('Não foi possível consultar prescrições: '+rx.error.message);setLoading(false);return;}
  const ids=(rx.data||[]).map(x=>x.id);
  if(!ids.length){setEntries([]);setChecks({});setLoading(false);return;}
  const it=await supabase.from('prescricao_itens_teste').select('id,prescricao_id,medicamento,dose,via,frequencia,duracao,orientacoes').in('prescricao_id',ids);
  if(it.error){setError('Não foi possível consultar medicamentos: '+it.error.message);setLoading(false);return;}
  const items=it.data||[];
  const idsItem=items.map(x=>x.id);
  let grouped={};
  if(idsItem.length){
   const a=await supabase.from('administracoes_teste').select('item_prescricao_id,profissional_id,checado_em,observacao').in('item_prescricao_id',idsItem);
   if(a.error){setError('Não foi possível consultar checagens: '+a.error.message);setLoading(false);return;}
   grouped=Object.fromEntries((a.data||[]).map(v=>[v.item_prescricao_id,v]));
  }
  setChecks(grouped);
  setEntries(items.map(i=>({...i,prescribedAt:(rx.data||[]).find(p=>p.id===i.prescricao_id)?.criado_em})));
  setLoading(false);
 }
 useEffect(()=>{load()},[patientId,role]);
 async function check(item){
  if(!canCheck||busy||checks[item.id])return;
  if(!window.confirm('Confirma registrar a CHECAGEM FICTÍCIA deste item? Esta ação NÃO representa administração real e não movimenta estoque.'))return;
  setBusy(item.id);setError('');setMessage('');
  const {error}=await supabase.from('administracoes_teste').insert({item_prescricao_id:item.id,observacao:(notes[item.id]||'').trim()||null});
  if(error)setError(error.code==='23505'?'Este item já foi checado por outro usuário. Atualize a lista.':'Não foi possível registrar checagem: '+error.message);
  else setMessage('Checagem fictícia registrada no histórico. Nenhum estoque foi alterado.');
  await load();setBusy(''); 
 }
 return <section className="premium-panel test-administrations">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">✓</span><div><h3>Checagem de administração (teste)</h3><p>Registro fictício por item prescrito e por profissional.</p></div></div>
  <p className="profile-notice">Somente simulação. Não confirma que um medicamento foi efetivamente administrado; não movimenta estoque. Cada item aceita apenas uma checagem nesta versão.</p>
  {error&&<p role="alert" className="form-message">{error}</p>}{message&&<p role="status" className="form-message">{message}</p>}
  <div className="record-top"><h4>Itens das prescrições de teste</h4><button type="button" className="outline-gold" disabled={loading} onClick={load}>Atualizar</button></div>
  {loading?<p>Carregando...</p>:entries.length===0?<p className="record-empty">Nenhum item de prescrição encontrado.</p>:<div className="record-list">{entries.map(item=><div key={item.id} className="form-section administration-item">
   <div className="administration-heading"><strong>{item.medicamento}</strong><span>{checks[item.id]?'Checagem registrada':'Pendente no teste'}</span></div>
   <p>Dose: {item.dose} · Via: {item.via} · Frequência: {item.frequencia}</p>{item.duracao&&<p>Duração: {item.duracao}</p>}{item.orientacoes&&<p>Orientações: {item.orientacoes}</p>}
   {checks[item.id]?<p className="administration-checked">Checado em {stamp(checks[item.id].checado_em)} · Profissional ID: {checks[item.id].profissional_id}{checks[item.id].observacao?' · '+checks[item.id].observacao:''}</p>:canCheck?<div className="administration-actions"><label>Observação de teste (opcional)<textarea value={notes[item.id]||''} maxLength={2000} rows={2} onChange={e=>setNotes(o=>({...o,[item.id]:e.target.value}))}/></label><button type="button" className="gold-button" disabled={Boolean(busy)} onClick={()=>check(item)}>{busy===item.id?'Registrando...':'Confirmar checagem fictícia'}</button></div>:<p className="record-empty">Somente o perfil enfermeira pode registrar esta checagem.</p>}
  </div>)}</div>}
 </section>;
}