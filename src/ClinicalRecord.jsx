import React,{useEffect,useState} from 'react';
// O cliente Supabase autenticado é recebido do componente principal.
const newForm=()=>({data_consulta:[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-'),iniciada_em:new Date().toISOString(),motivo:'',queixa_principal:'',historia_atual:'',antecedentes:'',medicamentos:'',alergias:'',habitos:'',exame_fisico:'',peso_kg:'',altura_cm:'',pressao_arterial:'',frequencia_cardiaca:'',diagnostico:'',conduta:'',evolucao:'',retorno:''});
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
export default function ClinicalRecord({supabase,patientId,canWrite}){
 const [template,setTemplate]=useState('geral');
 const [records,setRecords]=useState([]),[form,setForm]=useState(newForm),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[tableMissing,setTableMissing]=useState(false),[showForm,setShowForm]=useState(false);
 const [aiNotes,setAiNotes]=useState(''),[aiDraft,setAiDraft]=useState(''),[aiBusy,setAiBusy]=useState(false),[aiError,setAiError]=useState('');
 useEffect(()=>{let active=true;setRecords([]);setLoading(true);setError('');setTableMissing(false);supabase.from('consultas_teste').select('*').eq('paciente_id',patientId).order('data_consulta',{ascending:false}).order('criado_em',{ascending:false}).limit(100).then(({data,error})=>{if(!active)return;if(error){setError('Não foi possível consultar prontuário: '+error.message);setTableMissing(error.code==='42P01'||error.code==='PGRST205');}else setRecords(data||[]);setLoading(false);});return()=>{active=false}},[patientId,supabase]);
 const change=(k,v)=>setForm(old=>({...old,[k]:v}));
 async function organizeNotes(){
  setAiError('');setError('');
  if(!canWrite||aiBusy)return;
  if(aiNotes.trim().length<10){setAiError('Escreva pelo menos 10 caracteres de anotações fictícias.');return;}
  const context=groups.flatMap(([,fields])=>fields)
   .filter(([key])=>key!=='data_consulta')
   .map(([key,label])=>[label,String(form[key]||'').trim()])
   .filter(([,value])=>value).map(([label,value])=>label+': '+value).join('\n');
  setAiBusy(true);setAiDraft('');
  const {data,error:fnError}=await supabase.functions.invoke('organizar-evolucao-teste',{
   body:{notas:aiNotes,contexto:context.slice(0,9000)}
  });
  if(fnError||!data?.evolucao){
   setAiError('Não foi possível gerar a evolução. Confirme se a função foi publicada e a chave de API configurada. '+(data?.error||fnError?.message||''));
  }else setAiDraft(data.evolucao);
  setAiBusy(false);
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
  for(const [k,v] of Object.entries(form))payload[k]=v===''?null:(k==='motivo'?v.trim():v);
  const {data,error}=await supabase.from('consultas_teste').insert(payload).select('*').single();
  if(error)setError('Não foi possível salvar consulta: '+error.message);
  else{setRecords(old=>[data,...old].sort((a,b)=>(b.data_consulta||'').localeCompare(a.data_consulta||'')||(b.criado_em||'').localeCompare(a.criado_em||'')));setForm(newForm());setAiNotes('');setAiDraft('');setAiError('');setTemplate('geral');setShowForm(false);setSuccess('Consulta de teste salva.');}
  setBusy(false);
 }
 return <div className="premium-panel clinical-panel">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">⌁</span><div><h3>Prontuário médico de testes</h3><p>Consultas e evoluções fictícias, organizadas por data.</p></div></div>
  {!canWrite?<p className="profile-notice">O conteúdo clínico está disponível exclusivamente para o perfil médico autorizado.</p>:<>
   <p className="profile-notice">Ambiente de testes. Não insira informações de pacientes reais. Registros salvos nesta etapa não podem ser alterados ou excluídos pela interface.</p>
   {tableMissing&&<p className="form-message">A tabela de consultas ainda não está disponível. A migração precisa ser revisada e aplicada no Supabase antes de salvar.</p>}
   {error&&<p role="alert" className="form-message">{error}</p>}
   {success&&<p role="status" className="form-message">{success}</p>}
   <div className="record-top"><h4>Histórico de consultas</h4><button type="button" disabled={tableMissing} className="gold-button" onClick={()=>{if(!showForm)setForm(newForm());setShowForm(v=>!v);}}>{showForm?'Fechar formulário':'+ Nova consulta'}</button></div>
   {showForm&&<form onSubmit={save} className="clinical-form">
    <div className="consultation-template"><label htmlFor="consultation-model">Modelo de consulta
      <select id="consultation-model" value={template} onChange={e=>setTemplate(e.target.value)}>{Object.entries(templates).map(([key,item])=><option key={key} value={key}>{item.nome}</option>)}</select>
    </label><p>{templates[template].descricao}</p><div className="template-guides">{templates[template].guides.map(g=><span key={g}>{g}</span>)}</div><small>Roteiro orientador: nenhuma informação é preenchida ou diagnosticada automaticamente.</small></div>
    <p className="consultation-start">Horário registrado automaticamente ao iniciar: <strong>{brTime(form.iniciada_em)}</strong></p>
    <section className="form-section clinical-ai-section" aria-label="Assistente de evolução com IA">
     <h4>Assistente de evolução com IA — Teste</h4>
     <p className="profile-notice">Use somente anotações fictícias. A IA organiza o texto sem salvar automaticamente. Confira todos os dados, doses, exames e hipóteses antes de aprovar. A geração requer uma função protegida no Supabase e chave OpenAI configurada no servidor.</p>
     <div className="clinical-ai-grid">
      <div className="clinical-ai-column">
       <label>Anotações livres durante a consulta
        <textarea rows={12} maxLength={12000} value={aiNotes}
         onChange={e=>{setAiNotes(e.target.value);setAiDraft('');}}
         placeholder="Exemplo fictício: paciente relata cansaço há 3 meses, sono de 6h/noite, treina 3 vezes por semana, nega febre. Exames informados..."/>
       </label>
       <small>Acrescente informações conforme a conversa evoluir e clique em Organizar. A geração é acionada manualmente, não a cada tecla.</small>
       <button type="button" className="gold-button" disabled={aiBusy||aiNotes.trim().length<10} onClick={organizeNotes}>{aiBusy?'Organizando anotações...':'Organizar evolução com IA'}</button>
      </div>
      <div className="clinical-ai-column">
       <label>Rascunho padronizado — revisar antes de usar
        <textarea rows={12} value={aiDraft} onChange={e=>setAiDraft(e.target.value)}
         placeholder="A evolução organizada aparecerá aqui. Você poderá revisar e editar antes de transferir ao prontuário."/>
       </label>
       <small>O texto gerado não substitui sua avaliação, nem será salvo até sua revisão e o salvamento da consulta.</small>
       <button type="button" className="outline-gold" disabled={!aiDraft.trim()||aiBusy} onClick={useDraft}>Usar texto revisado no campo Evolução</button>
      </div>
     </div>
     {aiError&&<p role="alert" className="form-message">{aiError}</p>}
    </section>
    {groups.map(([heading,fields])=><div key={heading} className="form-section"><h4>{heading}</h4><div className="clinical-fields">{fields.map(([k,label,type])=><label key={k}>{label}{type==='textarea'?<textarea rows={3} maxLength={12000} placeholder={templates[template].hints[k]||'Descreva somente informações apuradas na consulta.'} value={form[k]} onChange={e=>change(k,e.target.value)}/>:<input type={type} placeholder={templates[template].hints[k]||undefined} step={type==='number'?(k==='peso_kg'||k==='altura_cm'?'0.1':'1'):undefined} min={type==='number'?'0':undefined} required={k==='motivo'||k==='data_consulta'} maxLength={type==='text'?200:undefined} value={form[k]} onChange={e=>change(k,e.target.value)}/>}</label>)}</div></div>)}
    <div className="form-actions"><button type="button" className="outline-gold" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="gold-button" disabled={busy}>{busy?'Salvando...':'Salvar consulta de teste'}</button></div>
   </form>}
   {loading?<p>Carregando histórico...</p>:records.length===0?<p className="record-empty">Nenhuma consulta de teste registrada para este paciente.</p>:<div className="record-list">{records.map(r=><details key={r.id} className="record-entry"><summary><span>{brDate(r.data_consulta)} · {brTime(r.iniciada_em||r.criado_em)}{!r.iniciada_em?' (salvamento)':''} · {r.motivo}</span><span>Ver evolução</span></summary><div className="record-content">{groups.flatMap(([,fields])=>fields).filter(([k])=>k!=='motivo'&&k!=='data_consulta'&&r[k]!==null&&r[k]!==''&&r[k]!==undefined).map(([k,label])=><div key={k}><strong>{label}</strong><p>{String(r[k])}</p></div>)}{r.peso_kg&&r.altura_cm?<div><strong>IMC calculado</strong><p>{(Number(r.peso_kg)/((Number(r.altura_cm)/100)**2)).toFixed(1).replace('.',',')} kg/m²</p></div>:null}</div></details>)}</div>}
  </>}
 </div>;
}
