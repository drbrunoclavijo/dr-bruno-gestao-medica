import React,{useEffect,useState} from 'react';
import {paymentNames,rateForPayment,ratePct,tiers,quoteInfinity} from './PaymentRates.js';
const money=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const digits=v=>String(v||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,9);
const dateBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const today=()=>{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return o.year+'-'+o.month+'-'+o.day;};
export default function CarolProcedures({supabase}){
 const [patients,setPatients]=useState([]),[records,setRecords]=useState([]),[loading,setLoading]=useState(true),
 [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [patient,setPatient]=useState(''),[name,setName]=useState(''),[details,setDetails]=useState(''),
 [date,setDate]=useState(today()),[price,setPrice]=useState(''),[method,setMethod]=useState('credito'),
 [installments,setInstallments]=useState('1'),[brand,setBrand]=useState('visa'),[tier,setTier]=useState('inicial'),
 [plan,setPlan]=useState('dia');
 async function load(){
  setLoading(true);
  const [p,r]=await Promise.all([
   supabase.from('pacientes').select('id,nome').order('nome').limit(300),
   supabase.rpc('listar_procedimentos_carol_teste')
  ]);
  if(p.error||r.error)setError('Cadastro de procedimentos indisponível: '+(p.error||r.error).message+'. Execute a nova migração SQL.');
  else{setPatients(p.data||[]);setRecords(r.data||[]);setError('');}
  setLoading(false);
 }
 useEffect(()=>{load();},[]);
 const count=method==='credito'?Number(installments):1;
 const quote=quoteInfinity(Number(price||0)/100,count,brand,tier,plan,method);
 async function submit(e){
  e.preventDefault();setError('');setNotice('');
  if(!patient||name.trim().length<3||!quote||quote.perInstallment<0.01){
   setError('Preencha paciente, descrição, valor e forma de pagamento válidos.');return;
  }
  if(!window.confirm('Registrar o procedimento fictício '+name.trim()+'? A operação NÃO registra cobrança ou pagamento real.'))return;
  setBusy(true);
  try{
   const {error:err}=await supabase.rpc('criar_procedimento_carol_teste',{
    p_paciente_id:patient,p_descricao:name.trim(),p_detalhes:details.trim()||null,p_data_prevista:date,
    p_valor_acordado:Number(price)/100,p_total_cobrado:quote.gross,p_forma:method,
    p_parcelas:count,p_taxa:quote.rate,p_taxa_valor:quote.fee,p_liquido:quote.net
   });
   if(err)throw err;
   setName('');setDetails('');setPrice('');setPatient('');await load();
   setNotice('Procedimento fictício registrado somente no perfil da Dra. Carol, com desconto da maquininha estimado.');
  }catch(err){setError('Falha no registro: '+err.message);}
  finally{setBusy(false);}
 }
 return <section className="premium-panel carol-procedures">
  <div className="panel-title"><span className="title-icon">✧</span><div>
   <h3>Meus procedimentos — Dra. Carol Klaus</h3>
   <p>Cadastro independente dos protocolos do Dr. Bruno.</p>
  </div></div>
  <p className="profile-notice">O catálogo da Dra. Carol começa vazio: escreva o procedimento e a descrição livremente. Os valores são definidos por atendimento, sem tabelas pré-preenchidas. Esta área registra simulações, não aplica medicamentos e não confirma recebimentos.</p>
  {error&&<p role="alert" className="form-message">{error}</p>}
  {notice&&<p role="status" className="form-message">{notice}</p>}
  <form className="clinical-fields" onSubmit={submit}>
   <label>Paciente<select required value={patient} onChange={e=>setPatient(e.target.value)}>
    <option value="">Selecione o paciente fictício</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
   <label>Procedimento (preenchimento livre)<input required minLength={3} maxLength={160} value={name} onChange={e=>setName(e.target.value)} placeholder="Descreva o nome do procedimento"/></label>
   <label>Descrição e detalhes<textarea rows={2} maxLength={1000} value={details} onChange={e=>setDetails(e.target.value)} placeholder="Descreva o atendimento, sem informações clínicas sensíveis"/></label>
   <label>Data prevista<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
   <label>Valor a pagar (R$)<input required inputMode="numeric" autoComplete="off" placeholder="R$ 0,00" value={price?money(Number(price)/100):''} onChange={e=>setPrice(digits(e.target.value))}/></label>
   <label>Forma de pagamento<select value={method} onChange={e=>{setMethod(e.target.value);setInstallments('1');}}>
    {Object.entries(paymentNames).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   {(method==='credito'||method==='debito')&&<>
    <label>Bandeira<select value={brand} onChange={e=>setBrand(e.target.value)}>
     <option value="visa">Visa / Mastercard</option><option value="outras">Elo / Amex / Hipercard</option></select></label>
    <label>Faturamento mensal<select value={tier} disabled={plan==='hora'} onChange={e=>setTier(e.target.value)}>
     {Object.entries(tiers).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Recebimento<select value={plan} onChange={e=>setPlan(e.target.value)}>
     <option value="dia">Em 1 dia útil</option><option value="hora">Na hora</option></select></label>
   </>}
   {method==='credito'&&<label>Parcelamento Máquina InfinitePay<select value={installments} onChange={e=>setInstallments(e.target.value)}>
    {Array.from({length:12},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x — taxa {ratePct(rateForPayment('credito',n,brand,tier,plan))}{n<=6?' (clínica absorve)':' (repasse simulado)'}</option>)}</select></label>}
   <label>Taxa da maquininha<input readOnly value={quote?ratePct(quote.rate):'—'}/></label>
   <label>Valor total a cobrar<input readOnly value={money(quote?.gross||0)}/></label>
   <label>Taxa descontada da clínica<input readOnly value={money(quote?.fee||0)}/></label>
   <label>Líquido estimado<input readOnly value={money(quote?.net||0)}/></label>
   <div className="form-actions"><button disabled={busy||loading||!quote} className="gold-button">Salvar procedimento fictício</button></div>
  </form>
  <div className="record-top"><h4>Procedimentos cadastrados por mim</h4><button type="button" className="outline-gold" disabled={loading||busy} onClick={load}>Atualizar</button></div>
  {loading?<p>Carregando...</p>:records.length===0?<p className="record-empty">Nenhum procedimento cadastrado. Preencha os dados acima.</p>:
   <div className="record-list">{records.map(r=><div className="form-section" key={r.id}>
    <strong>{r.descricao}</strong><p>{r.paciente_nome} · {dateBR(r.data_prevista)}</p>
    {r.detalhes&&<p>{r.detalhes}</p>}
    <p>Valor: {money(r.valor_acordado)} · {paymentNames[r.forma_pagamento]} · {r.parcelas}x</p>
    <p>Taxa: {ratePct(Number(r.taxa_percentual))} / {money(r.taxa_valor)} · Líquido estimado: <strong>{money(r.liquido_estimado)}</strong></p>
   </div>)}</div>}
  <p className="profile-notice">As taxas de cartão são estimadas com base na tabela pública InfinitePay e variam conforme o plano da clínica. Pix no QR Code da InfinitePay é 0%. Valores líquidos não substituem o extrato da operadora.</p>
 </section>;
}
