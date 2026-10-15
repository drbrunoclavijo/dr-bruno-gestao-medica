import React,{useEffect,useState} from 'react';
const stamp=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'Data indisponível':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d)};
export default function TestAdministrations({supabase,patientId,role}){
 const [currentUserId,setCurrentUserId]=useState(null),[photos,setPhotos]=useState({}),[photoLinks,setPhotoLinks]=useState({}),[names,setNames]=useState({}),[entries,setEntries]=useState([]),[checks,setChecks]=useState({}),[links,setLinks]=useState({}),[products,setProducts]=useState([]),[busy,setBusy]=useState(''),[notes,setNotes]=useState({}),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true);
 const canCheck=role==='enfermeira';
 async function load(){
  setLoading(true);setError('');
  const {data:authData}=await supabase.auth.getUser();
  setCurrentUserId(authData?.user?.id||null);
  const rx=await supabase.from('prescricoes_teste').select('id,criado_em').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100);
  if(rx.error){setError('Não foi possível consultar prescrições: '+rx.error.message);setLoading(false);return;}
  const ids=(rx.data||[]).map(x=>x.id);
  if(!ids.length){setEntries([]);setChecks({});setNames({});setLoading(false);return;}
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
   supabase.from('estoque_produtos_teste').select('id,nome,unidade')
  ]);
  if(vl.error||pr.error){setError('Não foi possível consultar vínculos ao estoque: '+(vl.error||pr.error).message);setLoading(false);return;}
  setLinks(Object.fromEntries((vl.data||[]).map(v=>[v.item_prescricao_id,v])));
  setProducts(pr.data||[]);
  setEntries(items.map(i=>({...i,prescribedAt:(rx.data||[]).find(p=>p.id===i.prescricao_id)?.criado_em})));
  setLoading(false);
 }
 useEffect(()=>{load()},[patientId,role]);
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
  <div className="record-top"><h4>Itens das prescrições de teste</h4><button type="button" className="outline-gold" disabled={loading} onClick={load}>Atualizar</button></div>
  {loading?<p>Carregando...</p>:entries.length===0?<p className="record-empty">Nenhum item de prescrição encontrado.</p>:<div className="record-list">{entries.map(item=><div key={item.id} className="form-section administration-item">
   <div className="administration-heading"><strong>{item.medicamento}</strong><span>{checks[item.id]?'Checagem registrada':'Pendente no teste'}</span></div>
   <p>Dose: {item.dose} · Via: {item.via} · Frequência: {item.frequencia}</p>{item.duracao&&<p>Duração: {item.duracao}</p>}{links[item.id]&&<p className="administration-stock">Baixa configurada: {links[item.id].quantidade} {products.find(p=>p.id===links[item.id].produto_id)?.unidade||'un.'} de {products.find(p=>p.id===links[item.id].produto_id)?.nome||'produto de teste'}</p>}{item.orientacoes&&<p>Orientações: {item.orientacoes}</p>}
   {checks[item.id]?<div className="administration-checked">
    <p>Checado em {stamp(checks[item.id].checado_em)} · Responsável: {names[checks[item.id].profissional_id]||'Profissional não identificado'}{checks[item.id].observacao?' · '+checks[item.id].observacao:''}</p>
    {checks[item.id].foto_caminho?
      <div><button type="button" className="outline-gold" onClick={()=>viewPhoto(item)}>Preparar acesso à foto</button>
      {photoLinks[item.id]&&<a className="photo-signed-link" href={photoLinks[item.id]} target="_blank" rel="noopener noreferrer">Abrir foto (link temporário)</a>}</div>
    : <div className="administration-actions">
       <p>Comprovante fotográfico pendente (opcional).</p>
       {canCheck&&checks[item.id].profissional_id===currentUserId&&<>{fileInput(item)}<button className="outline-gold" type="button" disabled={Boolean(busy)||!photos[item.id]} onClick={()=>attachLater(item)}>{busy===item.id?'Anexando...':'Anexar foto agora'}</button></>}
      </div>}
   </div>:canCheck?<div className="administration-actions">
    <label>Observação de teste (opcional)<textarea value={notes[item.id]||''} maxLength={2000} rows={2} onChange={e=>setNotes(o=>({...o,[item.id]:e.target.value}))}/></label>
    {fileInput(item)}
    <button type="button" className="gold-button" disabled={Boolean(busy)||!links[item.id]} onClick={()=>check(item)}>
     {busy===item.id?'Registrando...':links[item.id]?'Confirmar checagem e baixar estoque':'Vincule ao estoque primeiro'}
    </button>
   </div>:<p className="record-empty">Somente o perfil enfermeira pode registrar esta checagem.</p>}
  </div>)}</div>}
 </section>;
}