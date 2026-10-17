import React,{useEffect,useMemo,useState} from 'react';
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const ptDate=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const today=()=>{const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(d.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
const monthNames=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const forms={pix:'Pix',cartao_credito:'Cartão de crédito',cartao_debito:'Cartão de débito',dinheiro:'Dinheiro',transferencia:'Transferência',outro:'Outro'};
// Valor dos formulários armazenado como dígitos de centavos, sem ambiguidades de separador.
const currencyDigits=v=>String(v||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,9);
const currencyDisplay=v=>v?brl(Number(v)/100):'';
const amount=v=>v&&/^\d{1,9}$/.test(v)?Number(v)/100:NaN;
export default function Receivables({supabase}){
 const [rows,setRows]=useState([]),[patients,setPatients]=useState([]),[protocols,setProtocols]=useState([]),
  [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [patient,setPatient]=useState(''),[protocol,setProtocol]=useState(''),[description,setDescription]=useState(''),
  [total,setTotal]=useState(''),[due,setDue]=useState(today()),[installmentCount,setInstallmentCount]=useState('1');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('abertas');
 const [payAccount,setPayAccount]=useState(null),[payAmount,setPayAmount]=useState(''),[payForm,setPayForm]=useState('pix'),
  [payInstallments,setPayInstallments]=useState('1'),[payDate,setPayDate]=useState(today()),[payReference,setPayReference]=useState('');
 const [details,setDetails]=useState({});
 const [installments,setInstallments]=useState([]),[monthly,setMonthly]=useState([]),[reportYear,setReportYear]=useState(Number(today().slice(0,4)));
 async function load(){
  setLoading(true);setError('');
  const [a,p,pr,ins,report]=await Promise.all([
   supabase.rpc('listar_contas_receber_teste'),
   supabase.from('pacientes').select('id,nome').order('nome').limit(300),
   supabase.rpc('listar_protocolos_com_insumos_teste'),
   supabase.rpc('listar_parcelas_receber_teste'),
   supabase.rpc('resumo_financeiro_mensal_teste',{p_ano:reportYear})
  ]);
  if(a.error||p.error||pr.error||ins.error||report.error)setError('Não foi possível carregar o financeiro: '+(a.error||p.error||pr.error||ins.error||report.error).message+'. Verifique a migração de parcelamento e resumo mensal.');
  else{setRows(a.data||[]);setPatients(p.data||[]);setProtocols(pr.data||[]);setInstallments(ins.data||[]);setMonthly(report.data||[]);}
  setLoading(false);
 }
 useEffect(()=>{load();},[reportYear]);
 const t=today();
 const all=rows.filter(x=>x.status==='aberta');
 const pending=all.reduce((sum,x)=>sum+Number(x.saldo_pendente||0),0);
 const received=rows.reduce((sum,x)=>sum+Number(x.total_pago||0),0);
 const overdueInstallments=installments.filter(x=>x.vencimento<t&&Number(x.saldo)>0.001&&all.some(a=>a.conta_id===x.conta_id));
 const overdue=all.filter(x=>overdueInstallments.some(p=>p.conta_id===x.conta_id));
 const open=all.filter(x=>Number(x.saldo_pendente)>0.001);
 const paid=all.filter(x=>Number(x.saldo_pendente)<0.001);
 const shown=rows.filter(x=>{
  if(filter==='abertas'&&!(x.status==='aberta'&&Number(x.saldo_pendente)>0.001))return false;
  if(filter==='vencidas'&&!(x.status==='aberta'&&overdue.some(p=>p.conta_id===x.conta_id)))return false;
  if(filter==='quitadas'&&!(x.status==='aberta'&&Number(x.saldo_pendente)<0.001))return false;
  if(filter==='canceladas'&&x.status!=='cancelada')return false;
  return [x.paciente_nome,x.descricao,x.protocolo_nome].some(s=>String(s||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')));
 });
 async function create(e){
  e.preventDefault();setError('');setNotice('');
  const value=amount(total);
  const count=Number(installmentCount);
  if(!patient||!description.trim()||!due||!Number.isFinite(value)||value<=0||!Number.isInteger(count)||count<1||count>36||Math.round(value*100)<count){setError('Confira paciente, descrição, valor, data e parcelas. O valor mínimo de cada parcela é R$ 0,01.');return;}
  if(!window.confirm('Criar conta fictícia de '+brl(value)+' em '+count+' parcela(s) para '+patients.find(p=>p.id===patient)?.nome+'? O primeiro vencimento será '+ptDate(due)+'. Nenhuma cobrança será enviada.'))return;
  setBusy(true);
  try{
   const {error:err}=await supabase.rpc('criar_conta_parcelada_teste',{
    p_paciente_id:patient,p_protocolo_id:protocol||null,p_descricao:description.trim(),p_valor:value,
    p_primeiro_vencimento:due,p_numero_parcelas:count
   });
   if(err)throw err;
   setPatient('');setProtocol('');setDescription('');setTotal('');setInstallmentCount('1');
   setNotice('Conta a receber fictícia criada em '+count+' parcela(s) com vencimentos próprios, sem emissão de cobrança.');await load();
  }catch(e){setError('Não foi possível cadastrar: '+e.message);}
  finally{setBusy(false);}
 }
 async function pay(e){
  e.preventDefault();if(!payAccount||busy)return;
  const value=amount(payAmount);
  if(!Number.isFinite(value)||value<=0||value>Number(payAccount.saldo_pendente)){setError('O pagamento precisa ser positivo e não pode superar o saldo pendente.');return;}
  if(!window.confirm('Registrar recebimento FICTÍCIO de '+brl(value)+' para '+payAccount.paciente_nome+'? Esta ação não movimenta dinheiro.'))return;
  setBusy(true);setError('');setNotice('');
  try{
   const {error:err}=await supabase.rpc('registrar_pagamento_receber_teste',{
    p_conta_id:payAccount.conta_id,p_valor:value,p_forma:payForm,
    p_pago_em:payDate+'T12:00:00-03:00',p_parcelas:Number(payInstallments),p_referencia:payReference.trim()||null
   });
   if(err)throw err;
   setPayAccount(null);setPayAmount('');setPayInstallments('1');setPayReference('');
   await load();setNotice('Pagamento fictício registrado. O saldo foi atualizado.');
  }catch(e){setError('Não foi possível registrar: '+e.message);}
  finally{setBusy(false);}
 }
 async function cancel(row){
  const reason=window.prompt('Informe o motivo do cancelamento (5 a 500 caracteres). Não será permitido se houver pagamentos registrados.');
  if(reason===null)return;
  if(reason.trim().length<5||reason.trim().length>500){setError('O motivo precisa ter de 5 a 500 caracteres.');return;}
  setBusy(true);setError('');setNotice('');
  try{
   const {error:err}=await supabase.rpc('cancelar_conta_receber_teste',{p_conta_id:row.conta_id,p_motivo:reason.trim()});
   if(err)throw err;await load();setNotice('Conta fictícia cancelada e registrada na auditoria.');
  }catch(e){setError('Não foi possível cancelar: '+e.message);}finally{setBusy(false);}
 }
 async function history(id){
  if(details[id]){setDetails(old=>({...old,[id]:null}));return;}
  const {data,error:err}=await supabase.rpc('listar_pagamentos_receber_teste',{p_conta_id:id});
  if(err)setError('Não foi possível carregar pagamentos: '+err.message);
  else setDetails(old=>({...old,[id]:data||[]}));
 }
 const protocolsForPatient=protocols.filter(p=>p.paciente_id===patient);
 const monthlyScheduled=monthly.reduce((sum,m)=>sum+Number(m.previsto||0),0);
 const monthlyReceived=monthly.reduce((sum,m)=>sum+Number(m.recebido||0),0);
 return <section className="receivables-page">
  <div className="premium-panel"><div className="panel-title"><span className="title-icon">R$</span><div><h3>Contas a receber e pagamentos</h3>
   <p>Financeiro de teste · acesso médico exclusivo nesta etapa.</p></div></div>
   <p className="profile-notice">Lançamentos manuais com dados fictícios. Não representam cobrança enviada, comprovante bancário, nota fiscal nem conciliação financeira. Cada parcela tem vencimento próprio. Pagamentos parciais são alocados às parcelas mais antigas apenas para visualização; o vínculo com protocolo não gera cobrança automática.</p>
   {error&&<p role="alert" className="form-message">{error}</p>}
   {notice&&<p role="status" className="form-message">{notice}</p>}
   <div className="form-actions"><button type="button" className="outline-gold" disabled={loading||busy} onClick={load}>↻ Atualizar financeiro</button></div>
  </div>
  <div className="receivables-metrics">
   <div><small>Valor cadastrado</small><strong>{loading?'…':brl(rows.filter(x=>x.status!=='cancelada').reduce((sum,x)=>sum+Number(x.valor_total),0))}</strong></div>
   <div><small>Recebido registrado</small><strong>{loading?'…':brl(received)}</strong></div>
   <div><small>Saldo a receber</small><strong>{loading?'…':brl(pending)}</strong></div>
   <div><small>Vencido</small><strong>{loading?'…':brl(overdueInstallments.reduce((sum,x)=>sum+Number(x.saldo),0))}</strong></div>
  </div>
  <div className="premium-panel">
   <h3>Nova conta a receber</h3>
   <form className="receivables-form" onSubmit={create}>
    <label>Paciente fictício *<select required value={patient} onChange={e=>{setPatient(e.target.value);setProtocol('');}}>
     <option value="">Selecione o paciente</option>{patients.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
    <label>Protocolo relacionado (opcional)<select value={protocol} onChange={e=>setProtocol(e.target.value)} disabled={!patient}>
     <option value="">Sem protocolo vinculado</option>{protocolsForPatient.map(p=><option key={p.protocolo_id} value={p.protocolo_id}>{p.nome} — {brl(p.preco_cobrado)}</option>)}</select></label>
    <label>Descrição *<input required maxLength={200} minLength={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: consulta, retorno, protocolo"/></label>
    <label>Valor (R$) *<input required type="text" inputMode="numeric" autoComplete="off" value={currencyDisplay(total)} onChange={e=>setTotal(currencyDigits(e.target.value))} placeholder="R$ 0,00" aria-label="Valor da conta em reais"/></label>
    <label>Primeiro vencimento *<input type="date" required value={due} onChange={e=>setDue(e.target.value)}/></label>
    <label>Parcelamento<select value={installmentCount} onChange={e=>setInstallmentCount(e.target.value)}>{Array.from({length:36},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}x {n===1?'— à vista':'— mensal'}</option>)}</select></label>
    <p className="receivables-wide receivables-help">As parcelas seguintes vencem mensalmente no mesmo dia, ajustado ao último dia do mês quando necessário. Diferenças de centavos são distribuídas nas primeiras parcelas.</p>
    <div className="form-actions receivables-actions"><button type="submit" className="gold-button" disabled={busy||loading}>Criar conta fictícia</button></div>
   </form>
  </div>
  <div className="premium-panel receivables-monthly">
   <div className="dashboard-agenda-title"><div><h3>Resumo financeiro mensal</h3><p>Vencimentos previstos e recebimentos registrados, por mês.</p></div>
     <label>Ano<select value={reportYear} onChange={e=>setReportYear(Number(e.target.value))}>{Array.from({length:7},(_,i)=>Number(today().slice(0,4))-3+i).map(y=><option key={y} value={y}>{y}</option>)}</select></label>
   </div>
   <div className="receivables-metrics"><div><small>Total previsto no ano</small><strong>{brl(monthlyScheduled)}</strong></div><div><small>Recebimentos no ano</small><strong>{brl(monthlyReceived)}</strong></div></div>
   <div className="receivables-monthly-list">{monthly.map(m=><div className="receivables-month-row" key={m.mes}><strong>{monthNames[Number(m.mes)-1]}</strong><span>Previsto: {brl(m.previsto)}</span><span>Recebido: {brl(m.recebido)}</span></div>)}</div>
   <p className="profile-notice">Previsto representa o total de parcelas com vencimento naquele mês, não necessariamente receita futura garantida. Recebido considera a data do pagamento registrado. Os dois valores são independentes.</p>
  </div>
  <div className="premium-panel">
   <div className="dashboard-agenda-title"><div><h3>Contas registradas</h3><p>{open.length} com saldo pendente · {paid.length} quitadas · {overdue.length} vencidas</p></div></div>
   <div className="receivables-form">
    <label>Filtrar por situação<select value={filter} onChange={e=>setFilter(e.target.value)}>
     <option value="abertas">Com saldo pendente</option><option value="vencidas">Vencidas</option><option value="quitadas">Quitadas</option><option value="canceladas">Canceladas</option><option value="todas">Todas</option>
    </select></label>
    <label>Buscar paciente ou descrição<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pesquisar"/></label>
   </div>
   {loading?<p>Carregando financeiro...</p>:shown.length===0?<p className="record-empty">Nenhuma conta fictícia encontrada para este filtro.</p>:
    <div className="receivables-list">{shown.map(row=><div className="receivables-row" key={row.conta_id}>
     <div><strong>{row.paciente_nome}</strong><small>{row.descricao}{row.protocolo_nome?' · '+row.protocolo_nome:''}</small>
      <small>Primeiro vencimento: {ptDate(row.vencimento)} · {row.status==='cancelada'?'Cancelada':Number(row.saldo_pendente)<0.001?'Quitada':overdue.some(x=>x.conta_id===row.conta_id)?'Com parcela vencida':'Em aberto'}</small></div>
     <div className="receivables-numbers"><strong>{brl(row.valor_total)}</strong><span>Recebido: {brl(row.total_pago)}</span><span>Saldo: {brl(row.saldo_pendente)}</span></div>
     <div className="receivables-row-actions">
      {row.status==='aberta'&&Number(row.saldo_pendente)>0.001&&<button type="button" className="gold-button" disabled={busy} onClick={()=>{setPayAccount(row);setPayAmount('');setPayDate(today());}}>Registrar pagamento</button>}
      <button type="button" className="outline-gold" onClick={()=>history(row.conta_id)}>Histórico</button>
      {row.status==='aberta'&&Number(row.total_pago)<0.001&&<button type="button" className="outline-gold" disabled={busy} onClick={()=>cancel(row)}>Cancelar conta</button>}
     </div>
     <div className="receivables-installments"><strong>Parcelas e vencimentos</strong>{installments.filter(p=>p.conta_id===row.conta_id).sort((a,b)=>a.numero-b.numero).map(p=><div key={p.parcela_id} className="receivables-installment"><span>{p.numero}ª · {ptDate(p.vencimento)}</span><span>{brl(p.valor)}</span><span>{Number(p.saldo)<0.001?'Quitada':row.status==='cancelada'?'Cancelada':p.vencimento<t?'Vencida':'Pendente'} · Saldo {brl(p.saldo)}</span></div>)}</div>
     {details[row.conta_id]&&<div className="receivables-history">{details[row.conta_id].length?details[row.conta_id].map(p=><p key={p.id}>{brl(p.valor)} · {forms[p.forma]} · {new Date(p.pago_em).toLocaleDateString('pt-BR')} · {p.parcelas} parcela(s){p.referencia?' · '+p.referencia:''}</p>):'Nenhum pagamento registrado.'}</div>}
    </div>)}</div>}
  </div>
  {payAccount&&<div className="premium-panel">
   <h3>Registrar recebimento fictício</h3><p>{payAccount.paciente_nome} · {payAccount.descricao} · saldo de {brl(payAccount.saldo_pendente)}</p>
   <form className="receivables-form" onSubmit={pay}>
    <label>Valor recebido (R$) *<input required type="text" inputMode="numeric" autoComplete="off" value={currencyDisplay(payAmount)} onChange={e=>setPayAmount(currencyDigits(e.target.value))} placeholder="R$ 0,00" aria-label="Valor recebido em reais"/></label>
    <label>Forma de pagamento *<select value={payForm} onChange={e=>setPayForm(e.target.value)}>{Object.entries(forms).map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
    <label>Data do pagamento *<input required type="date" value={payDate} onChange={e=>setPayDate(e.target.value)}/></label>
    <label>Parcelas no comprovante do recebimento<select value={payInstallments} onChange={e=>setPayInstallments(e.target.value)}>{[...Array(12)].map((_,i)=><option key={i+1} value={i+1}>{i+1}x</option>)}</select></label>
    <p className="receivables-wide receivables-help">Este campo registra como o pagamento foi efetuado no cartão; não altera o cronograma de vencimentos da conta.</p>
    <label className="receivables-wide">Referência administrativa<input maxLength={200} value={payReference} onChange={e=>setPayReference(e.target.value)} placeholder="Opcional, sem dados bancários sensíveis"/></label>
    <div className="form-actions receivables-actions"><button type="button" className="outline-gold" onClick={()=>setPayAccount(null)}>Cancelar</button><button className="gold-button" disabled={busy}>Confirmar recebimento fictício</button></div>
   </form>
  </div>}
 </section>;
}
