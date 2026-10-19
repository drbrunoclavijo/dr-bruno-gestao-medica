import React,{useEffect,useState} from 'react';
import DocumentPreparation from './DocumentPreparation.jsx';
// O cliente Supabase autenticado é recebido do componente principal.
const actualDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const newForm=()=>({data_consulta:actualDate(),iniciada_em:new Date().toISOString(),motivo:'',queixa_principal:'',historia_atual:'',antecedentes:'',medicamentos:'',alergias:'',habitos:'',exame_fisico:'',peso_kg:'',altura_cm:'',pressao_arterial:'',frequencia_cardiaca:'',diagnostico:'',conduta:'',evolucao:'',retorno:''});
const groups=[
 ['Consulta',[['data_consulta','Data da consulta','date'],['motivo','Motivo da consulta','text'],['queixa_principal','Queixa principal','textarea'],['historia_atual','História da doença atual','textarea']]],
 ['Anamnese',[['antecedentes','Antecedentes','textarea'],['medicamentos','Medicamentos em uso','textarea'],['alergias','Alergias','textarea'],['habitos','Hábitos de vida','textarea']]],
 ['Avaliação médica',[['peso_kg','Peso (kg)','number'],['altura_cm','Altura (cm)','number'],['pressao_arterial','Pressão arterial','text'],['frequencia_cardiaca','Frequência cardíaca (bpm)','number'],['exame_fisico','Exame físico','textarea']]],
 ['Evolução e plano',[['diagnostico','Hipóteses diagnósticas','textarea'],['conduta','Conduta','textarea'],['evolucao','Evolução clínica','textarea'],['retorno','Orientações e retorno','textarea']]]
];
const templates={
 geral:{nome:'Consulta geral',descricao:'Avaliação clínica aberta para qualquer motivo de consulta.',guides:['Queixa e duração','Antecedentes e medicamentos','Exame e plano'],hints:{}},
 emagrecimento:{nome:'Emagrecimento',descricao:'Avaliação de peso, composição corporal, hábitos e acompanhamento.',guides:['Evolução do peso e tentativas anteriores','Sono, fome, atividade física e alimentação','Comorbidades, medicamentos e metas'],hints:{motivo:'Ex.: avaliação inicial de emagrecimento ou retorno',queixa_principal:'Descreva a demanda e os objetivos relatados pelo paciente.',historia_atual:'Registre trajetória do peso, tentativas anteriores, apetite, sono e mudanças recentes.',antecedentes:'Registre comorbidades e história clínica relevante, se relatadas.',habitos:'Alimentação, rotina, sono, atividade física, álcool e tabagismo conforme avaliação.',exame_fisico:'Anote achados observados e medidas disponíveis; não presuma resultados.',evolucao:'Descreva evolução ponderal e composição corporal somente se medidas existirem.',conduta:'Registre orientações, exames ou condutas efetivamente definidos.'}},
 performance:{nome:'Ganho de massa e performance',descricao:'Força, treinamento, recuperação e evolução física.',guides:['Objetivos e rotina de treinamento','Alimentação, sono e recuperação','Evolução de força e composição corporal'],hints:{motivo:'Ex.: avaliação de hipertrofia ou retorno de performance',historia_atual:'Documente histórico de treino, objetivo, progressão e queixas.',habitos:'Rotina de treinos, alimentação, sono, descanso e recuperação.',medicamentos:'Registre medicamentos e suplementos relatados, sem pressupor uso.',exame_fisico:'Registre avaliação funcional e composição corporal quando disponíveis.',evolucao:'Relate mudanças de força, medidas e funcionalidade observadas.',conduta:'Registre o plano discutido e orientações individualizadas.'}},
 hormonal:{nome:'Saúde hormonal',descricao:'Sintomas, histórico clínico e avaliação individualizada.',guides:['Sintomas e sua evolução','Histórico clínico, medicamentos e tratamentos','Exames disponíveis e acompanhamento'],hints:{motivo:'Ex.: avaliação de sintomas hormonais ou acompanhamento',queixa_principal:'Descreva os sintomas relatados e o impacto na rotina.',historia_atual:'Registre início, duração e evolução de cada sintoma.',antecedentes:'História clínica, reprodutiva ou endócrina pertinente à avaliação.',medicamentos:'Medicamentos e tratamentos em uso informados pelo paciente.',diagnostico:'Anote somente hipóteses sustentadas pela avaliação; não presuma deficiência hormonal.',conduta:'Registre exames, aconselhamento e tratamentos efetivamente indicados.',retorno:'Orientações e reavaliações definidas na consulta.'}},
 ortopedia:{nome:'Ortopedia',descricao:'Dor, função, exame musculoesquelético e seguimento.',guides:['Localização, início e características da dor','Limitação funcional, trauma e tratamento prévio','Exame físico, sinais de alerta e acompanhamento'],hints:{motivo:'Ex.: dor musculoesquelética ou retorno ortopédico',queixa_principal:'Localize a queixa, lateralidade, intensidade e limitações relatadas.',historia_atual:'Início, mecanismo, irradiação, fatores de melhora ou piora e tratamentos prévios.',antecedentes:'Lesões, cirurgias e antecedentes relevantes.',exame_fisico:'Descreva inspeção, mobilidade, força e testes realmente realizados.',diagnostico:'Registre hipóteses com base na história e exame, conforme avaliação.',conduta:'Documente orientações, exames e tratamento efetivamente definidos.',retorno:'Registre prazo e critérios de reavaliação.'}}
};
function brTime(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(d);}
function brDate(v){if(!v)return 'Sem data';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:v;}
export default function ClinicalRecord({supabase,patientId,patientName,patient,appointment,workflowRequest=0,canWrite}){
 const [template,setTemplate]=useState('geral');
 const [records,setRecords]=useState([]),[form,setForm]=useState(newForm),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[tableMissing,setTableMissing]=useState(false),[showForm,setShowForm]=useState(false);
 const [aiNotes,setAiNotes]=useState(''),[aiDraft,setAiDraft]=useState(''),[aiError,setAiError]=useState('');
 useEffect(()=>{if(workflowRequest>0&&canWrite)setShowForm(true);},[workflowRequest,canWrite]);
 useEffect(()=>{
  if(!canWrite||!appointment||appointment.patientId!==patientId||!appointment.appointmentId)return;
  setForm({...newForm(),
   motivo:appointment.type==='retorno'?'Retorno agendado':'Consulta agendada'});
  setTemplate('geral');setShowForm(true);setError('');setSuccess('');
 },[appointment?.appointmentId,patientId,canWrite]);
 useEffect(()=>{let active=true;setRecords([]);setLoading(true);setError('');setTableMissing(false);supabase.from('consultas_teste').select('*').eq('paciente_id',patientId).order('data_consulta',{ascending:false}).order('criado_em',{ascending:false}).limit(100).then(({data,error})=>{if(!active)return;if(error){setError('Não foi possível consultar prontuário: '+error.message);setTableMissing(error.code==='42P01'||error.code==='PGRST205');}else setRecords(data||[]);setLoading(false);});return()=>{active=false}},[patientId,supabase]);
 const change=(k,v)=>setForm(old=>({...old,[k]:v}));
 async function copyForChatGPT(){
  setAiError('');setSuccess('');
  if(!aiNotes.trim()){setAiError('Escreva anotações fictícias antes de copiar.');return;}
  const context=groups.flatMap(([,fields])=>fields)
   .filter(([key])=>key!=='data_consulta'&&key!=='evolucao')
   .map(([key,label])=>[label,String(form[key]||'').trim()])
   .filter(([,value])=>value).map(([label,value])=>label+': '+value).join('\n');
  const prompt=[
   'Organize as anotações abaixo de uma CONSULTA INTEIRAMENTE FICTÍCIA em uma evolução médica padronizada em português do Brasil.',
   'Preserve todos os sintomas, negativas, datas, números, doses, medidas, exames, hipóteses e condutas informados.',
   'Não invente informações, diagnósticos, condutas ou exames não fornecidos.',
   'Separe em seções apenas quando houver informações: queixa principal, HDA, antecedentes, medicamentos, hábitos, exame físico, exames, avaliação, conduta e retorno.',
   'Não presuma que hipóteses são diagnósticos confirmados. Em caso de ambiguidade, inclua pontos a confirmar.',
   'Responda apenas com o texto da evolução, pronto para revisão médica.',
   '',
   'CONTEXTO ESTRUTURADO:',
   context||'(não informado)',
   '',
   'ANOTAÇÕES LIVRES:',
   aiNotes
  ].join('\n');
  try{
   await navigator.clipboard.writeText(prompt);
   setSuccess('Texto fictício copiado. Abra o ChatGPT, cole e depois retorne para revisar a evolução.');
  }catch{
   setAiError('A cópia automática foi bloqueada pelo navegador. Selecione e copie suas anotações manualmente.');
  }
 }
 function useDraft(){
  if(!aiDraft.trim())return;
  if(form.evolucao.trim()&&!window.confirm('Substituir o texto atual do campo Evolução pelo rascunho revisado?'))return;
  change('evolucao',aiDraft);
  setAiError('');
 }

 async function save(e){
  e.preventDefault();setError('');setSuccess('');if(!canWrite)return;
  if(!form.motivo.trim()){setError('Informe o motivo da consulta.');return;}
  setBusy(true);
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){setError('Sessão expirada. Faça login novamente.');setBusy(false);return;}
  const payload={paciente_id:patientId,profissional_id:user.id};
  if(appointment?.appointmentId&&appointment.patientId===patientId)payload.agendamento_id=appointment.appointmentId;
  for(const [k,v] of Object.entries(form))payload[k]=v===''?null:(k==='motivo'?v.trim():v);
  const {data,error}=await supabase.from('consultas_teste').insert(payload).select('*').single();
  if(error)setError('Não foi possível salvar consulta: '+error.message);
  else{setRecords(old=>[data,...old].sort((a,b)=>(b.data_consulta||'').localeCompare(a.data_consulta||'')||(b.criado_em||'').localeCompare(a.criado_em||'')));setForm(newForm());setAiNotes('');setAiDraft('');setAiError('');setTemplate('geral');setShowForm(false);setSuccess('Consulta de teste salva.');}
  setBusy(false);
 }
 return <div id="paciente-consulta-form" className="premium-panel clinical-panel">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">⌁</span><div><h3>Prontuário médico de testes</h3><p>Consultas e evoluções fictícias, organizadas por data.</p></div></div>
  {!canWrite?<p className="profile-notice">O conteúdo clínico está disponível exclusivamente para o perfil médico autorizado.</p>:<>
   <p className="profile-notice">Ambiente de testes. Não insira informações de pacientes reais. Registros salvos nesta etapa não podem ser alterados ou excluídos pela interface.</p>
   {tableMissing&&<p className="form-message">A tabela de consultas ainda não está disponível. A migração precisa ser revisada e aplicada no Supabase antes de salvar.</p>}
   {error&&<p role="alert" className="form-message">{error}</p>}
   {success&&<p role="status" className="form-message">{success}</p>}
   {appointment?.patientId===patientId&&<div className="clinical-appointment-context" role="status">
    <strong>Atendimento aberto pela agenda</strong>
    <span>Data: {brDate(appointment.date)} · Horário: {appointment.time||'não informado'} · {appointment.type==='retorno'?'Retorno':'Consulta'}</span>
    <small>O agendamento é apenas referência. A data e o horário registrados correspondem ao início real desta ficha, mesmo em caso de atraso. A agenda não é alterada automaticamente.</small>
   </div>}
   <div className="record-top"><h4>Histórico de consultas</h4><button type="button" disabled={tableMissing} className="gold-button" onClick={()=>{if(!showForm)setForm(newForm());setShowForm(v=>!v);}}>{showForm?'Fechar formulário':'+ Nova consulta'}</button></div>
   {showForm&&<form onSubmit={save} className="clinical-form">
    <div className="consultation-template"><label htmlFor="consultation-model">Modelo de consulta
      <select id="consultation-model" value={template} onChange={e=>setTemplate(e.target.value)}>{Object.entries(templates).map(([key,item])=><option key={key} value={key}>{item.nome}</option>)}</select>
    </label><p>{templates[template].descricao}</p><div className="template-guides">{templates[template].guides.map(g=><span key={g}>{g}</span>)}</div><small>Roteiro orientador: nenhuma informação é preenchida ou diagnosticada automaticamente.</small></div>
    <p className="consultation-start">Horário registrado automaticamente ao iniciar: <strong>{brTime(form.iniciada_em)}</strong></p>
    <section className="form-section clinical-ai-section" aria-label="Assistente de evolução com IA">
     <h4>Organizar evolução com seu ChatGPT — Teste</h4>
     <p className="profile-notice">Use sua assinatura atual do ChatGPT, sem contratar API adicional. Este painel NÃO envia dados automaticamente ao ChatGPT: você copia as anotações fictícias, organiza no ChatGPT e cola o resultado revisado aqui. Não utilize dados ou informações identificáveis de pacientes reais enquanto o fluxo não for validado para privacidade e LGPD.</p>
     <div className="clinical-ai-grid">
      <div className="clinical-ai-column">
       <label>Anotações livres durante a consulta
        <textarea rows={12} maxLength={12000} value={aiNotes}
         onChange={e=>{setAiNotes(e.target.value);setAiDraft('');}}
         placeholder="Exemplo fictício: paciente relata cansaço há 3 meses, sono de 6h/noite, treina 3 vezes por semana, nega febre. Exames informados..."/>
       </label>
       <small>Acrescente informações fictícias durante a consulta. O botão copia suas notas e um pedido de organização pronto para colar no ChatGPT.</small>
       <button type="button" className="gold-button" disabled={!aiNotes.trim()} onClick={copyForChatGPT}>Copiar anotações para o ChatGPT</button>
       <a className="clinical-ai-chat-link" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT em outra aba ↗</a>
      </div>
      <div className="clinical-ai-column">
       <label>Rascunho padronizado — revisar antes de usar
        <textarea rows={12} value={aiDraft} onChange={e=>setAiDraft(e.target.value)}
         placeholder="Cole aqui a evolução organizada pelo ChatGPT. Revise todas as informações antes de transferir ao prontuário."/>
       </label>
       <small>Cole o texto devolvido pelo ChatGPT, revise, ajuste e transfira para o campo Evolução. A consulta só será salva quando você clicar em Salvar.</small>
       <button type="button" className="outline-gold" disabled={!aiDraft.trim()} onClick={useDraft}>Usar texto revisado no campo Evolução</button>
      </div>
     </div>
     {aiError&&<p role="alert" className="form-message">{aiError}</p>}
    </section>
    {groups.map(([heading,fields])=><div key={heading} className="form-section"><h4>{heading}</h4><div className="clinical-fields">{fields.map(([k,label,type])=><label key={k}>{label}{type==='textarea'?<textarea rows={3} maxLength={12000} placeholder={templates[template].hints[k]||'Descreva somente informações apuradas na consulta.'} value={form[k]} onChange={e=>change(k,e.target.value)}/>:<input type={type} placeholder={templates[template].hints[k]||undefined} step={type==='number'?(k==='peso_kg'||k==='altura_cm'?'0.1':'1'):undefined} min={type==='number'?'0':undefined} required={k==='motivo'||k==='data_consulta'} maxLength={type==='text'?200:undefined} value={form[k]} onChange={e=>change(k,e.target.value)}/>}</label>)}</div></div>)}
    <div className="form-actions"><button type="button" className="outline-gold" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="gold-button" disabled={busy}>{busy?'Salvando...':'Salvar consulta de teste'}</button></div>
   </form>}
   {loading?<p>Carregando histórico...</p>:records.length===0?<p className="record-empty">Nenhuma consulta de teste registrada para este paciente.</p>:<div className="record-list">{records.map(r=><details key={r.id} className="record-entry"><summary><span>{brDate(r.data_consulta)} · {brTime(r.iniciada_em||r.criado_em)}{!r.iniciada_em?' (salvamento)':''} · {r.motivo}</span><span>Ver evolução</span></summary><div className="record-content">{groups.flatMap(([,fields])=>fields).filter(([k])=>k!=='motivo'&&k!=='data_consulta'&&r[k]!==null&&r[k]!==''&&r[k]!==undefined).map(([k,label])=><div key={k}><strong>{label}</strong><p>{String(r[k])}</p></div>)}{r.peso_kg&&r.altura_cm?<div><strong>IMC calculado</strong><p>{(Number(r.peso_kg)/((Number(r.altura_cm)/100)**2)).toFixed(1).replace('.',',')} kg/m²</p></div>:null}<DocumentPreparation kind="evolucao" document={r} patientName={patientName||'Paciente fictício'} patient={patient} patientId={patientId} supabase={supabase}/></div></details>)}</div>}
  </>}
 </div>;
}
