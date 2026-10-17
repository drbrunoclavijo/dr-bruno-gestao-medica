import React,{useEffect,useState} from 'react';
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const digits=v=>String(v||'').replace(/\D/g,'').replace(/^0+(?=\d)/,'').slice(0,9);
const moneyInput=v=>v?brl(Number(v)/100):'';
const moneyValue=v=>v&&/^\d{1,9}$/.test(v)?Number(v)/100:NaN;
const dateBR=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const x=Object.fromEntries(parts.map(p=>[p.type,p.value]));return x.year+'-'+x.month+'-'+x.day;};
const categories={aluguel:'Aluguel',pessoal:'Equipe e pessoal',energia:'Energia',agua:'Água',internet:'Internet',marketing:'Marketing',manutencao:'Manutenção',material_escritorio:'Material administrativo',impostos:'Impostos',taxa_cartao:'Taxas de cartão',medicamentos:'Medicamentos (compra)',insumos:'Insumos (compra)',outros:'Outras despesas'};
const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
export default function ClinicExpenses({supabase,year}){
 const [expenses,setExpenses]=useState([]),[monthsReport,setMonthsReport]=useState([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [description,setDescription]=useState(''),[category,setCategory]=useState('aluguel'),[value,setValue]=useState(''),
 [due,setDue]=useState(today()),[paid,setPaid]=useState(false),[paidDate,setPaidDate]=useState(today()),[notes,setNotes]=useState(''),[filter,setFilter]=useState('todas');
 async function load(){
  setLoading(true);setError('');
  const [a,b]=await Promise.all([supabase.rpc('listar_despesas_financeiras_teste',{p_ano:year}),
    supabase.rpc('resumo_resultado_financeiro_teste',{p_ano:year})]);
  if(a.error||b.error){setError('Não foi possível carregar as despesas: '+(a.error||b.error).message+'. Verifique a migração SQL de despesas.');setExpenses([]);setMonthsReport([]);}
  else{setExpenses(a.data||[]);setMonthsReport(b.data||[]);}
  setLoading(false);
 }
 useEffect(()=>{load();},[year]);
 async function create(e){
  e.preventDefault();setError('');setNotice('');
  const amount=moneyValue(value);
  if(!Number.isFinite(amount)||amount<=0){setError('Informe valor maior que R$ 0,00.');return;}
  if(!window.confirm('Registrar despesa fictícia de '+brl(amount)+' ('+categories[category]+')?'))return;
  setBusy(true);
  const {error:err}=await supabase.rpc('criar_despesa_financeira_teste',{p_descricao:description.trim(),p_categoria:category,p_valor:amount,
    p_vencimento:due,p_pago_em:paid?paidDate:null,p_observacao:notes.trim()||null});
  if(err)setError('Erro ao registrar despesa: '+err.message);
  else{setDescription('');setValue('');setNotes('');setPaid(false);setNotice('Despesa fictícia registrada.');await load();}
  setBusy(false);
 }
 async function settle(expense){
  if(!window.confirm('Confirmar pagamento fictício de '+brl(expense.valor)+'?'))return;
  setBusy(true);setError('');setNotice('');
  const {error:err}=await supabase.rpc('quitar_despesa_financeira_teste',{p_despesa_id:expense.id,p_pago_em:today()});
  if(err)setError('Não foi possível quitar: '+err.message);
  else{setNotice('Despesa marcada como paga na data de hoje.');await load();}
  setBusy(false);
 }
 async function cancel(expense){
  const why=window.prompt('Informe motivo do cancelamento desta despesa NÃO PAGA (5 a 300 caracteres):');
  if(why===null)return;
  if(why.trim().length<5||why.trim().length>300){setError('Motivo precisa ter de 5 a 300 caracteres.');return;}
  setBusy(true);setError('');setNotice('');
  const {error:err}=await supabase.rpc('cancelar_despesa_financeira_teste',{p_despesa_id:expense.id,p_motivo:why.trim()});
  if(err)setError('Não foi possível cancelar: '+err.message);
  else{setNotice('Despesa cancelada e registrada na auditoria.');await load();}
  setBusy(false);
 }
 const paidTotal=monthsReport.reduce((sum,m)=>sum+Number(m.despesas_pagas),0);
 const expected=monthsReport.reduce((sum,m)=>sum+Number(m.despesas_previstas),0);
 const received=monthsReport.reduce((sum,m)=>sum+Number(m.recebido),0);
 const shown=expenses.filter(e=>filter==='todas'||(filter==='pagas'?!!e.pago_em:filter==='pendentes'?e.status==='ativa'&&!e.pago_em:filter==='canceladas'?e.status==='cancelada':e.categoria===filter));
 return <div className="clinic-expenses">
  <section className="premium-panel"><div className="panel-title"><span className="title-icon">−</span><div><h3>Despesas e resultado de caixa · {year}</h3><p>Registro de custos operacionais, taxas de maquininha e saída de caixa.</p></div></div>
   <p className="profile-notice">O resultado exibido é recebido MENOS despesas pagas registradas neste módulo, não lucro líquido contábil. Aquisição de estoque e consumo por atendimento têm bases diferentes: não some os custos de consumo novamente quando a compra do estoque já estiver registrada como despesa. Taxas InfinitePay simuladas não viram despesa automaticamente.</p>
   {error&&<p className="form-message" role="alert">{error}</p>}{notice&&<p className="form-message" role="status">{notice}</p>}
   <div className="form-actions"><button className="outline-gold" onClick={load} disabled={loading||busy}>Atualizar despesas</button></div>
  </section>
  <div className="receivables-metrics">
   <div><small>Recebido no ano</small><strong>{loading?'…':brl(received)}</strong></div>
   <div><small>Despesas pagas</small><strong>{loading?'…':brl(paidTotal)}</strong></div>
   <div><small>Despesas pendentes</small><strong>{loading?'…':brl(expected)}</strong></div>
   <div><small>Resultado de caixa registrado</small><strong>{loading?'…':brl(received-paidTotal)}</strong></div>
  </div>
  <section className="premium-panel"><h3>Registrar despesa fictícia</h3>
   <form className="receivables-form" onSubmit={create}>
    <label>Descrição *<input required minLength={3} maxLength={200} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: energia elétrica da clínica"/></label>
    <label>Categoria *<select value={category} onChange={e=>setCategory(e.target.value)}>{Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label>Valor (R$) *<input type="text" inputMode="numeric" autoComplete="off" required value={moneyInput(value)} onChange={e=>setValue(digits(e.target.value))} placeholder="R$ 0,00"/></label>
    <label>Vencimento *<input type="date" required value={due} onChange={e=>setDue(e.target.value)}/></label>
    <label className="expense-check"><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)}/> Já está paga</label>
    {paid&&<label>Data de pagamento<input type="date" required value={paidDate} onChange={e=>setPaidDate(e.target.value)}/></label>}
    <label className="receivables-wide">Observação administrativa<input maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Opcional"/></label>
    <div className="form-actions receivables-actions"><button className="gold-button" disabled={busy||loading}>Salvar despesa</button></div>
   </form>
  </section>
  <section className="premium-panel"><h3>Resultado mensal de caixa · {year}</h3>
   <div className="receivables-monthly-list">{monthsReport.map(m=><div key={m.mes} className="receivables-month-row expense-month-row">
    <strong>{months[Number(m.mes)-1]}</strong><span>Recebido: {brl(m.recebido)}</span><span>Pago: {brl(m.despesas_pagas)}</span><span>Resultado: {brl(m.resultado_caixa)}</span>
   </div>)}</div>
  </section>
  <section className="premium-panel"><div className="dashboard-agenda-title"><div><h3>Despesas cadastradas</h3><p>Registros fictícios por vencimento e situação.</p></div></div>
   <label className="expense-filter">Filtrar<select value={filter} onChange={e=>setFilter(e.target.value)}>
    <option value="todas">Todas</option><option value="pendentes">Não pagas</option><option value="pagas">Pagas</option><option value="canceladas">Canceladas</option>
    {Object.entries(categories).map(([key,label])=><option key={key} value={key}>{label}</option>)}
   </select></label>
   {loading?<p>Carregando despesas...</p>:shown.length===0?<p className="record-empty">Nenhuma despesa fictícia encontrada neste filtro.</p>:
    <div className="receivables-list">{shown.map(e=><div key={e.id} className="receivables-row">
     <div><strong>{e.descricao}</strong><small>{categories[e.categoria]} · Vencimento {dateBR(e.vencimento)}</small>
      <small>{e.status==='cancelada'?'Cancelada':e.pago_em?'Paga em '+dateBR(e.pago_em):e.vencimento<today()?'Vencida':'Não paga'}{e.observacao?' · '+e.observacao:''}</small></div>
     <div className="receivables-numbers"><strong>{brl(e.valor)}</strong></div>
     <div className="receivables-row-actions">
      {e.status==='ativa'&&!e.pago_em&&<><button type="button" className="gold-button" disabled={busy} onClick={()=>settle(e)}>Marcar como paga</button>
       <button type="button" className="outline-gold" disabled={busy} onClick={()=>cancel(e)}>Cancelar</button></>}
     </div>
    </div>)}</div>}
  </section>
 </div>;
}
