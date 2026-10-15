import React,{useEffect,useState} from 'react';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const dateBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const today=()=>new Date().toISOString().slice(0,10);
export default function TestProtocols({supabase}){
 const [protocols,setProtocols]=useState([]),[patients,setPatients]=useState([]),[rxs,setRxs]=useState([]);
 const [patient,setPatient]=useState(''),[name,setName]=useState(''),[start,setStart]=useState(today());
 const [duration,setDuration]=useState('90'),[days,setDays]=useState('90'),[price,setPrice]=useState('');
 const [selectedRx,setSelectedRx]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  const [p,pa,rx]=await Promise.all([
   supabase.rpc('listar_protocolos_teste'),
   supabase.from('pacientes').select('id,nome').order('nome').limit(300),
   supabase.rpc('listar_prescricoes_para_protocolos_teste')
  ]);
  if(p.error||pa.error||rx.error)setError('Não foi possível carregar protocolos: '+(p.error||pa.error||rx.error).message);
  else{setProtocols(p.data||[]);setPatients(pa.data||[]);setRxs(rx.data||[]);}
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
  setBusy(true);
  const {error:err}=await supabase.rpc('criar_protocolo_teste',{
   p_paciente_id:patient,p_nome:name.trim(),p_inicio:start,p_duracao_dias:effectiveDays,p_preco_cobrado:Number(price)/100
  });
  if(err)setError('Falha ao cadastrar protocolo: '+err.message);
  else{setMessage('Protocolo fictício criado. Agora vincule as prescrições correspondentes.');setName('');setPrice('');await load();}
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
 return <section className="premium-panel protocols-test">
  <div className="panel-title"><span className="title-icon">◈</span><div><h3>Protocolos de tratamento — Teste</h3><p>Planejamento de tratamento e estimativa financeira dos medicamentos efetivamente consumidos.</p></div></div>
  <p className="profile-notice">Exclusivo ao perfil médico no protótipo, somente pacientes fictícios. O resultado abaixo é contribuição bruta estimada com base nos custos conhecidos de medicamentos; NÃO representa lucro líquido. Não inclui impostos, salários, materiais, taxas, infraestrutura ou aplicações futuras. Cada checagem de item prescrito é única nesta versão; não é um controle completo de sessões recorrentes.</p>
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
    <label>Valor cobrado (R$)<input required inputMode="numeric" placeholder="0,00" value={(Number(price||0)/100).toFixed(2).replace('.',',')} onChange={e=>setPrice(e.target.value.replace(/\D/g,'').slice(0,11))}/><small>Digite os números; os dois últimos são centavos.</small></label>
   </div>
   <div className="form-actions"><button className="gold-button" disabled={busy}>{busy?'Salvando...':'Cadastrar protocolo'}</button></div>
  </form>
  <div className="record-top"><h4>Protocolos cadastrados</h4><button type="button" className="outline-gold" disabled={loading||busy} onClick={load}>Atualizar</button></div>
  {loading?<p>Carregando...</p>:protocols.length===0?<p className="record-empty">Ainda não existem protocolos fictícios.</p>:<div className="record-list">
   {protocols.map(p=>{
    const cost=Number(p.custo_conhecido||0),priceTotal=Number(p.preco_cobrado||0),missing=Number(p.saidas_sem_custo||0);
    const contribution=priceTotal-cost,margin=priceTotal>0?contribution/priceTotal*100:null;
    const options=rxs.filter(r=>r.paciente_id===p.paciente_id&&!r.protocolo_id);
    return <div className="form-section protocol-entry" key={p.protocolo_id}>
     <div className="administration-heading"><strong>{p.nome}</strong><span>{p.status==='ativo'?'Ativo':p.status}</span></div>
     <p>Paciente: <strong>{p.paciente_nome}</strong> · Início: {dateBR(p.inicio)} · Duração: {p.duracao_dias} dias</p>
     <div className="inventory-report-metrics">
      <div><small>Valor cobrado</small><strong>{money(priceTotal)}</strong></div>
      <div><small>Custo conhecido consumido</small><strong>{money(cost)}</strong></div>
      <div><small>Contribuição bruta parcial</small><strong>{missing?'Incompleta':money(contribution)}</strong></div>
      <div><small>Margem sobre custos conhecidos</small><strong>{missing?'Incompleta':margin===null?'N/D':margin.toFixed(1).replace('.',',')+'%'}</strong></div>
     </div>
     <p>Prescrições vinculadas: {p.prescricoes_vinculadas} · Checagens com saída: {p.checagens_registradas} · Quantidade consumida: {p.quantidade_saida}</p>
     {missing>0&&<p className="form-message">Atenção: {missing} baixa(s) não possuem custo informado. O custo total e a margem estão incompletos.</p>}
     <div className="protocol-link-row"><label>Vincular prescrição do mesmo paciente
      <select value={selectedRx[p.protocolo_id]||''} onChange={e=>setSelectedRx(o=>({...o,[p.protocolo_id]:e.target.value}))}>
       <option value="">Selecione uma prescrição não vinculada</option>
       {options.map(r=><option key={r.prescricao_id} value={r.prescricao_id}>{dateBR(r.criado_em)} · {r.prescricao_id.slice(0,8)}</option>)}
      </select>
     </label><button type="button" className="outline-gold" disabled={busy||!selectedRx[p.protocolo_id]} onClick={()=>link(p)}>Vincular prescrição</button></div>
     <p className="muted">O cálculo utiliza baixas registradas das prescrições vinculadas. Sessões futuras, preço efetivamente recebido e saldo por produto serão integrados em etapas posteriores.</p>
    </div>;
   })}
  </div>}
 </section>;
}