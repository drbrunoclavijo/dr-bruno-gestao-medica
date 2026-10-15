import React,{useEffect,useState} from 'react';
// O cliente Supabase autenticado é recebido do componente principal.
const newForm=()=>({data_consulta:[new Date().getFullYear(),String(new Date().getMonth()+1).padStart(2,'0'),String(new Date().getDate()).padStart(2,'0')].join('-'),iniciada_em:new Date().toISOString(),motivo:'',queixa_principal:'',historia_atual:'',antecedentes:'',medicamentos:'',alergias:'',habitos:'',exame_fisico:'',peso_kg:'',altura_cm:'',pressao_arterial:'',frequencia_cardiaca:'',diagnostico:'',conduta:'',evolucao:'',retorno:''});
const groups=[
 ['Consulta',[['data_consulta','Data da consulta','date'],['motivo','Motivo da consulta','text'],['queixa_principal','Queixa principal','textarea'],['historia_atual','História da doença atual','textarea']]],
 ['Anamnese',[['antecedentes','Antecedentes','textarea'],['medicamentos','Medicamentos em uso','textarea'],['alergias','Alergias','textarea'],['habitos','Hábitos de vida','textarea']]],
 ['Avaliação médica',[['peso_kg','Peso (kg)','number'],['altura_cm','Altura (cm)','number'],['pressao_arterial','Pressão arterial','text'],['frequencia_cardiaca','Frequência cardíaca (bpm)','number'],['exame_fisico','Exame físico','textarea']]],
 ['Evolução e plano',[['diagnostico','Hipóteses diagnósticas','textarea'],['conduta','Conduta','textarea'],['evolucao','Evolução clínica','textarea'],['retorno','Orientações e retorno','textarea']]]
];
function brTime(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}).format(d);}
function brDate(v){if(!v)return 'Sem data';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]:v;}
export default function ClinicalRecord({supabase,patientId,canWrite}){
 const [records,setRecords]=useState([]),[form,setForm]=useState(newForm),[error,setError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[tableMissing,setTableMissing]=useState(false),[showForm,setShowForm]=useState(false);
 useEffect(()=>{let active=true;setRecords([]);setLoading(true);setError('');setTableMissing(false);supabase.from('consultas_teste').select('*').eq('paciente_id',patientId).order('data_consulta',{ascending:false}).order('criado_em',{ascending:false}).limit(100).then(({data,error})=>{if(!active)return;if(error){setError('Não foi possível consultar prontuário: '+error.message);setTableMissing(error.code==='42P01'||error.code==='PGRST205');}else setRecords(data||[]);setLoading(false);});return()=>{active=false}},[patientId,supabase]);
 const change=(k,v)=>setForm(old=>({...old,[k]:v}));
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
  else{setRecords(old=>[data,...old].sort((a,b)=>(b.data_consulta||'').localeCompare(a.data_consulta||'')||(b.criado_em||'').localeCompare(a.criado_em||'')));setForm(newForm());setShowForm(false);setSuccess('Consulta de teste salva.');}
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
   {showForm&&<form onSubmit={save} className="clinical-form"><p className="consultation-start">Horário registrado automaticamente ao iniciar: <strong>{brTime(form.iniciada_em)}</strong></p>
    {groups.map(([heading,fields])=><div key={heading} className="form-section"><h4>{heading}</h4><div className="clinical-fields">{fields.map(([k,label,type])=><label key={k}>{label}{type==='textarea'?<textarea rows={3} maxLength={12000} value={form[k]} onChange={e=>change(k,e.target.value)}/>:<input type={type} step={type==='number'?(k==='peso_kg'||k==='altura_cm'?'0.1':'1'):undefined} min={type==='number'?'0':undefined} required={k==='motivo'||k==='data_consulta'} maxLength={type==='text'?200:undefined} value={form[k]} onChange={e=>change(k,e.target.value)}/>}</label>)}</div></div>)}
    <div className="form-actions"><button type="button" className="outline-gold" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="gold-button" disabled={busy}>{busy?'Salvando...':'Salvar consulta de teste'}</button></div>
   </form>}
   {loading?<p>Carregando histórico...</p>:records.length===0?<p className="record-empty">Nenhuma consulta de teste registrada para este paciente.</p>:<div className="record-list">{records.map(r=><details key={r.id} className="record-entry"><summary><span>{brDate(r.data_consulta)} · {brTime(r.iniciada_em||r.criado_em)}{!r.iniciada_em?' (salvamento)':''} · {r.motivo}</span><span>Ver evolução</span></summary><div className="record-content">{groups.flatMap(([,fields])=>fields).filter(([k])=>k!=='motivo'&&k!=='data_consulta'&&r[k]!==null&&r[k]!==''&&r[k]!==undefined).map(([k,label])=><div key={k}><strong>{label}</strong><p>{String(r[k])}</p></div>)}{r.peso_kg&&r.altura_cm?<div><strong>IMC calculado</strong><p>{(Number(r.peso_kg)/((Number(r.altura_cm)/100)**2)).toFixed(1).replace('.',',')} kg/m²</p></div>:null}</div></details>)}</div>}
  </>}
 </div>;
}
