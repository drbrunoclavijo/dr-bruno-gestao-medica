import React,{useEffect,useState} from 'react';
import DocumentPreparation from './DocumentPreparation.jsx';
const blank=()=>({medicamento:'',posologia:'',quantidade:'',orientacoes:''});
const time=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'—';
export default function HomePrescriptions({supabase,patientId,patientName}){
 const [items,setItems]=useState([blank()]),[obs,setObs]=useState(''),[rows,setRows]=useState([]),
 [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[open,setOpen]=useState(false);
 async function load(){
  setLoading(true);
  const {data,error:err}=await supabase.from('receitas_domiciliares_teste')
   .select('id,paciente_id,medico_id,criado_em,tipo,indicacoes,observacoes,status_assinatura')
   .eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100);
  if(err){setError('Área de receitas domiciliares indisponível: '+err.message+'. Execute a migração SQL específica em ambiente de testes.');setRows([]);}
  else{setError('');setRows(data||[]);}
  setLoading(false);
 }
 useEffect(()=>{load();},[patientId]);
 const set=(index,key,value)=>setItems(old=>old.map((item,i)=>index===i?{...item,[key]:value}:item));
 async function save(e){
  e.preventDefault();setNotice('');setError('');
  if(items.some(x=>!x.medicamento.trim()||!x.posologia.trim())){setError('Informe medicamento e posologia em todos os itens.');return;}
  if(!window.confirm('Salvar RECEITA DOMICILIAR FICTÍCIA NÃO ASSINADA? Não é receita válida para dispensação.'))return;
  setBusy(true);
  const {error:err}=await supabase.rpc('salvar_receita_domiciliar_teste',{p_paciente_id:patientId,p_indicacoes:items.map(x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v.trim()]))),p_observacoes:obs.trim()||null});
  if(err)setError('Não foi possível salvar: '+err.message);
  else{setItems([blank()]);setObs('');setOpen(false);await load();setNotice('Rascunho de receita domiciliar salvo. SEM assinatura Bird ID e SEM envio WhatsApp.');}
  setBusy(false);
 }
 return <section className="premium-panel home-rx-panel">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">✎</span><div>
   <h3>Receita domiciliar — Teste</h3><p>Receitas para uso domiciliar, separadas das prescrições de aplicações e estoque.</p>
  </div></div>
  <p className="profile-notice">Somente receitas simples fictícias. Não emitir receitas controladas, notificações especiais ou documentos para uso real. A assinatura Bird ID e o envio de PDF pelo WhatsApp ainda não estão habilitados.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}
  {notice&&<p className="form-message" role="status">{notice}</p>}
  <div className="record-top"><h4>Receitas de {patientName}</h4><button type="button" className="gold-button" disabled={loading} onClick={()=>setOpen(x=>!x)}>{open?'Fechar formulário':'+ Nova receita domiciliar'}</button></div>
  {open&&<form className="prescription-form" onSubmit={save}>
   {items.map((item,i)=><div key={i} className="form-section">
    <div className="prescription-item-top"><h4>Medicamento {i+1}</h4>{items.length>1&&<button type="button" className="outline-gold" onClick={()=>setItems(old=>old.filter((_,j)=>j!==i))}>Remover</button>}</div>
    <div className="clinical-fields">
     <label>Medicamento *<input required maxLength={200} value={item.medicamento} onChange={e=>set(i,'medicamento',e.target.value)}/></label>
     <label>Posologia completa *<textarea required rows={2} maxLength={500} value={item.posologia} onChange={e=>set(i,'posologia',e.target.value)} placeholder="Dose, via, frequência e duração definidas pelo médico"/></label>
     <label>Quantidade / apresentação<input maxLength={120} value={item.quantidade} onChange={e=>set(i,'quantidade',e.target.value)}/></label>
     <label>Orientações adicionais<textarea rows={2} maxLength={1000} value={item.orientacoes} onChange={e=>set(i,'orientacoes',e.target.value)}/></label>
    </div>
   </div>)}
   <button type="button" className="outline-gold" disabled={items.length>=20} onClick={()=>setItems(old=>[...old,blank()])}>+ Adicionar medicamento</button>
   <label className="prescription-label">Observações gerais<textarea rows={3} maxLength={2000} value={obs} onChange={e=>setObs(e.target.value)}/></label>
   <div className="form-actions"><button type="button" className="outline-gold" onClick={()=>setOpen(false)}>Cancelar</button><button className="gold-button" disabled={busy}>{busy?'Salvando...':'Salvar rascunho não assinado'}</button></div>
  </form>}
  {loading?<p>Carregando receitas domiciliares...</p>:rows.length===0?<p className="record-empty">Nenhuma receita domiciliar de teste registrada.</p>:
   <div className="record-list">{rows.map(r=><details key={r.id} className="record-entry">
    <summary><span>{time(r.criado_em)} · {r.indicacoes?.length||0} medicamento(s)</span><span>NÃO ASSINADA · Ver</span></summary>
    <div className="record-content">
     {(r.indicacoes||[]).map((m,i)=><div key={i}><strong>{i+1}. {m.medicamento}</strong><p>{m.posologia}{m.quantidade?' · '+m.quantidade:''}</p>{m.orientacoes&&<p>{m.orientacoes}</p>}</div>)}
     {r.observacoes&&<p>{r.observacoes}</p>}
     <DocumentPreparation kind="domiciliar" document={{...r,items:r.indicacoes}} patientName={patientName} patientId={patientId} supabase={supabase}/>
    </div>
   </details>)}</div>}
 </section>;
}
