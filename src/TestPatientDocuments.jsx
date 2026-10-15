import React,{useEffect,useState} from 'react';
const categories=[
 ['exame','Exames laboratoriais e complementares'],
 ['bioimpedancia','Bioimpedância'],
 ['foto_evolucao','Fotos de evolução'],
 ['outro','Outros documentos']
];
const dateBR=value=>value?value.slice(0,10).split('-').reverse().join('/'):'Sem data informada';
const stamp=value=>new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(value));
export default function TestPatientDocuments({supabase,patientId}){
 const [docs,setDocs]=useState([]),[consultations,setConsultations]=useState([]),[loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [category,setCategory]=useState('exame'),[title,setTitle]=useState(''),[description,setDescription]=useState('');
 const [docDate,setDocDate]=useState(''),[consultation,setConsultation]=useState(''),[file,setFile]=useState(null),[openLinks,setOpenLinks]=useState({});
 async function load(){
  setLoading(true);setError('');
  const [d,c]=await Promise.all([
   supabase.from('documentos_pacientes_teste')
     .select('id,categoria,titulo,descricao,data_documento,criado_em,nome_original,mime_type,tamanho_bytes,caminho')
     .eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100),
   supabase.from('consultas_teste').select('id,data_consulta,motivo')
     .eq('paciente_id',patientId).order('data_consulta',{ascending:false}).limit(100)
  ]);
  if(d.error||c.error)setError('Não foi possível consultar a biblioteca: '+(d.error||c.error).message);
  else{setDocs(d.data||[]);setConsultations(c.data||[]);}
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
  setBusy(true);
  try{
   const {data,error:authErr}=await supabase.auth.getUser();
   if(authErr||!data?.user)throw new Error('Sessão expirada.');
   const ext={'application/pdf':'pdf','image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
   const path=data.user.id+'/'+patientId+'/'+crypto.randomUUID()+'.'+ext;
   const up=await supabase.storage.from('documentos-pacientes-teste')
    .upload(path,file,{contentType:file.type,upsert:false});
   if(up.error)throw new Error('Falha ao enviar arquivo: '+up.error.message);
   const {error:saveErr}=await supabase.rpc('registrar_documento_paciente_teste',{
    p_paciente_id:patientId,p_consulta_id:consultation||null,p_categoria:category,
    p_titulo:title.trim(),p_descricao:description.trim()||null,
    p_data_documento:docDate||null,p_nome_original:file.name.slice(0,240),
    p_mime_type:file.type,p_tamanho_bytes:file.size,p_caminho:path
   });
   if(saveErr)throw new Error('Arquivo enviado, mas NÃO associado à ficha: '+saveErr.message+'. Informe ao administrador para revisar o arquivo pendente.');
   setSuccess('Documento de teste anexado à ficha do paciente.');
   setTitle('');setDescription('');setDocDate('');setConsultation('');setFile(null);
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
    <label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
    <label>Título<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: avaliação inicial - teste"/></label>
    <label>Data do exame / foto (opcional)<input type="date" value={docDate} onChange={e=>setDocDate(e.target.value)}/></label>
    <label>Consulta vinculada (opcional)<select value={consultation} onChange={e=>setConsultation(e.target.value)}><option value="">Sem consulta vinculada</option>{consultations.map(c=><option key={c.id} value={c.id}>{dateBR(c.data_consulta)} · {c.motivo}</option>)}</select></label>
    <label className="full-span">Descrição (opcional)<textarea maxLength={1000} rows={2} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    <label className="full-span">Arquivo PDF ou imagem fictícia (até 10 MB)
     <input type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)} />
     {file&&<small>Selecionado: {file.name}</small>}
    </label>
   </div>
   <div className="form-actions"><button type="submit" className="gold-button" disabled={busy||!file||!title.trim()}>{busy?'Enviando...':'Salvar anexo de teste'}</button></div>
  </form>
  <div className="record-top"><h4>Arquivos cadastrados</h4><button type="button" className="outline-gold" onClick={load} disabled={busy||loading}>Atualizar</button></div>
  {loading?<p>Carregando documentos...</p>:docs.length===0?<p className="record-empty">Nenhum documento fictício anexado a este paciente.</p>:
  <div className="record-list">{docs.map(doc=><div className="form-section document-entry" key={doc.id}>
   <div className="administration-heading"><strong>{doc.titulo}</strong><span>{categories.find(([id])=>id===doc.categoria)?.[1]||doc.categoria}</span></div>
   <p>Data do documento: {dateBR(doc.data_documento)} · Enviado em {stamp(doc.criado_em)}</p>
   <p>Arquivo: {doc.nome_original} · {(doc.tamanho_bytes/1024/1024).toFixed(2).replace('.',',')} MB</p>
   {doc.descricao&&<p>{doc.descricao}</p>}
   <div className="document-entry-actions"><button type="button" className="outline-gold" onClick={()=>view(doc)}>Preparar acesso</button>
    {openLinks[doc.id]&&<a className="photo-signed-link" href={openLinks[doc.id]} target="_blank" rel="noopener noreferrer">Abrir documento (60 s)</a>}
   </div>
  </div>)}</div>}
 </section>;
}