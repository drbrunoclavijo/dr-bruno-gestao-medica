import React,{useEffect,useState} from 'react';
const categories=[
 ['exame','Exames laboratoriais e complementares'],
 ['bioimpedancia','Bioimpedância'],
 ['foto_evolucao','Fotos de evolução'],
 ['outro','Outros documentos']
];
const angles=[["frente","Frente"],["costas","Costas"],["perfil_direito","Perfil direito"],["perfil_esquerdo","Perfil esquerdo"],["outro","Outro ângulo"]];
const angleName=id=>angles.find(([a])=>a===id)?.[1]||'Sem classificação';
const dateBR=value=>value?value.slice(0,10).split('-').reverse().join('/'):'Sem data informada';
const stamp=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value));
export default function TestPatientDocuments({supabase,patientId}){
 const [docs,setDocs]=useState([]),[consultations,setConsultations]=useState([]),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [category,setCategory]=useState('exame'),[uploadAngle,setUploadAngle]=useState(''),[title,setTitle]=useState(''),[description,setDescription]=useState('');
 const [docDate,setDocDate]=useState(''),[consultation,setConsultation]=useState(''),[file,setFile]=useState(null),[openLinks,setOpenLinks]=useState({});
 const [beforeId,setBeforeId]=useState(''),[afterId,setAfterId]=useState('');
 const [comparison,setComparison]=useState(null),[comparisonBusy,setComparisonBusy]=useState(false);
 const [angleFilter,setAngleFilter]=useState(''),[angleEdits,setAngleEdits]=useState({}),[angleBusy,setAngleBusy]=useState('');
 async function load(){
  setLoading(true);setError('');
  setComparison(null);
  const [d,c]=await Promise.all([
   supabase.from('documentos_pacientes_teste')
     .select('id,categoria,titulo,descricao,data_documento,criado_em,nome_original,mime_type,tamanho_bytes,caminho,angulo_foto')
     .eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100),
   supabase.from('consultas_teste').select('id,data_consulta,motivo')
     .eq('paciente_id',patientId).order('data_consulta',{ascending:false}).limit(100)
  ]);
  if(d.error||c.error)setError('Não foi possível consultar a biblioteca: '+(d.error||c.error).message);
  else{setDocs(d.data||[]);setConsultations(c.data||[]);setAngleEdits(Object.fromEntries((d.data||[]).map(x=>[x.id,x.angulo_foto||''])));}
  setLoading(false);
 }
 useEffect(()=>{load()},[patientId]);
 async function add(e){
  e.preventDefault();setError('');setSuccess('');
  const allowed=['application/pdf','image/jpeg','image/png','image/webp'];
  if(!file||!allowed.includes(file.type)||file.size<1||file.size>10*1024*1024){
   setError('Selecione PDF, JPG, PNG ou WebP fictício de até 10 MB.');return;
  }
  if(category==='foto_evolucao'&&file.type==='application/pdf'){
   setError('Para fotos de evolução, selecione JPG, PNG ou WebP.');return;
  }
  if(category==='foto_evolucao'&&!angles.some(([id])=>id===uploadAngle)){
   setError('Selecione o ângulo corporal da foto antes de salvar.');return;
  }
  setBusy(true);
  try{
   const {data,error:authErr}=await supabase.auth.getUser();
   if(authErr||!data?.user)throw new Error('Sessão expirada.');
   const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
   const path=data.user.id+'/'+patientId+'/'+crypto.randomUUID()+'.'+ext;
   const up=await supabase.storage.from('documentos-pacientes-teste')
    .upload(path,file,{contentType:file.type,upsert:false});
   if(up.error)throw new Error('Falha ao enviar arquivo: '+up.error.message);
   const payload={
    p_paciente_id:patientId,p_consulta_id:consultation||null,
    p_titulo:title.trim(),p_descricao:description.trim()||null,
    p_data_documento:docDate||null,p_nome_original:file.name.slice(0,240),
    p_mime_type:file.type,p_tamanho_bytes:file.size,p_caminho:path
   };
   const isEvolution=category==='foto_evolucao';
   const {error:saveErr}=await supabase.rpc(
    isEvolution?'registrar_foto_evolucao_com_angulo_teste':'registrar_documento_paciente_teste',
    isEvolution?{...payload,p_angulo_foto:uploadAngle}:{...payload,p_categoria:category}
   );
   if(saveErr)throw new Error('Arquivo enviado, mas NÃO associado à ficha: '+saveErr.message+'. Informe ao administrador para revisar o arquivo pendente.');
   setSuccess('Documento de teste anexado à ficha do paciente.');
   setTitle('');setDescription('');setDocDate('');setConsultation('');setFile(null);setUploadAngle('');
   await load();setSuccess('Documento de teste anexado à ficha do paciente.');
  }catch(err){setError(err.message);}
  finally{setBusy(false);}
 }
 async function view(doc){
  setError('');
  const {data,error}=await supabase.storage.from('documentos-pacientes-teste')
   .createSignedUrl(doc.caminho,60);
  if(error||!data?.signedUrl){setError('Não foi possível abrir o documento: '+(error?.message||'acesso indisponível'));return;}
  setOpenLinks(old=>({...old,[doc.id]:data.signedUrl}));
 }
 async function saveAngle(doc){
  setError('');setSuccess('');setAngleBusy(doc.id);
  const value=angleEdits[doc.id]||null;
  const {error}=await supabase.rpc('classificar_foto_evolucao_teste',{
   p_documento_id:doc.id,p_paciente_id:patientId,p_angulo_foto:value
  });
  if(error)setError('Não foi possível classificar a imagem: '+error.message);
  else{
   setDocs(old=>old.map(d=>d.id===doc.id?{...d,angulo_foto:value}:d));
   setBeforeId('');setAfterId('');setComparison(null);
   setSuccess('Ângulo da foto atualizado sem modificar a imagem original.');
  }
  setAngleBusy('');
 }
 const evolutionPhotos=docs.filter(d=>d.categoria==='foto_evolucao' && d.mime_type?.startsWith('image/'))
  .slice().sort((a,b)=>(a.data_documento||a.criado_em?.slice(0,10)||'').localeCompare(b.data_documento||b.criado_em?.slice(0,10)||''));
 const filteredPhotos=angleFilter?evolutionPhotos.filter(d=>d.angulo_foto===angleFilter):evolutionPhotos;
 const docById=id=>filteredPhotos.find(d=>d.id===id);
 async function comparePhotos(){
  const first=docById(beforeId),second=docById(afterId);
  if(!first||!second||first.id===second.id){setError('Selecione duas fotos de evolução diferentes.');return;}
  if(first.angulo_foto&&second.angulo_foto&&first.angulo_foto!==second.angulo_foto){setError('As fotos possuem ângulos diferentes. Selecione o mesmo ângulo para comparação.');return;}
  setError('');setComparison(null);setComparisonBusy(true);
  try{
   const bucket=supabase.storage.from('documentos-pacientes-teste');
   const [a,b]=await Promise.all([bucket.createSignedUrl(first.caminho,300),bucket.createSignedUrl(second.caminho,300)]);
   if(a.error||b.error||!a.data?.signedUrl||!b.data?.signedUrl){
    throw new Error((a.error||b.error)?.message||'Acesso indisponível');
   }
   setComparison({first:{...first,url:a.data.signedUrl},second:{...second,url:b.data.signedUrl}});
  }catch(err){setError('Não foi possível carregar a comparação: '+err.message);}
  finally{setComparisonBusy(false);}
 }
 return <section className="premium-panel patient-documents">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">▤</span>
   <div><h3>Documentos e imagens do paciente — Teste</h3>
    <p>Exames, bioimpedância, fotos de evolução e documentos complementares.</p></div>
  </div>
  <p className="profile-notice">Área reservada ao perfil médico no protótipo. Utilize exclusivamente PDFs e imagens fictícios, sem qualquer dado pessoal ou imagem real de paciente. Os anexos permanecem privados, não são removidos pela interface nesta versão e podem ser consultados por links temporários.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}
  {success&&<p className="form-message" role="status">{success}</p>}
  <form className="form-section document-upload-form" onSubmit={add}>
   <h4>+ Adicionar documento fictício</h4>
   <div className="clinical-fields">
    <label>Categoria<select value={category} onChange={e=>{setCategory(e.target.value);setUploadAngle('');}}>{categories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    {category==='foto_evolucao'&&<label>Ângulo corporal da foto (obrigatório)
     <select required value={uploadAngle} onChange={e=>setUploadAngle(e.target.value)}>
      <option value="">Selecione o ângulo</option>
      {angles.map(([id,name])=><option key={id} value={id}>{name}</option>)}
     </select>
    </label>}
    <label>Título<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: avaliação inicial - teste"/></label>
    <label>Data do exame / foto (opcional)<input type="date" value={docDate} onChange={e=>setDocDate(e.target.value)}/></label>
    <label>Consulta vinculada (opcional)<select value={consultation} onChange={e=>setConsultation(e.target.value)}><option value="">Sem consulta vinculada</option>{consultations.map(c=><option key={c.id} value={c.id}>{dateBR(c.data_consulta)} · {c.motivo}</option>)}</select></label>
    <label className="full-span">Descrição (opcional)<textarea maxLength={1000} rows={2} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <label className="full-span">Arquivo PDF ou imagem fictícia (até 10 MB)
     <input type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} />
     {file&&<small>Selecionado: {file.name}</small>}
    </label>
   </div>
   <div className="form-actions"><button type="submit" className="gold-button" disabled={busy||!file||!title.trim()||(category==='foto_evolucao'&&!uploadAngle)}>{busy?'Enviando...':'Salvar anexo de teste'}</button></div>
  </form>
  <section className="form-section evolution-comparison" aria-label="Comparação de fotos de evolução">
   <h4>Comparar fotos de evolução (teste)</h4>
   <p>Selecione duas fotos já anexadas à categoria “Fotos de evolução”. As imagens serão exibidas lado a lado, sem edição ou alteração dos originais.</p>
   {evolutionPhotos.length<2?<p className="record-empty">Anexe pelo menos duas fotos fictícias de evolução para comparar.</p>:<>
    <label className="angle-filter-label">Filtrar por ângulo
     <select value={angleFilter} onChange={e=>{setAngleFilter(e.target.value);setBeforeId('');setAfterId('');setComparison(null);}}><option value="">Todos os ângulos</option>{angles.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select>
    </label>
    {filteredPhotos.length<2&&<p className="record-empty">Este ângulo ainda não possui duas fotos. Cadastre ou classifique outras imagens.</p>}
    <div className="clinical-fields">
     <label>Foto anterior
      <select value={beforeId} onChange={e=>{setBeforeId(e.target.value);setComparison(null);}}>
       <option value="">Selecionar foto anterior</option>
       {filteredPhotos.map(d=><option key={d.id} value={d.id}>{dateBR(d.data_documento||d.criado_em)} · {d.titulo} · {angleName(d.angulo_foto)}</option>)}
      </select>
     </label>
     <label>Foto posterior
      <select value={afterId} onChange={e=>{setAfterId(e.target.value);setComparison(null);}}>
       <option value="">Selecionar foto posterior</option>
       {filteredPhotos.map(d=><option key={d.id} value={d.id}>{dateBR(d.data_documento||d.criado_em)} · {d.titulo} · {angleName(d.angulo_foto)}</option>)}
      </select>
     </label>
    </div>
    <div className="form-actions"><button type="button" className="gold-button" onClick={comparePhotos} disabled={comparisonBusy||!beforeId||!afterId||beforeId===afterId}>{comparisonBusy?'Carregando imagens...':'Comparar fotos'}</button></div>
    {comparison&&<div className="evolution-photo-grid">
      {[['Anterior',comparison.first],['Posterior',comparison.second]].map(([label,d])=><figure key={label}>
       <div className="evolution-photo-header"><strong>{label}</strong><span>{dateBR(d.data_documento||d.criado_em)}</span></div>
       <img src={d.url} alt={label+': '+d.titulo} loading="lazy" referrerPolicy="no-referrer"/>
       <figcaption>{d.titulo}</figcaption>
      </figure>)}
      <p className="evolution-comparison-note">Links temporários (5 minutos). Para visualizar novamente após expirar, clique em “Comparar fotos”. Poses, iluminação, distância e enquadramento diferentes dificultam a comparação.</p>
    </div>}
   </>}
  </section>
  <div className="record-top"><h4>Arquivos cadastrados</h4><button type="button" className="outline-gold" onClick={load} disabled={busy||loading}>Atualizar</button></div>
  {loading?<p>Carregando documentos...</p>:docs.length===0?<p className="record-empty">Nenhum documento fictício anexado a este paciente.</p>:
  <div className="record-list">{docs.map(doc=><div className="form-section document-entry" key={doc.id}>
   <div className="administration-heading"><strong>{doc.titulo}</strong><span>{categories.find(([id])=>id===doc.categoria)?.[1]||doc.categoria}</span></div>
   <p>Data do documento: {dateBR(doc.data_documento)} · Enviado em {stamp(doc.criado_em)}</p>
   <p>Arquivo: {doc.nome_original} · {(doc.tamanho_bytes/1024/1024).toFixed(2).replace('.',',')} MB</p>
   {doc.descricao&&<p>{doc.descricao}</p>}
   {doc.categoria==='foto_evolucao'&&<div className="photo-angle-editor"><label>Ângulo corporal
     <select value={angleEdits[doc.id]||''} disabled={angleBusy===doc.id} onChange={e=>setAngleEdits(old=>({...old,[doc.id]:e.target.value}))}>
       <option value="">Não classificada</option>{angles.map(([id,name])=><option key={id} value={id}>{name}</option>)}
     </select></label>
     <button type="button" className="outline-gold" disabled={Boolean(angleBusy)||(angleEdits[doc.id]||'')===(doc.angulo_foto||'')} onClick={()=>saveAngle(doc)}>{angleBusy===doc.id?'Salvando...':'Salvar ângulo'}</button>
   </div>}
   <div className="document-entry-actions"><button type="button" className="outline-gold" onClick={()=>view(doc)}>Preparar acesso</button>
    {openLinks[doc.id]&&<a className="photo-signed-link" href={openLinks[doc.id]} target="_blank" rel="noopener noreferrer">Abrir documento (60 s)</a>}
   </div>
  </div>)}</div>}
 </section>;
}