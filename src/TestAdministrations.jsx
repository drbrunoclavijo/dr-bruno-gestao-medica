import React,{useEffect,useState} from 'react';
const stamp=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Data indisponível':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)};
export default function TestAdministrations({supabase,patientId,role}){
 const [currentUserId,setCurrentUserId]=useState(null),[photos,setPhotos]=useState({}),[photoLinks,setPhotoLinks]=useState({}),[names,setNames]=useState({}),[entries,setEntries]=useState([]),[checks,setChecks]=useState({}),[links,setLinks]=useState({}),[products,setProducts]=useState([]),[busy,setBusy]=useState(''),[notes,setNotes]=useState({}),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const canCheck=role==='enfermeira';
 const [sessionByItem,setSessionByItem]=useState({});
 const [dateDrafts,setDateDrafts]=useState({}),[dateReasons,setDateReasons]=useState({}),[dateHistory,setDateHistory]=useState([]);
 const dateBR=v=>String(v||'').slice(0,10).split('-').reverse().join('/');
 const dateHistoryFor=id=>dateHistory.filter(x=>x.sessao_id===id);

 const [viewFilter,setViewFilter]=useState('pendentes'),[searchTerm,setSearchTerm]=useState('');
 const [supplies,setSupplies]=useState([]),[supplyProducts,setSupplyProducts]=useState([]),[supplyMoves,setSupplyMoves]=useState([]),[supplyPick,setSupplyPick]=useState({}),[supplyQty,setSupplyQty]=useState({});
 const [medicationProducts,setMedicationProducts]=useState([]),[medicationPick,setMedicationPick]=useState({}),[medicationQty,setMedicationQty]=useState({});
 async function load(){
  setLoading(true);setError('');
  const {data:authData}=await supabase.auth.getUser();
  setCurrentUserId(authData?.user?.id||null);
  const rx=await supabase.from('prescricoes_teste').select('id,criado_em').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100);
  if(rx.error){setError('Não foi possível consultar prescrições: '+rx.error.message);setLoading(false);return;}
  const ids=(rx.data||[]).map(x=>x.id);
  if(!ids.length){setEntries([]);setChecks({});setNames({});setSupplies([]);setSupplyMoves([]);setSessionByItem({});setDateHistory([]);setLoading(false);return;}
  const it=await supabase.from('prescricao_itens_teste').select('id,prescricao_id,medicamento,dose,via,frequencia,duracao,orientacoes').in('prescricao_id',ids);
  if(it.error){setError('Não foi possível consultar medicamentos: '+it.error.message);setLoading(false);return;}
  const items=it.data||[];
  const idsItem=items.map(x=>x.id);
  let grouped={};
  if(idsItem.length){
   const a=await supabase.from('administracoes_teste').select('item_prescricao_id,profissional_id,checado_em,observacao,foto_caminho').in('item_prescricao_id',idsItem);
   if(a.error){setError('Não foi possível consultar checagens: '+a.error.message);setLoading(false);return;}
   grouped=Object.fromEntries((a.data||[]).map(v=>[v.item_prescricao_id,v]));
  }
  setChecks(grouped);
  const professionalIds=[...new Set(Object.values(grouped).map(c=>c.profissional_id))];
  if(professionalIds.length){
   const {data:named,error:nameError}=await supabase.rpc('nomes_checagem_teste',{p_paciente_id:patientId});
   if(!nameError)setNames(Object.fromEntries((named||[]).map(p=>[p.profissional_id,p.nome])));
   else setNames({});
  }else setNames({});
  const [vl,pr]=await Promise.all([
   supabase.from('estoque_vinculos_teste').select('item_prescricao_id,produto_id,quantidade').in('item_prescricao_id',idsItem),
   supabase.from('estoque_produtos_teste').select('id,nome,unidade,ativo,tipo_produto')
  ]);
  if(vl.error||pr.error){setError('Não foi possível consultar vínculos ao estoque: '+(vl.error||pr.error).message);setLoading(false);return;}
  setLinks(Object.fromEntries((vl.data||[]).map(v=>[v.item_prescricao_id,v])));
  setProducts(pr.data||[]);
  setMedicationProducts((pr.data||[]).filter(p=>p.ativo&&p.tipo_produto==='medicamento'));
  const [planned,prods]=await Promise.all([
   supabase.from('insumos_itens_teste').select('id,item_prescricao_id,produto_id,quantidade').in('item_prescricao_id',idsItem),
   supabase.from('estoque_produtos_teste').select('id,nome,unidade,ativo,tipo_produto').eq('tipo_produto','insumo')
  ]);
  if(planned.error||prods.error){
   setError('Não foi possível carregar insumos: '+(planned.error||prods.error).message);
   setLoading(false);return;
  }
  const supplyIds=(planned.data||[]).map(x=>x.id);
  let movements=[];
  if(supplyIds.length){
   const result=await supabase.from('insumos_movimentos_teste')
    .select('insumo_item_id,quantidade,custo_saida').in('insumo_item_id',supplyIds).limit(1000);
   if(result.error){setError('Não foi possível carregar custos dos insumos: '+result.error.message);setLoading(false);return;}
   movements=result.data||[];
  }
  setSupplies(planned.data||[]);setSupplyProducts(prods.data||[]);setSupplyMoves(movements);
  const [sessionData,historyData]=await Promise.all([
   supabase.rpc('sessoes_paciente_enfermagem_teste',{p_paciente_id:patientId}),
   supabase.rpc('historico_reagendamentos_sessoes_teste',{p_paciente_id:patientId})
  ]);
  if(sessionData.error||historyData.error){setError('Não foi possível consultar a agenda ou histórico: '+(sessionData.error||historyData.error).message);setLoading(false);return;}
  setSessionByItem(Object.fromEntries((sessionData.data||[]).map(x=>[x.item_prescricao_id,x])));
  setDateHistory(historyData.data||[]);
  setEntries(items.map(i=>({...i,prescribedAt:(rx.data||[]).find(p=>p.id===i.prescricao_id)?.criado_em})));
  setLoading(false);
 }
 useEffect(()=>{load()},[patientId,role]);
 async function reschedule(item){
  const sess=sessionByItem[item.id],newDate=dateDrafts[item.id]||'',
    reason=(dateReasons[item.id]||'').trim();
  if(!canCheck||busy||checks[item.id]||!sess)return;
  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(newDate)||reason.length<5||reason.length>500){
   setError('Informe uma nova data e o motivo do reagendamento (5 a 500 caracteres).');return;
  }
  if(newDate===sess.data_prevista){setError('Escolha uma data diferente da prevista.');return;}
  if(!window.confirm('Alterar a previsão de '+dateBR(sess.data_prevista)+' para '+dateBR(newDate)+'? Isso NÃO modifica a data da checagem, a prescrição ou o estoque.'))return;
  setBusy(item.id);setError('');setMessage('');
  try{
   const {error:changeError}=await supabase.rpc('reagendar_sessao_enfermagem_teste',{
    p_sessao_id:sess.sessao_id,p_nova_data:newDate,p_motivo:reason
   });
   if(changeError)throw new Error(changeError.message);
   setDateDrafts(old=>({...old,[item.id]:''}));setDateReasons(old=>({...old,[item.id]:''}));
   await load();
   setMessage('Previsão de sessão fictícia alterada com histórico. Checagem e estoque não foram modificados.');
  }catch(err){setError('Não foi possível reagendar: '+err.message);}
  finally{setBusy('');}
 }
 async function viewPhoto(item){
  const path=checks[item.id]?.foto_caminho;
  if(!path){setError('Este registro de teste não possui foto anexada.');return;}
  setError('');
  const {data,error}=await supabase.storage.from('comprovantes-checagem-teste').createSignedUrl(path,60);
  if(error||!data?.signedUrl){setError('Não foi possível abrir a foto: '+(error?.message||'acesso indisponível'));return;}
  setPhotoLinks(old=>({...old,[item.id]:data.signedUrl}));
 }
 const permittedTypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 function validateFile(file){
  return file && permittedTypes[file.type] && file.size>0 && file.size<=6*1024*1024;
 }
 async function uploadPhoto(item){
  const file=photos[item.id];
  if(!validateFile(file))throw new Error('Selecione uma imagem fictícia JPG, PNG ou WebP de até 6 MB.');
  const {data,error}=await supabase.auth.getUser();
  if(error||!data?.user?.id)throw new Error('Sessão indisponível; entre novamente.');
  const path=data.user.id+'/'+item.id+'/'+crypto.randomUUID()+'.'+permittedTypes[file.type];
  const up=await supabase.storage.from('comprovantes-checagem-teste').upload(path,file,{
   contentType:file.type,cacheControl:'3600',upsert:false
  });
  if(up.error)throw new Error('Não foi possível enviar a foto: '+up.error.message);
  return path;
 }
 async function check(item){
  if(!canCheck||busy||checks[item.id])return;
  const file=photos[item.id];
  if(file && !validateFile(file)){setError('A imagem precisa ser JPG, PNG ou WebP de até 6 MB.');return;}
  if(!window.confirm('Confirmar CHECAGEM FICTÍCIA e baixar o estoque de testes? A foto é OPCIONAL e poderá ser anexada depois.'))return;
  setBusy(item.id);setError('');setMessage('');
  try{
   let path=null;
   if(file)path=await uploadPhoto(item);
   const fn=path?'checar_com_foto_e_baixar_estoque_teste':'checar_e_baixar_estoque_teste';
   const args=path?{p_item_id:item.id,p_observacao:(notes[item.id]||'').trim()||null,p_foto_caminho:path}
                  :{p_item_id:item.id,p_observacao:(notes[item.id]||'').trim()||null};
   const {error}=await supabase.rpc(fn,args);
   if(error)throw new Error(error.message+(path?' (a foto já foi enviada, mas a checagem NÃO foi concluída; avise o administrador para revisar o arquivo pendente)':''));
   setMessage('Checagem fictícia e baixa de estoque registradas. '+(path?'Foto anexada.':'A foto poderá ser enviada posteriormente.'));
   setPhotos(old=>({...old,[item.id]:null}));
   await load();
  }catch(err){setError('Não foi possível registrar a checagem: '+err.message);}
  finally{setBusy('');}
 }
 async function attachLater(item){
  const record=checks[item.id];
  if(!canCheck||busy||!record||record.foto_caminho||record.profissional_id!==currentUserId)return;
  if(!validateFile(photos[item.id])){setError('Selecione uma foto fictícia JPG, PNG ou WebP de até 6 MB.');return;}
  if(!window.confirm('Anexar esta foto à checagem já registrada? O estoque não será alterado.'))return;
  setBusy(item.id);setError('');setMessage('');
  try{
   const path=await uploadPhoto(item);
   const {error}=await supabase.rpc('anexar_foto_checagem_teste',{p_item_id:item.id,p_foto_caminho:path});
   if(error)throw new Error(error.message+' (o arquivo enviado está pendente de vínculo; informe ao administrador)');
   setMessage('Foto anexada ao registro anterior, sem nova baixa no estoque.');
   setPhotos(old=>({...old,[item.id]:null}));
   await load();
  }catch(err){setError('Não foi possível anexar foto: '+err.message);}
  finally{setBusy('');}
 }
 async function bindMedication(item){
  if(!canCheck||busy||checks[item.id]||links[item.id])return;
  const productId=medicationPick[item.id],quantity=Number(medicationQty[item.id]||'1');
  if(!productId||!Number.isFinite(quantity)||quantity<=0||quantity>100000||Math.round(quantity*1000)!==quantity*1000){
   setError('Selecione o medicamento do estoque e informe uma quantidade valida, com ate 3 casas decimais.');return;
  }
  const chosen=medicationProducts.find(p=>p.id===productId);
  if(!chosen){setError('Selecione um medicamento ativo, nao um insumo.');return;}
  if(!window.confirm('Conferiu a prescricao, concentracao/apresentacao, via e quantidade? Vincular '+quantity+' '+chosen.unidade+' de '+chosen.nome+' ao item ficticio '+item.medicamento+'? Isso ainda nao desconta estoque.'))return;
  setBusy(item.id);setError('');setMessage('');
  try{
   const {error:err}=await supabase.rpc('vincular_medicamento_enfermagem_teste',{
    p_item_id:item.id,p_produto_id:productId,p_quantidade:quantity
   });
   if(err)throw new Error(err.message);
   await load();
   setMessage('Medicamento associado ao estoque ficticio. Confira insumos e so depois confirme a checagem.');
  }catch(err){setError('Nao foi possivel vincular ao estoque: '+err.message);}
  finally{setBusy('');}
 }
 async function configureSupply(item,remove=false,productOverride=null){
  if(!canCheck||busy||checks[item.id])return;
  const id=productOverride||supplyPick[item.id],qty=Number(supplyQty[item.id]||'1');
  if(!id||(!remove&&(!Number.isFinite(qty)||qty<=0))){setError('Selecione um insumo e uma quantidade válida.');return;}
  setBusy(item.id);setError('');setMessage('');
  const {error}=await supabase.rpc(remove?'remover_insumo_item_teste':'configurar_insumo_item_teste',
   remove?{p_item_id:item.id,p_produto_id:id}:{p_item_id:item.id,p_produto_id:id,p_quantidade:qty});
  if(error)setError('Não foi possível atualizar insumos: '+error.message);
  else{await load();setMessage(remove?'Insumo removido antes da checagem.':'Insumo preparado para baixa junto à checagem fictícia.');}
  setBusy('');
 }
 const suppliesFor=item=>supplies.filter(x=>x.item_prescricao_id===item.id);
 const suppliesUI=item=><div className="supply-checagem">
  <strong>Insumos da aplicação fictícia</strong>
  <p>Soro, equipo, Jelco e outros materiais: selecione a quantidade efetivamente utilizada. A baixa será registrada junto à checagem do medicamento, uma única vez.</p>
  {suppliesFor(item).length>0?<div className="record-list">
   {suppliesFor(item).map(x=>{
    const p=supplyProducts.find(t=>t.id===x.produto_id);
    const moves=supplyMoves.filter(m=>m.insumo_item_id===x.id);
    const known=moves.reduce((n,m)=>n+Number(m.custo_saida||0),0);
    const missing=moves.some(m=>m.custo_saida==null);
    return <div className="supply-line" key={x.id}>
     <span>{p?.nome||'Insumo'} · {x.quantidade} {p?.unidade||'un.'}
      {checks[item.id]&&<small> · Custo baixado: {moves.length?(missing?'parcial / não informado':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(known)):'não localizado'}</small>}
     </span>
     {canCheck&&!checks[item.id]&&<button type="button" className="outline-gold" disabled={Boolean(busy)} onClick={()=>configureSupply(item,true,x.produto_id)}>Remover</button>}
    </div>;
   })}
  </div>:<p className="record-empty">Nenhum insumo informado.</p>}
  {canCheck&&!checks[item.id]&&<div className="supply-add-row">
   <label>Insumo
    <select value={supplyPick[item.id]||''} onChange={e=>setSupplyPick(v=>({...v,[item.id]:e.target.value}))}>
     <option value="">Selecione insumo do estoque</option>
     {supplyProducts.filter(p=>p.ativo).map(p=><option value={p.id} key={p.id}>{p.nome} ({p.unidade})</option>)}
    </select>
   </label>
   <label>Quantidade<input type="number" min="0.001" step="0.001" value={supplyQty[item.id]||'1'} onChange={e=>setSupplyQty(v=>({...v,[item.id]:e.target.value}))}/></label>
   <button type="button" className="outline-gold" disabled={Boolean(busy)||!supplyPick[item.id]} onClick={()=>configureSupply(item)}>Adicionar insumo</button>
  </div>}
 </div>;
 const allPending=entries.filter(item=>!checks[item.id]);
 const allChecked=entries.filter(item=>Boolean(checks[item.id]));
 const assignedPending=allPending.filter(item=>Boolean(sessionByItem[item.id]));
 const missingStock=allPending.filter(item=>!links[item.id]);
 const todayLocal=()=>{
  const d=new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 };
 const todayDate=todayLocal();
 const overdue=assignedPending.filter(item=>sessionByItem[item.id]?.data_prevista<todayDate);
 const visibleItems=entries.filter(item=>{
  const checked=Boolean(checks[item.id]);
  if(viewFilter==='pendentes'&&checked)return false;
  if(viewFilter==='checadas'&&!checked)return false;
  if(viewFilter==='agendadas'&&(checked||!sessionByItem[item.id]))return false;
  if(viewFilter==='semEstoque'&&(checked||links[item.id]))return false;
  const q=searchTerm.trim().toLocaleLowerCase('pt-BR');
  return !q||[item.medicamento,item.dose,item.via,sessionByItem[item.id]?.protocolo_nome,sessionByItem[item.id]?.descricao].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(q));
 }).sort((a,b)=>{
  if(viewFilter==='checadas')return new Date(checks[b.id]?.checado_em||0)-new Date(checks[a.id]?.checado_em||0);
  const da=sessionByItem[a.id]?.data_prevista||'9999-12-31',db=sessionByItem[b.id]?.data_prevista||'9999-12-31';
  return da.localeCompare(db)||String(a.medicamento).localeCompare(String(b.medicamento),'pt-BR');
 });
 const fileInput=item=><label className="administration-photo">Foto do comprovante (opcional)
  <input type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(busy)}
   onChange={e=>setPhotos(o=>({...o,[item.id]:e.target.files?.[0]||null}))}/>
  <small>JPG, PNG ou WebP até 6 MB. Não enviar dados reais.</small>
  {photos[item.id]&&<small>Selecionado: {photos[item.id].name}</small>}
 </label>;
 return <section className="premium-panel test-administrations">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">✓</span><div><h3>Checagem de administração (teste)</h3><p>Registro fictício com comprovante fotográfico opcional e identificação da profissional.</p></div></div>
  <p className="profile-notice">Somente simulação. Não confirma que um medicamento foi efetivamente administrado; movimenta somente o estoque FICTÍCIO, se houver vínculo válido e saldo disponível. A foto é opcional: pode ser enviada durante a checagem ou posteriormente, sem gerar outra baixa. Não envie fotos ou dados reais de pacientes neste ambiente de testes. Cada item aceita apenas uma checagem nesta versão.</p>
  {error&&<p role="alert" className="form-message">{error}</p>}{message&&<p role="status" className="form-message">{message}</p>}
  <div className="record-top"><h4>Painel de aplicações e checagens</h4><button type="button" className="outline-gold" disabled={loading||Boolean(busy)} onClick={load}>Atualizar</button></div>
  {!loading&&<div className="nursing-summary" aria-label="Resumo das checagens de teste">
    <div><small>Pendentes</small><strong>{allPending.length}</strong></div>
    <div><small>Com sessão vinculada</small><strong>{assignedPending.length}</strong></div>
    <div><small>Data prevista já passou</small><strong>{overdue.length}</strong></div>
    <div><small>Sem vínculo ao estoque</small><strong>{missingStock.length}</strong></div>
    <div><small>Checagens registradas</small><strong>{allChecked.length}</strong></div>
   </div>}
  {!loading&&entries.length>0&&<div className="nursing-toolbar">
   <label>Visualizar
    <select value={viewFilter} onChange={e=>setViewFilter(e.target.value)}>
     <option value="pendentes">Pendentes ({allPending.length})</option>
     <option value="agendadas">Pendentes com sessão ({assignedPending.length})</option>
     <option value="semEstoque">Sem vínculo ao estoque ({missingStock.length})</option>
     <option value="checadas">Checadas ({allChecked.length})</option>
     <option value="todas">Todas ({entries.length})</option>
    </select>
   </label>
   <label>Buscar medicamento ou protocolo
    <input type="search" maxLength={100} placeholder="Digite para filtrar" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
   </label>
  </div>}
  {!loading&&overdue.length>0&&<p className="form-message" role="status">Há {overdue.length} sessão(ões) com data prevista anterior a hoje e sem checagem associada. Confira o agendamento; isso não comprova falta ou realização do procedimento.</p>}
  {loading?<p>Carregando...</p>:entries.length===0?<p className="record-empty">Nenhum item de prescrição encontrado.</p>:visibleItems.length===0?<p className="record-empty">Nenhum item corresponde aos filtros escolhidos.</p>:<div className="record-list">{visibleItems.map(item=><div key={item.id} className="form-section administration-item">
   <div className="administration-heading"><strong>{item.medicamento}</strong><span>{checks[item.id]?'Checagem registrada':'Pendente no teste'}</span></div>
   {sessionByItem[item.id]&&!checks[item.id]&&sessionByItem[item.id].data_prevista<todayDate&&<p className="form-message">Data planejada anterior a hoje — conferir situação do agendamento.</p>}
   {sessionByItem[item.id]&&<div className="administration-session-schedule">
    <p className="administration-stock"><strong>Sessão vinculada:</strong> {sessionByItem[item.id].protocolo_nome} · {sessionByItem[item.id].descricao} · <strong>Data prevista:</strong> {dateBR(sessionByItem[item.id].data_prevista)}</p>
    {checks[item.id]&&<p><strong>Data da checagem registrada:</strong> {stamp(checks[item.id].checado_em)} (não é alterada pelo reagendamento).</p>}
    {canCheck&&!checks[item.id]&&<div className="administration-reschedule">
     <label>Nova data prevista
      <input type="date" value={dateDrafts[item.id]||sessionByItem[item.id].data_prevista} disabled={Boolean(busy)}
       onChange={e=>setDateDrafts(old=>({...old,[item.id]:e.target.value}))}/>
     </label>
     <label>Motivo do reagendamento
      <input type="text" value={dateReasons[item.id]||''} maxLength={500} disabled={Boolean(busy)}
       placeholder="Ex.: paciente solicitou alteração" onChange={e=>setDateReasons(old=>({...old,[item.id]:e.target.value}))}/>
     </label>
     <button type="button" className="outline-gold" disabled={Boolean(busy)||!(dateReasons[item.id]||'').trim()||(dateDrafts[item.id]||sessionByItem[item.id].data_prevista)===sessionByItem[item.id].data_prevista}
      onClick={()=>reschedule({...item})}>{busy===item.id?'Salvando...':'Alterar data prevista'}</button>
    </div>}
    {dateHistoryFor(sessionByItem[item.id].sessao_id).length>0&&<details className="administration-date-history">
     <summary>Histórico de reagendamentos ({dateHistoryFor(sessionByItem[item.id].sessao_id).length})</summary>
     {dateHistoryFor(sessionByItem[item.id].sessao_id).map((h,i)=><p key={h.alterado_em+'-'+i}>
      {dateBR(h.data_anterior)} → {dateBR(h.data_nova)} · {h.motivo} · {h.profissional_nome} · {stamp(h.alterado_em)}
     </p>)}
    </details>}
   </div>}
   <p>Dose: {item.dose} · Via: {item.via} · Frequência: {item.frequencia}</p>{item.duracao&&<p>Duração: {item.duracao}</p>}{links[item.id]&&<p className="administration-stock">Baixa configurada: {links[item.id].quantidade} {products.find(p=>p.id===links[item.id].produto_id)?.unidade||'un.'} de {products.find(p=>p.id===links[item.id].produto_id)?.nome||'produto de teste'}</p>}{item.orientacoes&&<p>Orientações: {item.orientacoes}</p>}
   {checks[item.id]?<div className="administration-checked">
    <p>Checado em {stamp(checks[item.id].checado_em)} · Responsável: {names[checks[item.id].profissional_id]||'Profissional não identificado'}{checks[item.id].observacao?' · '+checks[item.id].observacao:''}</p>
    {suppliesUI(item)}
    {checks[item.id].foto_caminho?
      <div><button type="button" className="outline-gold" onClick={()=>viewPhoto(item)}>Preparar acesso à foto</button>
      {photoLinks[item.id]&&<a className="photo-signed-link" href={photoLinks[item.id]} target="_blank" rel="noopener noreferrer">Abrir foto (link temporário)</a>}</div>
    : <div className="administration-actions">
       <p>Comprovante fotográfico pendente (opcional).</p>
       {canCheck&&checks[item.id].profissional_id===currentUserId&&<>{fileInput(item)}<button className="outline-gold" type="button" disabled={Boolean(busy)||!photos[item.id]} onClick={()=>attachLater(item)}>{busy===item.id?'Anexando...':'Anexar foto agora'}</button></>}
      </div>}
   </div>:canCheck?<div className="administration-actions">
    {!links[item.id]&&<div className="nursing-medication-link">
     <strong>Associar medicamento ao estoque antes da checagem</strong>
     <p>Confirme nome, concentracao/apresentacao, via e quantidade conforme a prescricao. A associacao nao realiza baixa. Caso haja divergencia, solicite revisao do medico.</p>
     <div className="nursing-medication-fields">
      <label>Medicamento existente no estoque
       <select value={medicationPick[item.id]||''} disabled={Boolean(busy)}
        onChange={e=>setMedicationPick(old=>({...old,[item.id]:e.target.value}))}>
        <option value="">Selecione o produto prescrito</option>
        {medicationProducts.map(p=><option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>)}
       </select>
      </label>
      <label>Quantidade a descontar nesta checagem
       <input type="number" min="0.001" max="100000" step="0.001" value={medicationQty[item.id]||'1'}
        disabled={Boolean(busy)} onChange={e=>setMedicationQty(old=>({...old,[item.id]:e.target.value}))}/>
      </label>
      <button type="button" className="outline-gold" disabled={Boolean(busy)||!medicationPick[item.id]}
       onClick={()=>bindMedication(item)}>{busy===item.id?'Vinculando...':'Vincular medicamento'}</button>
     </div>
     {!medicationProducts.length&&<p className="form-message">Nao ha medicamentos ativos cadastrados no estoque. Solicite o cadastro antes de checar.</p>}
    </div>}
    <label>Observação de teste (opcional)<textarea value={notes[item.id]||''} maxLength={2000} rows={2} onChange={e=>setNotes(o=>({...o,[item.id]:e.target.value}))}/></label>
    {suppliesUI(item)}
    {fileInput(item)}
    <button type="button" className="gold-button" disabled={Boolean(busy)||!links[item.id]} onClick={()=>check(item)}>
     {busy===item.id?'Registrando...':links[item.id]?'Confirmar checagem e baixar estoque':'Vincule ao estoque primeiro'}
    </button>
   </div>:<p className="record-empty">Somente o perfil enfermeira pode registrar esta checagem.</p>}
  </div>)}</div>}
 </section>;
}