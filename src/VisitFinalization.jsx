import React,{useEffect,useMemo,useState} from 'react';

const checks=[
 {id:'evolucao',title:'Evolução conferida',hint:'Confirme que a evolução corresponde ao atendimento e que os dados foram revisados.'},
 {id:'tratamento',title:'Condutas e prescrições avaliadas',hint:'Confira as prescrições salvas, quando aplicáveis, e as orientações de tratamento.'},
 {id:'retorno',title:'Orientações e retorno revisados',hint:'Confirme a orientação de acompanhamento, inclusive quando não houver retorno agendado.'},
 {id:'documentos',title:'Documentos e autorizações avaliados',hint:'Verifique termos ou anexos necessários para o procedimento, quando aplicáveis.'}
];
const sameDay=(v,day)=>!day||String(v||'').slice(0,10)===day;
export function summarizeVisit(rows,day){
 const clinical=(rows.clinical||[]).filter(x=>sameDay(x.data_consulta,day));
 const home=(rows.home||[]).filter(x=>sameDay(x.criado_em,day));
 const applications=(rows.applications||[]).filter(x=>sameDay(x.criado_em,day));
 const documents=(rows.documents||[]).filter(x=>sameDay(x.criado_em,day));
 return {
  clinical:clinical.length,home:home.length,applications:applications.length,
  documents:documents.length,
  evolution:clinical.some(x=>Boolean(String(x.evolucao||'').trim())),
  returnGuidance:clinical.some(x=>Boolean(String(x.retorno||'').trim())),
  unsignedHome:home.filter(x=>x.status_assinatura!=='assinada').length
 };
}
export default function VisitFinalization({supabase,patientId,appointment}){
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [refreshKey,setRefreshKey]=useState(0),[error,setError]=useState('');
 const [data,setData]=useState({clinical:[],home:[],applications:[],documents:[]});
 const [confirmed,setConfirmed]=useState({});
 const [finished,setFinished]=useState(false);
 const day=appointment?.date||null;
 useEffect(()=>{
  let active=true;setLoading(true);setError('');setFinished(false);setConfirmed({});
  async function load(){
   try{
    const [clinical,home,applications,documents]=await Promise.all([
     supabase.from('consultas_teste').select('id,data_consulta,motivo,evolucao,retorno').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100),
     supabase.from('receitas_domiciliares_teste').select('id,criado_em,status_assinatura').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100),
     supabase.from('prescricoes_teste').select('id,criado_em').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100),
     supabase.from('documentos_pacientes_teste').select('id,criado_em,categoria,titulo').eq('paciente_id',patientId).order('criado_em',{ascending:false}).limit(100)
    ]);
    const responses={clinical,home,applications,documents};
    const failures=Object.entries(responses).filter(([,v])=>v.error).map(([key,v])=>key+': '+v.error.message);
    if(failures.length)throw new Error(failures.join('; '));
    if(active)setData(Object.fromEntries(Object.entries(responses).map(([key,v])=>[key,v.data||[]])));
   }catch(e){if(active){setError('Conferência incompleta. Não é possível confirmar esta revisão: '+e.message);setData({clinical:[],home:[],applications:[],documents:[]});}}
   finally{if(active)setLoading(false);}
  }
  load();
  return()=>{active=false;};
 },[supabase,patientId,day,refreshKey]);
 const summary=useMemo(()=>summarizeVisit(data,day),[data,day]);
 const complete=checks.every(x=>confirmed[x.id]);
 function finish(){
  if(!complete||loading||busy||error||!summary.clinical)return;
  if(!window.confirm('Confirmar apenas a conferência visual desta sessão de testes? Isso NÃO encerra o agendamento, NÃO assina documentos e NÃO grava uma finalização no prontuário.'))return;
  setBusy(true);setFinished(true);setBusy(false);
 }
 return <section className="visit-finalization" aria-label="Finalização assistida de consulta de teste">
  <div className="visit-finalization-top">
   <div><h4>Conferência de registros</h4><small>{day?'Somente registros datados de '+day.split('-').reverse().join('/'):'Sem consulta selecionada: histórico de até 100 registros por categoria deste paciente'}</small></div>
   <button className="outline-gold" type="button" disabled={loading} onClick={()=>setRefreshKey(n=>n+1)}>Atualizar registros</button>
  </div>
  <p>Esta conferência consulta registros fictícios já salvos. Uma receita ou documento encontrado não significa que esteja assinado, validado ou entregue. Arquivos de termos anexados não comprovam, isoladamente, consentimento válido.</p>
  {loading?<p>Conferindo registros salvos…</p>:error?<p className="form-message" role="alert">{error}</p>:<>
   <div className="visit-finalization-counters">
    <div><strong>{summary.clinical}</strong><span>{day?'Consulta(s) na data':'Consultas no histórico'}</span></div>
    <div><strong>{summary.home}</strong><span>Receita(s) domiciliar(es)</span></div>
    <div><strong>{summary.applications}</strong><span>Prescrição(ões) de aplicação</span></div>
    <div><strong>{summary.documents}</strong><span>Anexo(s) arquivado(s)</span></div>
   </div>
   {!summary.clinical&&<p className="form-message" role="alert">Nenhuma consulta salva no período selecionado. Registre a consulta antes de concluir esta conferência.</p>}
   {summary.clinical>0&&!summary.evolution&&<p className="form-message" role="alert">Há consulta salva, mas o campo Evolução está vazio nos registros consultados. Revise o prontuário.</p>}
   {summary.clinical>0&&!summary.returnGuidance&&<p className="profile-notice">Não há orientação de retorno registrada no campo específico. Revise se o acompanhamento foi documentado em outro campo.</p>}
   {summary.unsignedHome>0&&<p className="profile-notice">{summary.unsignedHome} receita(s) domiciliar(es) constam como não assinadas. O Bird ID ainda não está integrado.</p>}
   <div className="visit-finalization-checks">
    {checks.map(item=><label key={item.id} className="visit-finalization-check">
     <input type="checkbox" checked={Boolean(confirmed[item.id])} disabled={finished||!summary.clinical} onChange={e=>setConfirmed(v=>({...v,[item.id]:e.target.checked}))}/>
     <span><strong>{item.title}</strong><small>{item.hint}</small></span>
    </label>)}
   </div>
   {finished?<p className="visit-finalization-finished" role="status">Conferência visual registrada apenas nesta tela. O atendimento NÃO foi concluído na agenda e nenhuma informação foi gravada ou assinada. Use “Atualizar registros” para refazer a revisão.</p>:
    <button type="button" className="gold-button" disabled={!complete||!summary.clinical||loading||busy} onClick={finish}>Confirmar conferência visual</button>}
   <small>As marcações são temporárias e desaparecem ao sair ou recarregar a ficha. Não há registro de auditoria ou fechamento clínico nesta etapa.</small>
  </>}
 </section>;
}
