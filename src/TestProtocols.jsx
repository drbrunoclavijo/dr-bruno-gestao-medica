import React,{useEffect,useState} from 'react';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const dateBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const today=()=>new Date().toISOString().slice(0,10);
const parseCents=s=>Number(s||'0')/100;
const currencyInput=s=>(Number(s||'0')/100).toFixed(2).replace('.',',');
const parsePercentage=v=>Number(String(v||'0').replace(',','.'));
const formatPercentage=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:2});
const validPercentage=v=>/^\d{1,3}([.,]\d{1,2})?$/.test(String(v||'0'))&&parsePercentage(v)>=0&&parsePercentage(v)<=100;
const clinicAmount=(priceCents,rate)=>Math.round(Number(priceCents||0)*parsePercentage(rate)/100)/100;
export default function TestProtocols({supabase}){
 const [protocols,setProtocols]=useState([]),[patients,setPatients]=useState([]),[rxs,setRxs]=useState([]);
 const [patient,setPatient]=useState(''),[name,setName]=useState(''),[start,setStart]=useState(today());
 const [duration,setDuration]=useState('90'),[days,setDays]=useState('90'),[price,setPrice]=useState(''),[clinic,setClinic]=useState('');
 const [clinicEdits,setClinicEdits]=useState({}),[clinicBusy,setClinicBusy]=useState('');
 const [selectedRx,setSelectedRx]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [forecasts,setForecasts]=useState({});
 const [sessions,setSessions]=useState([]),[sessionItems,setSessionItems]=useState([]),[sessionForm,setSessionForm]=useState({}),[sessionBusy,setSessionBusy]=useState('');
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  const [p,pa,rx,estimates,sessionList,sessionOptions]=await Promise.all([
   supabase.rpc('listar_protocolos_com_insumos_teste'),
   supabase.from('pacientes').select('id,nome').order('nome').limit(300),
   supabase.rpc('listar_prescricoes_para_protocolos_teste'),
   supabase.rpc('previsao_custos_protocolos_teste'),
   supabase.rpc('listar_sessoes_protocolos_teste'),
   supabase.rpc('itens_sessoes_protocolos_teste')
  ]);
  if(p.error||pa.error||rx.error||estimates.error||sessionList.error||sessionOptions.error)setError('Não foi possível carregar protocolos: '+(p.error||pa.error||rx.error||estimates.error||sessionList.error||sessionOptions.error).message);
  else{setProtocols(p.data||[]);setPatients(pa.data||[]);setRxs(rx.data||[]);setForecasts(Object.fromEntries((estimates.data||[]).map(x=>[x.protocolo_id,x])));setSessions(sessionList.data||[]);setSessionItems(sessionOptions.data||[]);setClinicEdits(Object.fromEntries((p.data||[]).map(x=>[x.protocolo_id,formatPercentage(x.percentual_clinica)])));}
  setLoading(false);
 }
 useEffect(()=>{load()},[]);
 async function create(e){
  e.preventDefault();setError('');setMessage('');
  const effectiveDays=duration==='custom'?Number(days):Number(duration);
  if(!patient||!name.trim()||!start||!Number.isInteger(effectiveDays)||effectiveDays<1||effectiveDays>730){
   setError('Preencha paciente, nome, início e duração válida (1 a 730 dias).');return;
  }
  if(!/^\d+$/.test(price)||Number(price)<0){setError('Informe o valor total em reais.');return;}
  if(!validPercentage(clinic)){setError('Informe uma porcentagem entre 0 e 100, com até duas casas decimais.');return;}
  setBusy(true);
  const {error:err}=await supabase.rpc('criar_protocolo_com_percentual_teste',{
   p_paciente_id:patient,p_nome:name.trim(),p_inicio:start,p_duracao_dias:effectiveDays,p_preco_cobrado:parseCents(price),p_percentual_clinica:parsePercentage(clinic)
  });
  if(err)setError('Falha ao cadastrar protocolo: '+err.message);
  else{setMessage('Protocolo fictício criado. Agora vincule as prescrições correspondentes.');setName('');setPrice('');setClinic('');await load();}
  setBusy(false);
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
   <h4>+ Criar protocolo fictício</h4>
   <div className="clinical-fields">
    <label>Paciente<select required value={patient} onChange={e=>setPatient(e.target.value)}><option value="">Selecione o paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label>Nome do protocolo<input required maxLength={160} placeholder="Ex.: Performance 90 - teste" value={name} onChange={e=>setName(e.target.value)}/></label>
    <label>Data de início<input required type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>Duração<select value={duration} onChange={e=>setDuration(e.target.value)}><option value="45">45 dias</option><option value="90">3 meses (90 dias)</option><option value="180">6 meses (180 dias)</option><option value="custom">Personalizada</option></select></label>
    {duration==='custom'&&<label>Duração em dias<input type="number" min="1" max="730" required value={days} onChange={e=>setDays(e.target.value)}/></label>}
    <label>Valor cobrado (R$)<input required inputMode="numeric" placeholder="0,00" value={currencyInput(price)} onChange={e=>setPrice(e.target.value.replace(/\D/g,'').slice(0,11))}/><small>Digite os números; os dois últimos são centavos.</small></label>
    <label>Porcentagem cobrada pela clínica (%)<input inputMode="decimal" placeholder="Ex.: 20" value={clinic} onChange={e=>setClinic(e.target.value.replace(/[^\d,.]/g,'').slice(0,6))}/><small>Você informa o percentual: por exemplo, 20 para 20%.</small></label>
    <label>Repasse calculado à clínica (R$)<input readOnly value={money(clinicAmount(price,clinic))}/><small>Calculado automaticamente e descontado do saldo do protocolo.</small></label>
   </div>
   <div className="form-actions"><button className="gold-button" disabled={busy}>{busy?'Salvando...':'Cadastrar protocolo'}</button></div>
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
    const doneSessions=pSessions.filter(x=>x.status==='agendada'&&x.checado_em).length;
    const openSessions=pSessions.filter(x=>x.status==='agendada'&&!x.checado_em).length;
    return <div className="form-section protocol-entry" key={p.protocolo_id}>
     <div className="administration-heading"><strong>{p.nome}</strong><span>{p.status==='ativo'?'Ativo':p.status}</span></div>
     <p>Paciente: <strong>{p.paciente_nome}</strong> · Início: {dateBR(p.inicio)} · Duração: {p.duracao_dias} dias</p>
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
      <div className="inventory-report-metrics">
       <div><small>Sessões agendadas, sem checagem</small><strong>{openSessions}</strong></div>
       <div><small>Sessões com checagem associada</small><strong>{doneSessions}</strong></div>
       <div><small>Sessões canceladas</small><strong>{pSessions.filter(x=>x.status==='cancelada').length}</strong></div>
      </div>
      {pSessions.length>0?<div className="record-list">{pSessions.map(sess=><div className="protocol-session-line" key={sess.sessao_id}>
       <div><strong>{dateBR(sess.data_prevista)} · {sess.descricao}</strong>
        <p>{sess.status==='cancelada'?'Cancelada':sess.checado_em?'Checagem associada registrada':'Agendada — pendente de checagem'}{sess.medicamento?' · '+sess.medicamento:' · sem item prescrito associado'}</p>
        {sess.observacao&&<small>{sess.observacao}</small>}
       </div>
       {sess.status==='agendada'&&!sess.checado_em&&<button type="button" className="outline-gold" disabled={Boolean(sessionBusy)} onClick={()=>cancelSession(sess)}>Cancelar</button>}
      </div>)}</div>:<p>Nenhuma sessão fictícia agendada.</p>}
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