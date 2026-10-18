import React,{useEffect,useState} from 'react';
import DocumentPreparation from './DocumentPreparation.jsx';
const doseUnits=[['ampola','ampola'],['frasco','frasco'],['capsula','cápsula'],['mg','mg']];
const vias=['IM','IV','VO'];
const frequencias=['Semanal','Quinzenal','Mensal'];
const unpackDose=value=>{
 const t=String(value||'').trim();
 const m=t.match(/^(.+?)\\s+(ampola|ampolas|frasco|frascos|cápsula|cápsulas|capsula|capsulas|mg)$/i);
 if(!m)return {doseChoice:t?'outra':'',doseAmount:'',dose:t};
 const normalized=m[2].toLowerCase();
 const doseChoice=normalized.startsWith('ampola')?'ampola':normalized.startsWith('frasco')?'frasco':normalized==='mg'?'mg':'capsula';
 return {doseChoice,doseAmount:m[1],dose:t};
};
const unpackItem=i=>({
 medicamento:String(i.medicamento||''),...unpackDose(i.dose),
 via:String(i.via||''),viaChoice:vias.includes(i.via)?i.via:i.via?'outra':'',
 frequencia:String(i.frequencia||''),frequenciaChoice:frequencias.includes(i.frequencia)?i.frequencia:i.frequencia?'outra':'',
 duracao:String(i.duracao||''),orientacoes:String(i.orientacoes||''),produto_id:'',quantidade_estoque:''
});
const blankItem=()=>unpackItem({});
const formatStamp=v=>{if(!v)return 'Sem data';const d=new Date(v);return Number.isNaN(d.getTime())?'Data indisponível':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d);};
const formatDate=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:'Data não informada';};
export default function TestPrescriptions({supabase,patientId,patientName,canWrite}){
 const [consultations,setConsultations]=useState([]),[prescriptions,setPrescriptions]=useState([]),[itemsById,setItemsById]=useState({});
 const [consultation,setConsultation]=useState(''),[items,setItems]=useState([blankItem()]),[notes,setNotes]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[open,setOpen]=useState(false);
 const [referenceItem,setReferenceItem]=useState(''),[repetitions,setRepetitions]=useState('4');
 const [stockProducts,setStockProducts]=useState([]),[stockLinks,setStockLinks]=useState({});
 async function load(){
  setLoading(true);setError('');
  const [c,p,stock]=await Promise.all([
   supabase.from('consultas_teste').select('id,data_consulta,motivo').eq('paciente_id',patientId).order('data_consulta',{ascending:false}).limit(100),
   supabase.from('prescricoes_teste').select('id,consulta_id,criado_em,observacoes,medico_id').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100),
   supabase.from('estoque_produtos_teste').select('id,nome,unidade,ativo,tipo_produto').eq('tipo_produto','medicamento').eq('ativo',true).order('nome')
  ]);
  if(c.error||p.error){setError('Não foi possível carregar prescrições: '+(c.error||p.error).message);setConsultations([]);setPrescriptions([]);setItemsById({});setLoading(false);return;}
  setConsultations(c.data||[]);setPrescriptions(p.data||[]);
  if(stock.error){setError('Não foi possível consultar medicamentos do estoque: '+stock.error.message);setStockProducts([]);}else setStockProducts(stock.data||[]);
  const ids=(p.data||[]).map(x=>x.id);
  if(ids.length){
   const {data,error}=await supabase.from('prescricao_itens_teste').select('id,prescricao_id,medicamento,dose,via,frequencia,duracao,orientacoes').in('prescricao_id',ids);
   if(error)setError('Prescrições encontradas, mas não foi possível carregar os itens: '+error.message);
   else{const grouped={};for(const i of data||[])(grouped[i.prescricao_id]??=[]).push(i);setItemsById(grouped);
    const itemIds=(data||[]).map(i=>i.id);
    if(itemIds.length){const v=await supabase.from('estoque_vinculos_teste').select('item_prescricao_id,produto_id,quantidade').in('item_prescricao_id',itemIds);
      if(v.error)setError('Prescrições carregadas, mas vínculo ao estoque indisponível: '+v.error.message);
      else setStockLinks(Object.fromEntries((v.data||[]).map(x=>[x.item_prescricao_id,x])));
    }else setStockLinks({});
   }
  }else{setItemsById({});setStockLinks({});}
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
  const draft=unpackItem(selected.item);
  setItems(Array.from({length:count},()=>({...draft})));
  setOpen(true);
  setSuccess(count+' itens preparados como RASCUNHO. A consulta é opcional. Revise TODOS os itens antes de salvar; nenhuma prescrição é criada automaticamente.');
 }

 async function save(e){
  e.preventDefault();setError('');setSuccess('');
  if(!canWrite||busy)return;
  if(consultation&&!consultations.some(c=>c.id===consultation)){setError('A consulta selecionada não pertence ao paciente.');return;}
  if(!items.length||items.some(i=>['medicamento','dose','via','frequencia'].some(k=>!i[k].trim()))){
   setError('Preencha medicamento, dose, via e frequência de todos os itens.');return;
  }
  for(const [index,i] of items.entries()){
   if(i.doseChoice&&i.doseChoice!=='outra'&&!i.doseAmount.trim()){
    setError('Item '+(index+1)+': informe a quantidade da dose/apresentação.');return;
   }
   if(!i.produto_id&&i.quantidade_estoque){setError('Item '+(index+1)+': selecione um produto do estoque ou retire a quantidade.');return;}
   if(i.produto_id){
    const n=Number(i.quantidade_estoque);
    if(!stockProducts.some(p=>p.id===i.produto_id)||!Number.isFinite(n)||n<=0||n>100000||
      Math.abs(Math.round(n*1000)-n*1000)>0.000001){
     setError('Item '+(index+1)+': escolha medicamento ativo e quantidade com até três casas decimais.');return;
    }
   }
  }
  const linkedCount=items.filter(i=>Boolean(i.produto_id)).length;
  if(linkedCount>0&&!window.confirm('Salvar a prescrição fictícia com '+linkedCount+' item(ns) vinculado(s) ao estoque? Confira medicamento, apresentação e quantidade. O estoque NÃO será descontado agora.'))return;
  setBusy(true);
  try{
   const payload=items.map(i=>({
    medicamento:i.medicamento.trim(),dose:i.dose.trim(),via:i.via.trim(),
    frequencia:i.frequencia.trim(),duracao:i.duracao.trim(),orientacoes:i.orientacoes.trim(),
    ...(i.produto_id?{produto_id:i.produto_id,quantidade_estoque:i.quantidade_estoque}:{})
   }));
   const {data:id,error:err}=await supabase.rpc('salvar_prescricao_com_estoque_teste',{
    p_paciente_id:patientId,p_consulta_id:consultation||null,p_itens:payload,p_observacoes:notes.trim()||null
   });
   if(err)throw err;
   setConsultation('');setItems([blankItem()]);setNotes('');setOpen(false);
   await load();
   setSuccess('Prescrição fictícia salva com sucesso. '+linkedCount+' item(ns) preparado(s) para baixa futura, sem descontar estoque. Código: '+id);
  }catch(err){setError('Não foi possível salvar a prescrição ou os vínculos: '+err.message+'. Verifique a migração de prescrição com estoque. Nenhum dado deve ser confirmado parcialmente.');}
  finally{setBusy(false);}
 }
 return <section className="premium-panel prescription-panel">
 <div className="panel-title"><span className="title-icon" aria-hidden="true">✚</span><div><h3>Prescrições de teste</h3><p>Medicamentos fictícios vinculados ao paciente; associação à consulta opcional.</p></div></div>
 {!canWrite?<p className="profile-notice">Acesso restrito ao perfil médico autorizado.</p>:<>
  <p className="profile-notice">Somente testes. É possível associar cada item à quantidade do estoque durante esta prescrição. Nenhum saldo será descontado até a checagem fictícia pela enfermagem. Itens repetidos são rascunhos para revisão médica obrigatória, sem replicação automática de vínculos ao estoque.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}
  {success&&<p className="form-message" role="status">{success}</p>}
  <div className="record-top"><h4>Prescrições de {patientName}</h4><button type="button" className="gold-button" disabled={loading} onClick={()=>setOpen(x=>!x)}>{open?'Fechar formulário':'+ Nova prescrição'}</button></div>
  {!loading&&!consultations.length&&<p className="record-empty">Nenhuma consulta cadastrada. Você pode criar uma prescrição fictícia independente, sem vínculo à consulta.</p>}
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
   <label className="prescription-label">Consulta vinculada (opcional)
    <select value={consultation} onChange={e=>setConsultation(e.target.value)}>
     <option value="">Sem vínculo à consulta — prescrição independente</option>
     {consultations.map(c=><option key={c.id} value={c.id}>{formatDate(c.data_consulta)} · {c.motivo}</option>)}
    </select>
   </label>
   <div className="prescription-items">{items.map((item,index)=><div className="form-section" key={index}>
    <div className="prescription-item-top"><h4>Medicamento {index+1}</h4>{items.length>1&&<button type="button" className="outline-gold" onClick={()=>setItems(old=>old.filter((_,i)=>i!==index))}>Retirar item</button>}</div>
    <div className="clinical-fields">
     <label>Nome do medicamento *<input type="text" maxLength={200} required value={item.medicamento}
       placeholder="Nome do medicamento" onChange={e=>updateItem(index,'medicamento',e.target.value)}/></label>
     <label>Dose / apresentação *
      <select required value={item.doseChoice} onChange={e=>{
       const choice=e.target.value;
       setItems(old=>old.map((v,j)=>j===index?{
        ...v,doseChoice:choice,doseAmount:choice==='outra'?'':v.doseAmount,
        dose:choice==='outra'?'':choice?((v.doseAmount||'')+' '+(doseUnits.find(x=>x[0]===choice)?.[1]||'')).trim():''
       }:v));
      }}>
       <option value="">Selecione uma apresentação</option>
       {doseUnits.map(([id,label])=><option key={id} value={id}>{label==='mg'?'Miligrama (mg)':label[0].toUpperCase()+label.slice(1)}</option>)}
       <option value="outra">Outra — escrever</option>
      </select>
     </label>
     {item.doseChoice&&item.doseChoice!=='outra'&&<label>Quantidade da dose *
      <input type="text" maxLength={60} required placeholder="Ex.: 1, 0,5 ou 500"
       value={item.doseAmount} onChange={e=>{
        const amount=e.target.value;
        setItems(old=>old.map((v,j)=>j===index?{...v,doseAmount:amount,
         dose:(amount+' '+(doseUnits.find(x=>x[0]===v.doseChoice)?.[1]||'')).trim()}:v));
       }}/>
     </label>}
     {item.doseChoice==='outra'&&<label>Descreva a dose / apresentação *
      <input type="text" maxLength={150} required placeholder="Ex.: 5 mL, 1 comprimido..." value={item.dose}
       onChange={e=>updateItem(index,'dose',e.target.value)}/>
     </label>}
     <label>Via de administração *
      <select required value={item.viaChoice} onChange={e=>{
       const choice=e.target.value;
       setItems(old=>old.map((v,j)=>j===index?{...v,viaChoice:choice,via:choice==='outra'?'':choice}:v));
      }}>
       <option value="">Selecione a via</option>
       {vias.map(x=><option key={x} value={x}>{x}</option>)}
       <option value="outra">Outra — escrever</option>
      </select>
     </label>
     {item.viaChoice==='outra'&&<label>Descreva a via de administração *
      <input type="text" required maxLength={100} value={item.via}
       placeholder="Digite a via" onChange={e=>updateItem(index,'via',e.target.value)}/>
     </label>}
     <label>Frequência / intervalo *
      <select required value={item.frequenciaChoice} onChange={e=>{
       const choice=e.target.value;
       setItems(old=>old.map((v,j)=>j===index?{...v,frequenciaChoice:choice,frequencia:choice==='outra'?'':choice}:v));
      }}>
       <option value="">Selecione a frequência</option>
       {frequencias.map(x=><option key={x} value={x}>{x}</option>)}
       <option value="outra">Outra — escrever</option>
      </select>
     </label>
     {item.frequenciaChoice==='outra'&&<label>Descreva a frequência *
      <input type="text" required maxLength={150} value={item.frequencia}
       placeholder="Ex.: a cada 10 dias" onChange={e=>updateItem(index,'frequencia',e.target.value)}/>
     </label>}
     <label>Duração<input type="text" maxLength={150} placeholder="Opcional" value={item.duracao}
       onChange={e=>updateItem(index,'duracao',e.target.value)}/></label>
     <label className="full-span">Orientações fictícias<textarea rows={3} maxLength={3000} value={item.orientacoes} onChange={e=>updateItem(index,'orientacoes',e.target.value)}/></label>
    </div>
    <div className="prescription-stock-link"><strong>Vincular medicamento ao estoque (opcional)</strong>
     <p>Selecione manualmente o produto correspondente à prescrição e a quantidade a descontar somente quando a enfermagem confirmar a checagem.</p>
     <div className="prescription-stock-fields">
      <label>Produto cadastrado no estoque<select value={item.produto_id} onChange={e=>setItems(old=>old.map((entry,j)=>j===index?{...entry,produto_id:e.target.value,quantidade_estoque:e.target.value?entry.quantidade_estoque:''}:entry))}>
       <option value="">Sem vínculo agora — Dra. Carol poderá vincular depois</option>
       {stockProducts.map(p=><option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
      </select></label>
      {item.produto_id&&<label>Quantidade consumida por aplicação ({stockProducts.find(p=>p.id===item.produto_id)?.unidade||'un.'})
       <input type="number" required min="0.001" max="100000" step="0.001" value={item.quantidade_estoque}
        onChange={e=>updateItem(index,'quantidade_estoque',e.target.value)} placeholder="Ex.: 1"/>
      </label>}
     </div>
     {!stockProducts.length&&<small>Nenhum medicamento ativo no estoque. Você poderá salvar sem vínculo e cadastrar o produto posteriormente.</small>}
    </div>
   </div>)}</div>
   <button type="button" className="outline-gold" disabled={items.length>=20} onClick={()=>setItems(old=>[...old,blankItem()])}>+ Adicionar medicamento</button>
   <label className="prescription-label">Observações gerais<textarea value={notes} rows={3} maxLength={3000} onChange={e=>setNotes(e.target.value)}/></label>
   <div className="form-actions"><button type="button" className="outline-gold" onClick={()=>setOpen(false)}>Cancelar</button><button type="submit" className="gold-button" disabled={busy}>{busy?'Salvando...':'Salvar prescrição de teste'}</button></div>
  </form>}
  {loading?<p>Carregando prescrições...</p>:prescriptions.length===0?<p className="record-empty">Nenhuma prescrição de teste registrada.</p>:<div className="record-list">{prescriptions.map(p=><details className="record-entry" key={p.id}><summary><span>{formatStamp(p.criado_em)} · {itemsById[p.id]?.length||0} item(ns) · {p.consulta_id?'Com consulta':'Sem consulta vinculada'}</span><span>Ver medicamentos</span></summary><div className="record-content">{p.observacoes&&<div><strong>Observações gerais</strong><p>{p.observacoes}</p></div>}{(itemsById[p.id]||[]).map((item,i)=><div key={i} className="prescription-preview"><strong>{i+1}. {item.medicamento}</strong><p>Dose: {item.dose} · Via: {item.via} · Frequência: {item.frequencia}</p>{item.duracao&&<p>Duração: {item.duracao}</p>}{item.orientacoes&&<p>Orientações: {item.orientacoes}</p>}{stockLinks[item.id]?<p><strong>Estoque preparado:</strong> {stockLinks[item.id].quantidade} {stockProducts.find(x=>x.id===stockLinks[item.id].produto_id)?.unidade||'un.'} de {stockProducts.find(x=>x.id===stockLinks[item.id].produto_id)?.nome||'medicamento cadastrado'}. Baixa somente na checagem.</p>:<p>Estoque ainda não vinculado — preparação poderá ser feita pela enfermagem.</p>}</div>)}<DocumentPreparation kind="receita" document={{...p,items:itemsById[p.id]||[]}} patientName={patientName}/></div></details>)}</div>}
 </>}
 </section>;
}
