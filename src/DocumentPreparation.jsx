import React,{useState} from 'react';
import {generateUnsignedPdf} from './UnsignedPdf.js';

const datePt=value=>{
 if(!value)return '—';
 const match=String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
 return match?match[3]+'/'+match[2]+'/'+match[1]:'—';
};
const stampPt=value=>{
 if(!value)return '—';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(date);
};
const clinicalFields=[
 ['queixa_principal','Queixa principal'],['historia_atual','História atual'],
 ['antecedentes','Antecedentes'],['medicamentos','Medicamentos em uso'],
 ['alergias','Alergias'],['habitos','Hábitos'],['exame_fisico','Exame físico'],
 ['diagnostico','Hipóteses diagnósticas'],['conduta','Conduta'],
 ['evolucao','Evolução'],['retorno','Retorno']
];
function documentLines({kind,document}){
 if(kind==='evolucao'){
  return clinicalFields.filter(([key])=>String(document?.[key]??'').trim())
   .map(([key,label])=>({title:label,content:String(document[key])}));
 }
 return (document?.items||[]).map((item,index)=>({
  title:(index+1)+'. '+String(item.medicamento||'Medicamento sem nome'),
  content:[
   'Dose/apresentação: '+String(item.dose||item.quantidade||'—'),
   ...(kind==='domiciliar'?['Posologia: '+String(item.posologia||'—')]:['Via: '+String(item.via||'—'),'Frequência: '+String(item.frequencia||'—')]),
   item.duracao?'Duração: '+item.duracao:null,
   item.orientacoes?'Orientações: '+item.orientacoes:null
  ].filter(Boolean).join('\n')
 }));
}
export default function DocumentPreparation({kind,document,patientName,patientId,supabase,professionalName='Dr. Bruno Clavijo'}){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState(''),[savingPdf,setSavingPdf]=useState(false),[savedPdf,setSavedPdf]=useState(false);
 const isEvolution=kind==='evolucao';
 const title=isEvolution?'Evolução médica':kind==='domiciliar'?'Receita domiciliar':'Prescrição médica de aplicação';
 const lines=documentLines({kind,document});
 const date=isEvolution?datePt(document.data_consulta):stampPt(document.criado_em);
 const notes=!isEvolution?String(document.observacoes||'').trim():'';
 const content=[title,'PACIENTE FICTÍCIO: '+patientName,'Profissional: '+professionalName,'Data: '+date,...lines.flatMap(l=>[l.title,l.content]),notes?'Observações: '+notes:'','RASCUNHO DE TESTE — NÃO ASSINADO DIGITALMENTE — NÃO VÁLIDO COMO RECEITA'].filter(Boolean).join('\n\n');
 function preparePdf(){
  return generateUnsignedPdf({
   title,patientName,professionalName,date,
   sections:[...(isEvolution&&document.motivo?[{title:'Motivo',content:document.motivo}]:[]),...lines,
    ...(notes?[{title:'Observações gerais',content:notes}]:[])]
  });
 }
 function exportPdf(){
  const blob=preparePdf();
  const href=URL.createObjectURL(blob);
  const link=window.document.createElement('a');
  link.href=href;link.download=(kind==='domiciliar'?'receita-domiciliar':kind==='evolucao'?'evolucao':'prescricao')+'-RASCUNHO-'+String(document.id||'teste').slice(0,8)+'.pdf';
  window.document.body.appendChild(link);link.click();link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(href),60000);
  setNotice('PDF de TESTE NÃO ASSINADO preparado para salvar no dispositivo. Não é receita válida.');
 }
 async function archivePdf(){
  if(!supabase||!patientId||!document.id)return setNotice('Documento não pode ser arquivado sem registro salvo e sessão autenticada.');
  setSavingPdf(true);setNotice('');
  try{
   const {data:{user},error:authError}=await supabase.auth.getUser();
   if(authError||!user)throw new Error('Sessão médica expirada');
   const blob=preparePdf();
   if(blob.size>10*1024*1024)throw new Error('PDF maior que o limite do arquivo clínico');
   const path=user.id+'/'+patientId+'/'+crypto.randomUUID()+'.pdf';
   const bucket=supabase.storage.from('documentos-pacientes-teste');
   const uploaded=await bucket.upload(path,blob,{contentType:'application/pdf',upsert:false});
   if(uploaded.error)throw new Error(uploaded.error.message);
   const name=(kind==='domiciliar'?'Receita domiciliar':isEvolution?'Evolução médica':'Prescrição médica')+' — RASCUNHO NÃO ASSINADO';
   const recorded=await supabase.rpc('registrar_documento_paciente_teste',{
    p_paciente_id:patientId,p_consulta_id:isEvolution?document.id:document.consulta_id||null,
    p_categoria:'outro',p_titulo:name,p_descricao:'Cópia fictícia NÃO ASSINADA do registro '+document.id+'. NÃO VÁLIDA PARA DISPENSAÇÃO.',
    p_data_documento:isEvolution?document.data_consulta:null,
    p_nome_original:'rascunho-'+String(document.id).slice(0,8)+'.pdf',
    p_mime_type:'application/pdf',p_tamanho_bytes:blob.size,p_caminho:path
   });
   if(recorded.error)throw new Error('PDF enviado, mas não vinculado à ficha: '+recorded.error.message+'. Solicite verificação de arquivo pendente.');
   setSavedPdf(true);
   setNotice('Cópia PDF NÃO ASSINADA arquivada com acesso privado em Documentos → Outros documentos. Não é receita válida.');
  }catch(err){setNotice('Não foi possível arquivar o PDF: '+err.message);}
  finally{setSavingPdf(false);}
 }
 async function copy(){
  try{await navigator.clipboard.writeText(content);setNotice('Rascunho de teste copiado. Não representa documento assinado.');}
  catch{setNotice('O navegador bloqueou a cópia. Use a prévia para selecionar o texto.');}
 }
 return <div className="document-preparation">
  <div className="document-preparation-actions">
   <button type="button" className="outline-gold" onClick={()=>setOpen(v=>!v)}>{open?'Ocultar prévia':'Preparar documento para assinatura'}</button>
  </div>
  {open&&<div className="document-draft-preview">
   <div className="document-draft-header"><span>Majestic Santé Institute</span><strong>RASCUNHO · TESTE · NÃO ASSINADO</strong></div>
   <h4>{title}</h4>
   <p><strong>Paciente fictício:</strong> {patientName}</p>
   <p><strong>Profissional:</strong> {professionalName}</p>
   <p><strong>Data:</strong> {date}</p>
   {isEvolution&&document.motivo&&<p><strong>Motivo da consulta:</strong> {document.motivo}</p>}
   {lines.map((line,index)=><div className="document-draft-line" key={index}>
    <strong>{line.title}</strong><p>{line.content}</p>
   </div>)}
   {notes&&<div className="document-draft-line"><strong>Observações gerais</strong><p>{notes}</p></div>}
   <p className="document-draft-warning">RASCUNHO DE TESTE — NÃO ASSINADO DIGITALMENTE. NÃO UTILIZAR COMO DOCUMENTO MÉDICO VÁLIDO.</p>
   <div className="document-draft-actions">
    <button type="button" className="outline-gold" onClick={copy}>Copiar rascunho</button>
    <button type="button" className="outline-gold" onClick={exportPdf}>Baixar PDF não assinado</button>
    <button type="button" className="outline-gold" onClick={archivePdf} disabled={savingPdf||savedPdf||!supabase||!patientId}>{savingPdf?'Arquivando...':savedPdf?'PDF arquivado na ficha':'Salvar PDF no aplicativo'}</button>
    <button type="button" className="outline-gold" disabled title="Aguardando credenciais Bird ID, integração e validação ICP-Brasil">Assinar com Bird ID — em preparação</button>
    <button type="button" className="outline-gold" disabled title="Disponível somente para PDF assinado e com consentimento do paciente">Enviar pelo WhatsApp — indisponível</button>
   </div>
   {notice&&<p className="form-message" role="status">{notice}</p>}
   <small>A assinatura digital ICP-Brasil será feita no servidor após autorização do certificado Bird ID. Nenhuma chave privada, token ou documento é enviado pela prévia atual.</small>
  </div>}
 </div>;
}
