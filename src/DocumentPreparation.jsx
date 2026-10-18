import React,{useState} from 'react';

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
export default function DocumentPreparation({kind,document,patientName,professionalName='Dr. Bruno Clavijo'}){
 const [open,setOpen]=useState(false),[notice,setNotice]=useState('');
 const isEvolution=kind==='evolucao';
 const title=isEvolution?'Evolução médica':kind==='domiciliar'?'Receita domiciliar':'Prescrição médica de aplicação';
 const lines=documentLines({kind,document});
 const date=isEvolution?datePt(document.data_consulta):stampPt(document.criado_em);
 const notes=!isEvolution?String(document.observacoes||'').trim():'';
 const content=[title,'PACIENTE FICTÍCIO: '+patientName,'Profissional: '+professionalName,'Data: '+date,...lines.flatMap(l=>[l.title,l.content]),notes?'Observações: '+notes:'','RASCUNHO DE TESTE — NÃO ASSINADO DIGITALMENTE — NÃO VÁLIDO COMO RECEITA'].filter(Boolean).join('\n\n');
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
    <button type="button" className="outline-gold" disabled title="Aguardando credenciais Bird ID, integração e validação ICP-Brasil">Assinar com Bird ID — em preparação</button>
    <button type="button" className="outline-gold" disabled title="Disponível somente para PDF assinado e com consentimento do paciente">Enviar pelo WhatsApp — indisponível</button>
   </div>
   {notice&&<p className="form-message" role="status">{notice}</p>}
   <small>A assinatura digital ICP-Brasil será feita no servidor após autorização do certificado Bird ID. Nenhuma chave privada, token ou documento é enviado pela prévia atual.</small>
  </div>}
 </div>;
}
