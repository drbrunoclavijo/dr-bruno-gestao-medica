import React,{useEffect,useState} from 'react';
import {infinityRates,infinityInstant,tiers,ratePct,quoteInfinity} from './PaymentRates.js';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const dateBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const today=()=>new Date().toISOString().slice(0,10);
const parseCents=s=>Number(s||'0')/100;
const currencyInput=s=>s?money(Number(s)/100):'';
const centsInput=v=>String(v||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,9);
const parsePercentage=v=>Number(String(v||'0').replace(',','.'));
const formatPercentage=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const validPercentage=v=>/^\d{1,3}([.,]\d{1,2})?$/.test(String(v||'0'))&&parsePercentage(v)>=0&&parsePercentage(v)<=100;
const clinicAmount=(priceCents,rate)=>Math.round(Number(priceCents||0)*parsePercentage(rate)/100)/100;
export default function TestProtocols({supabase}){
 const [protocols,setProtocols]=useState([]),[patients,setPatients]=useState([]),[rxs,setRxs]=useState([]);
 const [patient,setPatient]=useState(''),[name,setName]=useState(''),[start,setStart]=useState(today());
 const [duration,setDuration]=useState('90'),[days,setDays]=useState('90'),[price,setPrice]=useState(''),[clinic,setClinic]=useState('0');
 const [catalog,setCatalog]=useState([]),[selection,setSelection]=useState('essential_reset'),[customDescription,setCustomDescription]=useState('');
 const [ratesBrand,setRatesBrand]=useState('visa'),[ratesTier,setRatesTier]=useState('inicial'),[ratesPlan,setRatesPlan]=useState('dia'),[installmentsCount,setInstallmentsCount]=useState('1');
 const [savedPricing,setSavedPricing]=useState({});
 const [clinicEdits,setClinicEdits]=useState({}),[clinicBusy,setClinicBusy]=useState('');
 const [selectedRx,setSelectedRx]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [forecasts,setForecasts]=useState({}),[sessionCosts,setSessionCosts]=useState({});
 const [sessions,setSessions]=useState([]),[sessionItems,setSessionItems]=useState([]),[sessionForm,setSessionForm]=useState({}),[sessionBusy,setSessionBusy]=useState('');
 const [recurrence,setRecurrence]=useState({});
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  const [p,pa,rx,estimates,sessionList,sessionOptions,costs,catalogResponse,pricingResponse]=await Promise.all([
   supabase.rpc('listar_protocolos_com_insumos_teste'),
   supabase.from('pacientes').select('id,nome').order('nome').limit(300),
   supabase.rpc('listar_prescricoes_para_protocolos_teste'),
   supabase.rpc('previsao_custos_protocolos_teste'),
   supabase.rpc('listar_sessoes_protocolos_teste'),
   supabase.rpc('itens_sessoes_protocolos_teste'),
   supabase.rpc('custos_sessoes_protocolos_teste'),
   supabase.rpc('listar_catalogo_servicos_teste'),
   supabase.rpc('listar_precificacao_protocolos_teste')
  ]);
  if(p.error||pa.error||rx.error||estimates.error||sessionList.error||sessionOptions.error||costs.error||catalogResponse.error||pricingResponse.error)setError('Não foi possível carregar protocolos e o catálogo: '+(p.error||pa.error||rx.error||estimates.error||sessionList.error||sessionOptions.error||costs.error||catalogResponse.error||pricingResponse.error).message+'. Verifique a migração SQL do catálogo.');
  else{setProtocols(p.data||[]);setPatients(pa.data||[]);setRxs(rx.data||[]);setForecasts(Object.fromEntries((estimates.data||[]).map(x=>[x.protocolo_id,x])));setSessions(sessionList.data||[]);setSessionItems(sessionOptions.data||[]);setSessionCosts(Object.fromEntries((costs.data||[]).map(x=>[x.sessao_id,x])));setClinicEdits(Object.fromEntries((p.data||[]).map(x=>[x.protocolo_id,formatPercentage(x.percentual_clinica)])));setCatalog(catalogResponse.data||[]);setSavedPricing(Object.fromEntries((pricingResponse.data||[]).map(x=>[x.protocolo_id,x])));}
  setLoading(false);
 }
 useEffect(()=>{load()},[]);
 const chosen=catalog.find(c=>c.codigo===selection);
 const isProtocol=chosen?.tipo==='protocolo';
 const agreed=parseCents(price);
 const installmentNumber=Number(installmentsCount);
 const quote=quoteInfinity(agreed,installmentNumber,ratesBrand,ratesTier,ratesPlan);
 const valuesValid=Number.isInteger(installmentNumber)&&installmentNumber>=1&&installmentNumber<=12&&
  Number.isInteger(Number(price))&&agreed>0&&quote&&Math.round(agreed*100)>=installmentNumber;
 const discount=chosen?Number(chosen.valor_tabela)-agreed:0;
 const availableRates=ratesPlan==='hora'?infinityInstant:infinityRates[ratesBrand][ratesTier];
 function selectService(key){
  setSelection(key);setError('');setMessage('');
  const item=catalog.find(c=>c.codigo===key);
  setPrice(item?String(Math.round(Number(item.valor_tabela)*100)):'');
  setDuration(item?.duracao_dias?String(item.duracao_dias):'90');
  if(key!=='outro')setCustomDescription('');
 }
 async function create(e){
  e.preventDefault();setError('');setMessage('');
  if(!patient||!start||!chosen&&selection!=='outro'||selection==='outro'&&!customDescription.trim()){
   setError('Selecione um serviço, paciente e data. Para Outro, informe a descrição.');return;
  }
  if(selection==='outro'&&customDescription.trim().length<3){setError('Descreva o serviço com pelo menos 3 caracteres.');return;}
  if(!valuesValid){setError('Informe valor maior que zero e até 12 parcelas. Cada parcela precisa ter pelo menos R$ 0,01.');return;}
  if(isProtocol&&!validPercentage(clinic)){setError('Informe uma porcentagem válida de repasse à clínica (0 a 100).');return;}
  const label=chosen?.nome||customDescription.trim();
  if(!window.confirm('Registrar '+label+' para o paciente fictício em '+installmentNumber+'x, total '+money(quote.gross)+'? '+(isProtocol?'Um protocolo será criado, sem cobrança automática.':'Uma conta a receber de teste será criada no Financeiro, sem marcar atendimento como realizado.')))return;
  setBusy(true);
  try{
   let result;
   if(isProtocol){
    result=await supabase.rpc('criar_protocolo_catalogo_teste',{
     p_paciente_id:patient,p_codigo:selection,p_inicio:start,p_valor_acordado:agreed,
     p_total_cobrado:quote.gross,p_parcelas:installmentNumber,p_taxa:quote.rate,p_percentual_clinica:parsePercentage(clinic)
    });
   }else{
    result=await supabase.rpc('criar_conta_parcelada_teste',{
     p_paciente_id:patient,p_protocolo_id:null,p_descricao:label,p_valor:quote.gross,
     p_primeiro_vencimento:start,p_numero_parcelas:installmentNumber
    });
   }
   if(result.error)throw result.error;
   setPatient('');selectService(selection);
   await load();
   setMessage(isProtocol?'Protocolo fictício criado com valor acordado, parcelas e taxa registrados. Nenhuma conta foi gerada automaticamente.':'Serviço fictício registrado como conta a receber no Financeiro, não como protocolo clínico.');
  }catch(err){setError('Não foi possível registrar: '+err.message);}
  finally{setBusy(false);}
 }
 async function link(p){
  setError('');setMessage('');
  const rxId=selectedRx[p.protocolo_id];
  if(!rxId){setError('Selecione uma prescrição do mesmo paciente.');return;}
  setBusy(true);
  const {error:err}=await supabase.rpc('vincular_prescricao_protocolo_teste',{p_protocolo_id:p.protocolo_id,p_prescricao_id:rxId});
  if(err)setError('Não foi possível vincular: '+err.message);
  else{setMessage('Prescrição vinculada ao protocolo. Os custos das baixas serão considerados automaticamente.');await load();}
  setBusy(false);
 }
 async function saveClinic(p){
  const rate=clinicEdits[p.protocolo_id]||'0';
  if(!validPercentage(rate)){
   setError('Informe uma porcentagem válida entre 0% e 100%.');return;
  }
  setClinicBusy(p.protocolo_id);setError('');setMessage('');
  const {error:err}=await supabase.rpc('definir_percentual_clinica_protocolo_teste',{
   p_protocolo_id:p.protocolo_id,p_percentual:parsePercentage(rate)
  });
  if(err)setError('Não foi possível alterar o repasse: '+err.message);
  else{await load();setMessage('Repasse da clínica atualizado no protocolo fictício.');}
  setClinicBusy('');
 }
 const [sessionLinkDraft,setSessionLinkDraft]=useState({});
 const [batchLinkDraft,setBatchLinkDraft]=useState({});
 const updateBatchLink=(protocolId,sessionId,itemId)=>setBatchLinkDraft(old=>({
  ...old,[protocolId]:{...(old[protocolId]||{}),[sessionId]:itemId}
 }));
 async function linkBatch(p){
  if(sessionBusy)return;
  const drafts=batchLinkDraft[p.protocolo_id]||{};
  const pairs=Object.entries(drafts).filter(([,itemId])=>Boolean(itemId));
  const ids=pairs.map(([,itemId])=>itemId);
  if(!pairs.length){setError('Selecione pelo menos um vínculo para confirmar.');return;}
  if(new Set(ids).size!==ids.length){setError('Um item prescrito não pode ser selecionado para mais de uma sessão.');return;}
  if(!window.confirm('Vincular '+pairs.length+' sessões às prescrições fictícias escolhidas? Revise os pares. Nenhuma checagem ou baixa será realizada.'))return;
  setSessionBusy(p.protocolo_id);setError('');setMessage('');
  const {data,error:err}=await supabase.rpc('vincular_itens_sessoes_em_lote_teste',{
   p_protocolo_id:p.protocolo_id,p_sessao_ids:pairs.map(([sessionId])=>sessionId),
   p_item_ids:ids
  });
  if(err)setError('Não foi possível associar as sessões em lote: '+err.message);
  else{
   setBatchLinkDraft(old=>({...old,[p.protocolo_id]:{}}));
   await load();
   setMessage(data+' sessões fictícias vinculadas. Nenhuma administração ou baixa de estoque foi realizada.');
  }
  setSessionBusy('');
 }

 async function bindSession(sess,p){
  const itemId=sessionLinkDraft[sess.sessao_id];
  if(!itemId||sessionBusy)return;
  setSessionBusy(sess.sessao_id);setError('');setMessage('');
  const {error:err}=await supabase.rpc('vincular_item_sessao_teste',{
   p_sessao_id:sess.sessao_id,p_item_id:itemId
  });
  if(err)setError('Não foi possível associar a prescrição à sessão: '+err.message);
  else{setSessionLinkDraft(old=>({...old,[sess.sessao_id]:''}));await load();setMessage('Sessão vinculada ao item prescrito. Nenhuma baixa de estoque foi feita.');}
  setSessionBusy('');
 }
 const updateSession=(id,k,v)=>setSessionForm(old=>({...old,[id]:{...(old[id]||{}),[k]:v}}));
 async function addSession(p){
  setError('');setMessage('');
  if(sessionBusy)return;
  const f=sessionForm[p.protocolo_id]||{},date=f.date||'',description=(f.description||'').trim();
  if(!date||!description){setError('Informe data e descrição da sessão.');return;}
  setSessionBusy(p.protocolo_id);
  const {error:err}=await supabase.rpc('criar_sessao_protocolo_teste',{
   p_protocolo_id:p.protocolo_id,p_data_prevista:date,p_descricao:description,
   p_item_prescricao_id:f.item||null,p_observacao:(f.note||'').trim()||null
  });
  if(err)setError('Não foi possível agendar a sessão: '+err.message);
  else{setSessionForm(old=>({...old,[p.protocolo_id]:{date:'',description:'',item:'',note:''}}));await load();setMessage('Sessão fictícia agendada. Nenhum estoque foi baixado.');}
  setSessionBusy('');
 }
 const updateRecurrence=(id,k,v)=>setRecurrence(old=>({...old,[id]:{...(old[id]||{}),[k]:v}}));
 function recurrenceDates(f){
  const n=Number(f.count||4),interval=Number(f.interval||7);
  if(!f.date||!Number.isInteger(n)||n<1||n>52||!Number.isInteger(interval)||interval<1||interval>90)return [];
  const first=new Date(f.date+'T12:00:00Z');
  if(Number.isNaN(first.getTime()))return [];
  return Array.from({length:n},(_,i)=>{
   const d=new Date(first.getTime()+i*interval*86400000);
   return d.toISOString().slice(0,10);
  });
 }
 async function generateRecurring(p){
  if(sessionBusy)return;
  const f=recurrence[p.protocolo_id]||{},dates=recurrenceDates(f),description=(f.description||'').trim();
  const last=dates[dates.length-1];
  const begin=p.inicio,endDate=new Date(p.inicio+'T12:00:00Z');
  endDate.setUTCDate(endDate.getUTCDate()+Number(p.duracao_dias));
  const end=endDate.toISOString().slice(0,10);
  if(!dates.length||!description||description.length>125||dates[0]<begin||last>=end){
   setError('Informe uma sequência válida inteiramente dentro do período do protocolo (até 52 sessões).');return;
  }
  if(!window.confirm('Criar '+dates.length+' agendamentos fictícios entre '+dateBR(dates[0])+' e '+dateBR(last)+'? Nenhuma medicação será prescrita ou baixada.'))return;
  setSessionBusy(p.protocolo_id);setError('');setMessage('');
  const {data,error:err}=await supabase.rpc('gerar_sessoes_recorrentes_teste',{
   p_protocolo_id:p.protocolo_id,p_primeira_data:dates[0],p_intervalo_dias:Number(f.interval||7),
   p_quantidade:dates.length,p_descricao_base:description
  });
  if(err)setError('Não foi possível gerar calendário: '+err.message);
  else{await load();setMessage(data+' sessões fictícias adicionadas. Nenhum item prescrito foi vinculado, e o estoque não foi alterado.');}
  setSessionBusy('');
 }
 async function cancelSession(sess){
  if(sessionBusy||!window.confirm('Cancelar esta sessão fictícia? Nenhum estoque será alterado.'))return;
  setSessionBusy(sess.sessao_id);setError('');setMessage('');
  const {error:err}=await supabase.rpc('cancelar_sessao_protocolo_teste',{p_sessao_id:sess.sessao_id});
  if(err)setError('Não foi possível cancelar: '+err.message);
  else{await load();setMessage('Sessão cancelada, sem movimentação de estoque.');}
  setSessionBusy('');
 }
 return <section className="premium-panel protocols-test">
  <div className="panel-title"><span className="title-icon">◈</span><div><h3>Protocolos de tratamento — Teste</h3><p>Planejamento de tratamento e estimativa financeira dos medicamentos efetivamente consumidos.</p></div></div>
  <p className="profile-notice">Exclusivo ao perfil médico no protótipo, somente pacientes fictícios. O resultado abaixo é contribuição bruta parcial: valor cobrado menos repasse à clínica e custos de medicamentos efetivamente baixados; NÃO representa lucro líquido. Não inclui impostos, salários, outros gastos indiretos, taxas, infraestrutura ou aplicações futuras. Os custos de materiais registrados e baixados são considerados. O planejamento agora aceita diversas sessões, mas cada item prescrito ainda admite uma única checagem; para aplicações recorrentes, são necessários itens próprios para cada checagem. Sessões agendadas não são comprovação de atendimento.</p>
  {error&&<p role="alert" className="form-message">{error}</p>}
  {message&&<p role="status" className="form-message">{message}</p>}
  <form className="form-section" onSubmit={create}>
   <h4>+ Registrar protocolo, consulta ou outro serviço fictício</h4>
   <div className="clinical-fields">
    <label>Serviço / Protocolo<select required value={selection} onChange={e=>selectService(e.target.value)}>
     {catalog.map(c=><option key={c.codigo} value={c.codigo}>{c.nome} · {money(c.valor_tabela)}</option>)}
     <option value="outro">Outro — descrição personalizada</option>
    </select></label>
    <label>Paciente<select required value={patient} onChange={e=>setPatient(e.target.value)}><option value="">Selecione o paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    {selection==='outro'&&<label>Descreva o serviço *<input required minLength={3} maxLength={160} placeholder="Ex.: avaliação específica" value={customDescription} onChange={e=>setCustomDescription(e.target.value)}/></label>}
    <label>{isProtocol?'Data de início':'Data do serviço / primeiro vencimento'}<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    {isProtocol&&<label>Duração do protocolo<input readOnly value={chosen.duracao_dias+' dias'}/></label>}
    <label>Valor de tabela (R$)<input readOnly value={chosen?money(chosen.valor_tabela):'Personalizado'}/></label>
    <label>Valor a pagar antes de taxas (R$)<input required inputMode="numeric" autoComplete="off" placeholder="R$ 0,00" value={currencyInput(price)} onChange={e=>setPrice(centsInput(e.target.value))}/><small>Preenchido pelo valor de tabela. Altere quando houver desconto.</small></label>
    {chosen&&<label>Diferença sobre a tabela<input readOnly value={money(discount)}/><small>Valor positivo indica desconto; negativo indica aumento.</small></label>}
    <label>Bandeira InfinitePay<select value={ratesBrand} onChange={e=>setRatesBrand(e.target.value)} disabled={installmentNumber<=6}>
     <option value="visa">Visa / Mastercard</option><option value="outras">Elo / Hipercard / Amex</option>
    </select></label>
    <label>Faixa de faturamento<select value={ratesTier} onChange={e=>setRatesTier(e.target.value)} disabled={installmentNumber<=6||ratesPlan==='hora'}>
     {Object.entries(tiers).map(([key,text])=><option key={key} value={key}>{text}</option>)}
    </select></label>
    <label>Prazo de recebimento<select value={ratesPlan} onChange={e=>setRatesPlan(e.target.value)} disabled={installmentNumber<=6}>
     <option value="dia">1 dia útil</option><option value="hora">Na hora</option>
    </select></label>
    <label>Parcelamento Máquina InfinitePay<select value={installmentsCount} onChange={e=>setInstallmentsCount(e.target.value)}>
     {availableRates.map((rate,i)=><option key={i} value={i+1}>{i+1}x — {i<6?'Sem juros / sem acréscimo':'Taxa '+ratePct(rate)}</option>)}
    </select><small>Até 6x sem acréscimo ao paciente. A partir de 7x, simulação de repasse da taxa da maquininha.</small></label>
    <label>Taxa aplicada à venda<input readOnly value={quote?ratePct(quote.rate):'—'}/></label>
    <label>Total a cobrar (R$)<input readOnly value={money(quote?.gross||0)}/><small>{quote&&quote.rate>0?'Total estimado para preservar o valor acordado após taxa: '+money(quote.fee):'Mesmo valor acordado, sem acréscimo.'}</small></label>
    <label>Valor aproximado por parcela<input readOnly value={money(quote?.perInstallment||0)}/></label>
    {isProtocol&&<><label>Porcentagem de repasse à clínica (%)<input inputMode="decimal" placeholder="0" value={clinic} onChange={e=>setClinic(e.target.value.replace(/[^\\d,.]/g,'').slice(0,6))}/><small>Repasse interno, independente da taxa da maquininha.</small></label>
     <label>Repasse calculado à clínica (R$)<input readOnly value={money(clinicAmount(Math.round((quote?.gross||0)*100),clinic))}/></label></>}
   </div>
   <p className="profile-notice">Os protocolos ficam registrados para o planejamento clínico; consultas e “Outro” criam contas financeiras de teste, sem inventar sessões de aplicação. A tabela InfinitePay é uma simulação; confirme as condições contratadas antes de cobrar. Até 6x sem acréscimo significa que a clínica pode absorver a taxa cobrada pela operadora.</p>
   <div className="form-actions"><button className="gold-button" disabled={busy||loading||!valuesValid}>{busy?'Salvando...':isProtocol?'Cadastrar protocolo':'Registrar serviço no Financeiro'}</button></div>
  </form>
  <div className="record-top"><h4>Protocolos cadastrados</h4><button type="button" className="outline-gold" disabled={loading||busy} onClick={load}>Atualizar</button></div>
  {loading?<p>Carregando...</p>:protocols.length===0?<p className="record-empty">Ainda não existem protocolos fictícios.</p>:<div className="record-list">
   {protocols.map(p=>{
    const cost=Number(p.custo_conhecido||0),priceTotal=Number(p.preco_cobrado||0),missing=Number(p.saidas_sem_custo||0),clinicValue=Number(p.repasse_clinica||0);
    const suppliesCost=Number(p.custo_insumos||0),supplyMissing=Number(p.saidas_insumos_sem_custo||0);
    const totalKnown=cost+suppliesCost+clinicValue,contribution=priceTotal-totalKnown,margin=priceTotal>0?contribution/priceTotal*100:null;
    const noDischarge=Number(p.checagens_registradas||0)===0;
    const f=forecasts[p.protocolo_id]||{};
    const pendingMed=Number(f.previsto_medicamentos_pendentes||0),pendingSup=Number(f.previsto_insumos_pendentes||0);
    const forecastGaps=Number(f.linhas_sem_preco||0)+Number(f.linhas_sem_saldo_suficiente||0)+Number(f.itens_sem_vinculo_estoque||0);
    const totalForecast=totalKnown+pendingMed+pendingSup;
    const futureBalance=priceTotal-totalForecast;
    const forecastComplete=forecastGaps===0&&missing===0&&supplyMissing===0&&Number(p.prescricoes_vinculadas||0)>0;
    const canShowMargin=!missing&&!supplyMissing&&!noDischarge&&priceTotal>0;
    const options=rxs.filter(r=>r.paciente_id===p.paciente_id&&!r.protocolo_id);
    const pSessions=sessions.filter(x=>x.protocolo_id===p.protocolo_id);
    const pOptions=sessionItems.filter(x=>x.protocolo_id===p.protocolo_id&&!x.ja_checado&&!x.ja_agendado);
    const availableSessions=pSessions.filter(x=>x.status==='agendada'&&!x.item_prescricao_id&&!x.checado_em);
    const batchSelection=batchLinkDraft[p.protocolo_id]||{};
    const batchSelected=availableSessions.map(x=>batchSelection[x.sessao_id]).filter(Boolean);
    const hasDuplicates=new Set(batchSelected).size!==batchSelected.length;
    const doneSessions=pSessions.filter(x=>x.status==='agendada'&&x.checado_em).length;
    const activeSessions=pSessions.filter(x=>x.status==='agendada').length;
    const sessionProgress=activeSessions?Math.round(doneSessions/activeSessions*100):0;
    const consumedInSessions=pSessions.filter(x=>x.status==='agendada'&&x.checado_em).reduce((sum,x)=>sum+Number(sessionCosts[x.sessao_id]?.custo_medicamentos||0)+Number(sessionCosts[x.sessao_id]?.custo_insumos||0),0);
    const sessionMissingCosts=pSessions.reduce((sum,x)=>sum+Number(sessionCosts[x.sessao_id]?.saidas_sem_custo||0),0);
    const openSessions=pSessions.filter(x=>x.status==='agendada'&&!x.checado_em).length;
    return <div className="form-section protocol-entry" key={p.protocolo_id}>
     <div className="administration-heading"><strong>{p.nome}</strong><span>{p.status==='ativo'?'Ativo':p.status}</span></div>
     <p>Paciente: <strong>{p.paciente_nome}</strong> · Início: {dateBR(p.inicio)} · Duração: {p.duracao_dias} dias</p>
     {savedPricing[p.protocolo_id]&&<p className="profile-notice">Tabela: {money(savedPricing[p.protocolo_id].valor_tabela)} · Valor acordado: {money(savedPricing[p.protocolo_id].valor_acordado)} · {savedPricing[p.protocolo_id].parcelas}x · Taxa InfinitePay simulada: {ratePct(Number(savedPricing[p.protocolo_id].taxa_infinitepay))} · Total a cobrar: {money(savedPricing[p.protocolo_id].total_cobrado)}. Conta financeira ainda deve ser gerada no módulo Financeiro.</p>}
     <div className="inventory-report-metrics">
      <div><small>Valor cobrado (não equivale a recebido)</small><strong>{money(priceTotal)}</strong></div>
      <div><small>Repasse à clínica ({formatPercentage(p.percentual_clinica)}%)</small><strong>{money(clinicValue)}</strong></div>
      <div><small>Custo conhecido dos medicamentos baixados</small><strong>{money(cost)}</strong></div>
      <div><small>Custo conhecido dos insumos baixados</small><strong>{money(suppliesCost)}</strong></div>
      <div><small>Total de custos conhecidos</small><strong>{money(totalKnown)}</strong></div>
      <div><small>Saldo após custos conhecidos (parcial)</small><strong>{money(contribution)}</strong></div>
      <div><small>Margem parcial</small><strong>{canShowMargin?margin.toFixed(1).replace('.',',')+'%':'Aguardando custos'}</strong></div>
     </div>
     <div className="protocol-forecast">
      <h4>Previsão de custos pendentes (teste)</h4>
      <p>Estimativa dos medicamentos e insumos já associados aos itens de prescrição ainda não checados, usando o custo médio dos lotes válidos com saldo. Não reserva estoque nem prevê aplicações futuras não cadastradas.</p>
      <div className="inventory-report-metrics">
       <div><small>Medicamentos ainda não aplicados</small><strong>{money(pendingMed)}</strong></div>
       <div><small>Insumos ainda não utilizados</small><strong>{money(pendingSup)}</strong></div>
       <div><small>Custo total conhecido + previsto</small><strong>{money(totalForecast)}</strong></div>
       <div><small>Saldo projetado sobre custos conhecidos e previstos</small><strong>{money(futureBalance)}</strong></div>
       <div><small>Margem projetada</small><strong>{forecastComplete&&priceTotal>0?((futureBalance/priceTotal)*100).toFixed(1).replace('.',',')+'%':'Previsão incompleta'}</strong></div>
      </div>
      {forecastGaps>0&&<p className="form-message">Previsão incompleta: {f.itens_sem_vinculo_estoque||0} item(ns) sem medicamento vinculado ao estoque, {f.linhas_sem_preco||0} linha(s) sem preço conhecido e {f.linhas_sem_saldo_suficiente||0} linha(s) sem saldo válido suficiente. Os custos ausentes não são tratados como zero.</p>}
      {!forecastGaps&&Number(f.itens_pendentes||0)===0&&<p>Não há itens prescritos pendentes de checagem. Isso não significa que o tratamento esteja concluído.</p>}
     </div>
     <p>Prescrições vinculadas: {p.prescricoes_vinculadas} · Itens prescritos: {p.itens_prescritos} · Checagens com saída: {p.checagens_registradas} · Medicamentos consumidos: {p.quantidade_saida} · Insumos consumidos (quantidades mistas): {p.quantidade_insumos}</p>
     {noDischarge&&<p className="form-message">As prescrições estão vinculadas, mas nenhuma baixa de estoque foi registrada para elas. Prescrever ou vincular não desconta estoque nem gera custo consumido. A margem ainda não pode ser avaliada.</p>}
     {Number(p.checagens_sem_baixa||0)>0&&<p className="form-message">Há {p.checagens_sem_baixa} checagem(ns) sem baixa vinculada de estoque. Verifique se pertencem a registros antigos.</p>}
     <div className="protocol-link-row"><label>Porcentagem cobrada pela clínica (%)
       <input inputMode="decimal" value={clinicEdits[p.protocolo_id]??'0'} onChange={e=>setClinicEdits(v=>({...v,[p.protocolo_id]:e.target.value.replace(/[^\d,.]/g,'').slice(0,6)}))}/>
      </label><label>Valor descontado da clínica (R$) — automático
       <input readOnly value={money(clinicAmount(Math.round(priceTotal*100),clinicEdits[p.protocolo_id]))}/>
      </label><button className="outline-gold" type="button" disabled={Boolean(clinicBusy)||!validPercentage(clinicEdits[p.protocolo_id])||parsePercentage(clinicEdits[p.protocolo_id])===Number(p.percentual_clinica||0)} onClick={()=>saveClinic(p)}>{clinicBusy===p.protocolo_id?'Salvando...':'Salvar porcentagem'}</button>
     </div>
     {supplyMissing>0&&<p className="form-message">Atenção: {supplyMissing} saída(s) de insumos sem custo informado. Resultado incompleto.</p>}
     {missing>0&&<p className="form-message">Atenção: {missing} baixa(s) não possuem custo informado. O custo total e a margem estão incompletos.</p>}
     <div className="protocol-link-row"><label>Vincular prescrição do mesmo paciente
      <select value={selectedRx[p.protocolo_id]||''} onChange={e=>setSelectedRx(o=>({...o,[p.protocolo_id]:e.target.value}))}>
       <option value="">Selecione uma prescrição não vinculada</option>
       {options.map(r=><option key={r.prescricao_id} value={r.prescricao_id}>{dateBR(r.criado_em)} · {r.prescricao_id.slice(0,8)}</option>)}
      </select>
     </label><button type="button" className="outline-gold" disabled={busy||!selectedRx[p.protocolo_id]} onClick={()=>link(p)}>Vincular prescrição</button></div>
     <div className="protocol-sessions">
      <h4>Sessões do protocolo — planejamento fictício</h4>
      <p>Agendar não comprova aplicação nem baixa estoque. Somente sessões com item prescrito vinculado e checagem real no módulo de testes aparecem como “Checagem confirmada”.</p>
      <div className="protocol-session-progress"><div><strong>Progresso de checagens vinculadas</strong><span>{doneSessions} de {activeSessions} sessões ativas · {sessionProgress}%</span></div><progress max="100" value={sessionProgress} aria-label="Percentual de sessões com checagem registrada"/><small>Conta apenas sessões ativas com item prescrito e checagem registrada; não certifica a conclusão clínica do tratamento.</small></div>
      <div className="inventory-report-metrics">
       <div><small>Custos consumidos nas sessões vinculadas</small><strong>{money(consumedInSessions)}</strong></div>
       <div><small>Sessões agendadas, sem checagem</small><strong>{openSessions}</strong></div>
       <div><small>Sessões com checagem associada</small><strong>{doneSessions}</strong></div>
       <div><small>Sessões canceladas</small><strong>{pSessions.filter(x=>x.status==='cancelada').length}</strong></div>
      </div>
      {p.status==='ativo'&&availableSessions.length>0&&pOptions.length>0&&<div className="protocol-batch-links">
       <h4>Vincular várias sessões de uma vez</h4>
       <p>Selecione o item prescrito correspondente em cada data. Verifique cuidadosamente medicamento, dose e sessão antes de confirmar. Cada item pode ser usado somente uma vez.</p>
       <div className="protocol-batch-grid">
        {availableSessions.slice(0,50).map(sess=><label key={sess.sessao_id}>
         <strong>{dateBR(sess.data_prevista)} · {sess.descricao}</strong>
         <select value={batchSelection[sess.sessao_id]||''} onChange={e=>updateBatchLink(p.protocolo_id,sess.sessao_id,e.target.value)}>
          <option value="">Não vincular esta sessão</option>
          {pOptions.map(it=><option key={it.item_id} value={it.item_id}>{it.medicamento} · {it.item_id.slice(0,8)}</option>)}
         </select>
        </label>)}
       </div>
       {availableSessions.length>50&&<p>Exibindo somente 50 sessões por operação.</p>}
       {hasDuplicates&&<p className="form-message">Há um mesmo item selecionado em mais de uma sessão. Corrija antes de salvar.</p>}
       <button type="button" className="gold-button" disabled={Boolean(sessionBusy)||!batchSelected.length||hasDuplicates} onClick={()=>linkBatch(p)}>
         {sessionBusy===p.protocolo_id?'Vinculando...':'Confirmar '+batchSelected.length+' vínculo(s)'}
       </button>
      </div>}
      {sessionMissingCosts>0&&<p className="form-message">Há {sessionMissingCosts} movimentação(ões) associada(s) a sessões sem preço de aquisição conhecido. Os custos por sessão estão incompletos.</p>}
      {pSessions.length>0?<div className="record-list">{pSessions.map(sess=><div className="protocol-session-line" key={sess.sessao_id}>
       <div><strong>{dateBR(sess.data_prevista)} · {sess.descricao}</strong>
        <p>{sess.status==='cancelada'?'Cancelada':sess.checado_em?'Checagem associada registrada':'Agendada — pendente de checagem'}{sess.medicamento?' · '+sess.medicamento:' · sem item prescrito associado'}</p>
        {sess.checado_em&&<p>Checagem: {new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(sess.checado_em))}</p>}
        {sess.checado_em&&<p>Medicamentos consumidos: {money(sessionCosts[sess.sessao_id]?.custo_medicamentos)} · Insumos consumidos: {money(sessionCosts[sess.sessao_id]?.custo_insumos)}</p>}
        {Number(sessionCosts[sess.sessao_id]?.saidas_sem_custo||0)>0&&<p className="form-message">Custos incompletos nesta sessão: existem saídas sem preço conhecido.</p>}
        {sess.observacao&&<small>{sess.observacao}</small>}
       </div>
       {sess.status==='agendada'&&!sess.checado_em&&<div className="session-bind-actions">
        {!sess.item_prescricao_id&&<label>Associar item prescrito
         <select value={sessionLinkDraft[sess.sessao_id]||''} onChange={e=>setSessionLinkDraft(old=>({...old,[sess.sessao_id]:e.target.value}))}>
          <option value="">Selecione item ainda pendente</option>
          {pOptions.map(it=><option key={it.item_id} value={it.item_id}>{it.medicamento} · {it.item_id.slice(0,8)}</option>)}
         </select>
        </label>}
        {!sess.item_prescricao_id&&<button type="button" className="gold-button" disabled={Boolean(sessionBusy)||!sessionLinkDraft[sess.sessao_id]} onClick={()=>bindSession(sess,p)}>Vincular item</button>}
        <button type="button" className="outline-gold" disabled={Boolean(sessionBusy)} onClick={()=>cancelSession(sess)}>Cancelar</button>
       </div>}
      </div>)}</div>:<p>Nenhuma sessão fictícia agendada.</p>}
      {p.status==='ativo'&&<div className="protocol-recurrence">
       <h4>Gerar calendário recorrente</h4>
       <p>Planejamento administrativo, sem checagem, prescrição ou baixa de estoque. As datas precisam caber no período do protocolo.</p>
       <div className="protocol-session-form">
        <label>Primeira sessão<input type="date" value={recurrence[p.protocolo_id]?.date||''} min={p.inicio} onChange={e=>updateRecurrence(p.protocolo_id,'date',e.target.value)}/></label>
        <label>Intervalo<select value={recurrence[p.protocolo_id]?.interval||'7'} onChange={e=>updateRecurrence(p.protocolo_id,'interval',e.target.value)}>
          <option value="7">Semanal (7 dias)</option>
          <option value="14">Quinzenal (14 dias)</option>
          <option value="30">A cada 30 dias</option>
          <option value="1">Diário (simulação)</option>
         </select></label>
        <label>Número de sessões<input type="number" min="1" max="52" step="1" value={recurrence[p.protocolo_id]?.count||'4'} onChange={e=>updateRecurrence(p.protocolo_id,'count',e.target.value)}/></label>
        <label>Descrição da agenda<input maxLength={125} placeholder="Ex.: Atendimento do protocolo" value={recurrence[p.protocolo_id]?.description||''} onChange={e=>updateRecurrence(p.protocolo_id,'description',e.target.value)}/></label>
        <button type="button" className="gold-button" disabled={Boolean(sessionBusy)||!recurrence[p.protocolo_id]?.date||!recurrence[p.protocolo_id]?.description?.trim()} onClick={()=>generateRecurring(p)}>
         {sessionBusy===p.protocolo_id?'Gerando...':'Gerar sessões'}
        </button>
       </div>
       {recurrenceDates(recurrence[p.protocolo_id]||{}).length>0&&
        <p>Prévia: {recurrenceDates(recurrence[p.protocolo_id]||{}).map(dateBR).join(' · ')}</p>}
      </div>}
      {p.status==='ativo'&&<div className="protocol-session-form">
       <label>Data prevista<input type="date" value={sessionForm[p.protocolo_id]?.date||''} onChange={e=>updateSession(p.protocolo_id,'date',e.target.value)}/></label>
       <label>Descrição da sessão<input maxLength={160} placeholder="Ex.: Aplicação 1 — teste" value={sessionForm[p.protocolo_id]?.description||''} onChange={e=>updateSession(p.protocolo_id,'description',e.target.value)}/></label>
       <label>Item prescrito (opcional)<select value={sessionForm[p.protocolo_id]?.item||''} onChange={e=>updateSession(p.protocolo_id,'item',e.target.value)}>
        <option value="">Sem vínculo; apenas agendamento</option>
        {pOptions.map(it=><option key={it.item_id} value={it.item_id}>{it.medicamento} · {it.item_id.slice(0,8)}</option>)}
       </select></label>
       <label>Observação<input maxLength={1000} placeholder="Opcional" value={sessionForm[p.protocolo_id]?.note||''} onChange={e=>updateSession(p.protocolo_id,'note',e.target.value)}/></label>
       <button className="gold-button" type="button" disabled={Boolean(sessionBusy)||!sessionForm[p.protocolo_id]?.date||!sessionForm[p.protocolo_id]?.description?.trim()} onClick={()=>addSession(p)}>{sessionBusy===p.protocolo_id?'Agendando...':'Agendar sessão'}</button>
      </div>}
     </div>
     <p className="muted">O cálculo utiliza baixas registradas das prescrições vinculadas. Aplicações futuras ainda não prescritas, preço efetivamente recebido e saldo reservado por produto serão integrados em etapas posteriores.</p>
    </div>;
   })}
  </div>}
 </section>;
}