import React,{useEffect,useState} from 'react';
const blankItem=()=>({medicamento:'',dose:'',via:'',frequencia:'',duracao:'',orientacoes:''});
const formatStamp=v=>{if(!v)return 'Sem data';const d=new Date(v);return Number.isNaN(d.getTime())?'Data indisponível':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d);};
const formatDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:'Data não informada';};
export default function TestPrescriptions({supabase,patientId,patientName,canWrite}){
 const [consultations,setConsultations]=useState([]),[prescriptions,setPrescriptions]=useState([]),[itemsById,setItemsById]=useState({});
 const [consultation,setConsultation]=useState(''),[items,setItems]=useState([blankItem()]),[notes,setNotes]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[open,setOpen]=useState(false);
 const [referenceItem,setReferenceItem]=useState(''),[repetitions,setRepetitions]=useState('4');
 async function load(){
  setLoading(true);setError('');
  const [c,p]=await Promise.all([
   supabase.from('consultas_teste').select('id,data_consulta,motivo').eq('paciente_id',patientId).order('data_consulta',{ascending:false}).limit(100),
   supabase.from('prescricoes_teste').select('id,consulta_id,criado_em,observacoes,medico_id').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100)
  ]);
  if(c.error||p.error){setError('Não foi possível carregar prescrições: '+(c.error||p.error).message);setConsultations([]);setPrescriptions([]);setItemsById({});setLoading(false);return;}
  setConsultations(c.data||[]);setPrescriptions(p.data||[]);
  const ids=(p.data||[]).map(x=>x.id);
  if(ids.length){
   const {data,error}=await supabase.from('prescricao_itens_teste').select('prescricao_id,medicamento,dose,via,frequencia,duracao,orientacoes').in('prescricao_id',ids);
   if(error)setError('Prescrições encontradas, mas não foi possível carregar os itens: '+error.message);
   else{const grouped={};for(const i of data||[])(grouped[i.prescricao_id]??=[]).push(i);setItemsById(grouped);}
  }else setItemsById({});
  setLoading(false);
 }
 useEffect(()=>{if(canWrite)load();},[patientId,canWrite]);
 const updateItem=(index,k,value)=>setItems(old=>old.map((item,i)=>i===index?{...item,[k]:value}:item));
 const referenceOptions=prescriptions.flatMap(p=>(itemsById[p.id]||[]).map((it,i)=>({
   value:p.id+':'+i,item:it,label:formatStamp(p.criado_em)+' · '+it.medicamento+' · '+it.dose+' · '+it.via
 })));
 function duplicateForSessions(){
  setError('');setSuccess('');
  const selected=referenceOptions.find(o=>o.value===referenceItem);
  const count=Number(repetitions);
  if(!selected){setError('Selecione um item de prescrição fictícia anterior.');return;}
  if(!Number.isInteger(count)||count<1||count>20){setError('Escolha de 1 a 20 aplicações para preparar.');return;}
  if(!window.confirm('Preparar '+count+' itens de rascunho com os dados da prescrição anterior? Confira dose, via e frequência de CADA item antes de salvar.'))return;
  const fields=['medicamento','dose','via','frequencia','duracao','orientacoes'];
  const draft=Object.fromEntries(fields.map(k=>[k,String(selected.item[k]||'')]));
  setItems(Array.from({length:count},()=>({...draft})));
  setOpen(true);
  setSuccess(count+' itens preenchidos como RASCUNHO. Selecione uma consulta e revise TODOS os itens. Nada foi prescrito ou registrado automaticamente.');
 }

 async function save(e){
  e.preventDefault();setError('');setSuccess('');
  if(!canWrite||busy)return;
  if(!consultations.some(c=>c.id===consultation)){setError('Selecione uma consulta deste paciente.');return;}
  if(!items.length||items.some(i=>['medicamento','dose','via','frequencia'].some(k=>!i[k].trim()))){setError('Preencha medicamento, dose, via e frequência de todos os itens.');return;}
  setBusy(true);
  const {error,id,data}=await (async()=>{const r=await supabase.rpc('salvar_prescricao_teste',{p_paciente_id:patientId,p_consulta_id:consultation,p_itens:items.map(i=>Object.fromEntries(Object.entries(i).map(([k,v])=>[k,v.trim()]))),p_observacoes:notes.trim()||null});return {error:r.error,id:r.data};})();
  if(error){setError('Não foi possível salvar: '+error.message+'. Verifique se a função salvar_prescricao_teste foi instalada no Supabase.');setBusy(false);return;}
  setSuccess('Prescrição fictícia registrada. Código: '+id);setConsultation('');setItems([blankItem()]);setNotes('');setOpen(false);await load();setBusy(false);
 }
 return <section className="premium-panel prescription-panel">
 <div className="panel-title"><span className="title-icon" aria-hidden="true">✚</span><div><h3>Prescrições de teste</h3><p>Medicamentos fictícios vinculados ao paciente e a uma consulta registrada.</p></div></div>
 {!canWrite?<p className="profile-notice">Acesso restrito ao perfil médico autorizado.</p>:<>
  <p className="profile-notice">Somente testes. Nenhuma prescrição é assinada ou enviada; medicamentos precisam de vínculo com estoque antes da checagem. Itens repetidos são apenas sugestões copiadas para revisão médica obrigatória, não uma prescrição automática.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}
  {success&&<p className="form-message" role="status">{success}</p>}
  <div className="record-top"><h4>Prescrições de {patientName}</h4><button type="button" className="gold-button" disabled={loading||!consultations.length} onClick={()=>setOpen(x=>!x)}>{open?'Fechar formulário':'+ Nova prescrição'}</button></div>
  {!loading&&!consultations.length&&<p className="record-empty">Salve uma consulta fictícia no prontuário antes de criar prescrições.</p>}
  {!loading&&referenceOptions.length>0&&<div className="form-section prescription-repeat">
    <h4>Preparar aplicações repetidas (rascunho)</h4>
    <p>Reaproveite um item de prescrição fictícia anterior do MESMO paciente para preencher vários itens independentes. Este recurso não decide dose, duração ou intervalo: a revisão e o salvamento são exclusivamente médicos.</p>
    <div className="prescription-repeat-grid">
      <label>Item de referência<select value={referenceItem} onChange={e=>setReferenceItem(e.target.value)}>
       <option value="">Selecione um item anterior</option>
       {referenceOptions.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}
      </select></label>
      <label>Número de aplicações<input type="number" min="1" max="20" step="1" value={repetitions} onChange={e=>setRepetitions(e.target.value)}/></label>
      <button type="button" className="outline-gold" disabled={!referenceItem||busy} onClick={duplicateForSessions}>Preparar itens para revisão</button>
    </div>
    <small>Limite de 20 itens por rascunho. Não vincula sessões, não copia estoque nem realiza checagem. Cada item deverá ser associado a uma sessão de teste após salvar e vincular a prescrição ao protocolo.</small>
  </div>}
  {open&&<form className="prescription-form" onSubmit={save}>
   <label className="prescription-label">Consulta vinculada
    <select value={consultation} required onChange={e=>setConsultation(e.target.value)}>
     <option value="">Selecione uma consulta</option>
     {consultations.map(c=><option key={c.id} value={c.id}>{formatDate(c.data_consulta)} · {c.motivo}</option>)}
    </select>
   </label>
   <div className="prescription-items">{items.map((item,index)=><div className="form-section" key={index}>
    <div className="prescription-item-top"><h4>Medicamento {index+1}</h4>{items.length>1&&<button type="button" className="outline-gold" onClick={()=>setItems(old=>old.filter((_,i)=>i!==index))}>Retirar item</button>}</div>
    <div className="clinical-fields">
    {[['medicamento','Nome do medicamento',200],['dose','Dose / apresentação',150],['via','Via de administração',100],['frequencia','Frequência / intervalo',150],['duracao','Duração',150]].map(([k,label,max])=><label key={k}>{label}{k!=='duracao'?' *':''}<input type="text" maxLength={max} required={k!=='duracao'} placeholder={label} value={item[k]} onChange={e=>updateItem(index,k,e.target.value)}/></label>)}
    <label className="full-span">Orientações fictícias<textarea rows={3} maxLength={3000} value={item.orientacoes} onChange={e=>updateItem(index,'orientacoes',e.target.value)}/></label>
    </div>
   </div>)}</div>
   <button type="button" className="outline-gold" disabled={items.length>=20} onClick={()=>setItems(old=>[...old,blankItem()])}>+ Adicionar medicamento</button>
   <label className="prescription-label">Observações gerais<textarea value={notes} rows={3} maxLength={3000} onChange={e=>setNotes(e.target.value)}/></label>
   <div className="form-actions"><button type="button" className="outline-gold" onClick={()=>setOpen(false)}>Cancelar</button><button type="submit" className="gold-button" disabled={busy}>{busy?'Salvando...':'Salvar prescrição de teste'}</button></div>
  </form>}
  {loading?<p>Carregando prescrições...</p>:prescriptions.length===0?<p className="record-empty">Nenhuma prescrição de teste registrada.</p>:<div className="record-list">{prescriptions.map(p=><details className="record-entry" key={p.id}><summary><span>{formatStamp(p.criado_em)} · {itemsById[p.id]?.length||0} item(ns)</span><span>Ver medicamentos</span></summary><div className="record-content">{p.observacoes&&<div><strong>Observações gerais</strong><p>{p.observacoes}</p></div>}{(itemsById[p.id]||[]).map((item,i)=><div key={i} className="prescription-preview"><strong>{i+1}. {item.medicamento}</strong><p>Dose: {item.dose} · Via: {item.via} · Frequência: {item.frequencia}</p>{item.duracao&&<p>Duração: {item.duracao}</p>}{item.orientacoes&&<p>Orientações: {item.orientacoes}</p>}</div>)}</div></details>)}</div>}
 </>}
 </section>;
}
