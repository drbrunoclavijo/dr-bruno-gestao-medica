import React,{useEffect,useState} from 'react';
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const date=v=>String(v||'').slice(0,10).split('-').reverse().join('/')||'—';
const now=new Date();
const years=Array.from({length:9},(_,i)=>String(now.getFullYear()-4+i));
const names=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const sum=(items,key)=>items.reduce((v,x)=>v+Number(x[key]||0),0);
export default function ManagementReports({supabase,role}){
 const [year,setYear]=useState(String(now.getFullYear()));
 const [month,setMonth]=useState(String(now.getMonth()+1).padStart(2,'0'));
 const [period,setPeriod]=useState('mes');
 const [from,setFrom]=useState(String(now.getFullYear())+'-01-01');
 const [to,setTo]=useState(now.toISOString().slice(0,10));
 const [rows,setRows]=useState([]),[agenda,setAgenda]=useState([]),[cash,setCash]=useState(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[last,setLast]=useState('');
 const start=period==='livre'?from:year+(period==='ano'?'-01':'-'+month)+'-01';
 const end=period==='livre'?to:period==='ano'?year+'-12-31':new Date(Date.UTC(Number(year),Number(month),0)).toISOString().slice(0,10);
 async function load(){
  if(!start||!end||start>end||(Date.parse(end)-Date.parse(start))/86400000>730){setError('Informe período válido de até 731 dias.');return;}
  setLoading(true);setError('');
  const a={p_inicio:start,p_fim:end};
  const results=await Promise.all([supabase.rpc('relatorio_producao_periodo_teste',a),supabase.rpc('relatorio_agenda_periodo_teste',a),role==='medico'?supabase.rpc('relatorio_caixa_periodo_teste',a):Promise.resolve({data:null,error:null})]);
  const err=results.find(r=>r.error)?.error;
  if(err){setError('Relatório indisponível: '+err.message+'. Verifique a migração SQL.');setRows([]);setAgenda([]);setCash(null);}
  else{setRows(results[0].data||[]);setAgenda(results[1].data||[]);setCash(results[2].data?.[0]||null);setLast(start+'|'+end);}
  setLoading(false);
 }
 useEffect(()=>{load();},[role,period,year,month,from,to]);
 const known=rows.filter(r=>r.taxa_estimada!=null&&r.liquido_estimado!=null);
 const unknown=rows.length-known.length;
 const performed=agenda.filter(x=>x.situacao==='realizado').reduce((a,b)=>a+Number(b.total),0);
 const Metric=({label,value})=><div className="report-metric"><small>{label}</small><strong>{value}</strong></div>;
 return <section className="management-reports">
  <div className="premium-panel report-head">
   <div className="panel-title"><span className="title-icon">▤</span><div><h3>Relatório gerencial — {role==='medico'?'Dr. Bruno Clavijo':'Dra. Carol Klaus'}</h3><p>Controle gerencial com dados fictícios, separado por profissional.</p></div></div>
   <div className="report-filters">
    <label>Período<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="mes">Mês</option><option value="ano">Ano</option><option value="livre">Personalizado</option></select></label>
    {period!=='livre'?<><label>Ano<select value={year} onChange={e=>setYear(e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label>
    {period==='mes'&&<label>Mês<select value={month} onChange={e=>setMonth(e.target.value)}>{names.map((name,i)=><option value={String(i+1).padStart(2,'0')} key={name}>{name}</option>)}</select></label>}</>:
    <><label>De<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Até<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}
    <button type="button" className="outline-gold" disabled={loading} onClick={load}>Atualizar</button>
    <button type="button" className="gold-button" disabled={loading||Boolean(error)||!last} onClick={()=>window.print()}>Imprimir / Salvar em PDF</button>
   </div>
   {error&&<p className="form-message" role="alert">{error}</p>}
   {!error&&<p className="profile-notice">Período: {date(start)} a {date(end)}. Produção cadastrada não equivale a dinheiro recebido nem a serviço realizado.</p>}
  </div>
  {loading?<div className="premium-panel">Carregando relatório…</div>:!error&&<>
   <div className="premium-panel">
    <h3>Produção cadastrada</h3>
    <div className="report-metrics">
     <Metric label="Registros" value={rows.length}/>
     <Metric label="Valor comercial cadastrado" value={brl(sum(rows,'valor_cobrado'))}/>
     <Metric label="Taxas previstas (conhecidas)" value={brl(sum(known,'taxa_estimada'))}/>
     <Metric label="Líquido estimado (conhecido)" value={brl(sum(known,'liquido_estimado'))}/>
    </div>
    {unknown>0&&<p className="profile-notice">{unknown} registro(s) antigo(s) sem dados suficientes de taxa e líquido. Não estão incluídos no líquido estimado.</p>}
   </div>
   <div className="premium-panel">
    <h3>Agenda individual</h3>
    <div className="report-metrics"><Metric label="Atendimentos marcados como realizados" value={performed}/><Metric label="Total de agendamentos" value={agenda.reduce((a,x)=>a+Number(x.total),0)}/></div>
    <div className="report-rows">{agenda.map((x,i)=><div key={i}><span>{x.tipo} · {x.situacao}</span><strong>{x.total}</strong></div>)}</div>
   </div>
   {role==='medico'&&<div className="premium-panel">
    <h3>Caixa geral da clínica — somente perfil médico</h3>
    <div className="report-metrics">
     <Metric label="Pagamentos registrados" value={brl(cash?.recebido_bruto)}/>
     <Metric label="Taxas confirmadas" value={brl(cash?.taxas_confirmadas)}/>
     <Metric label="Despesas pagas" value={brl(cash?.despesas_pagas)}/>
     <Metric label="Resultado após taxas" value={brl(cash?.resultado_apos_taxas)}/>
     <Metric label="Contas cadastradas" value={brl(cash?.contas_criadas)}/>
     <Metric label="Despesas pendentes" value={brl(cash?.despesas_a_vencer)}/>
    </div>
    <p className="profile-notice">O caixa é da clínica inteira, não é atribuível individualmente a Bruno ou Carol. Resultado de caixa não é lucro contábil. Custos estimados não são descontados novamente.</p>
   </div>}
   <div className="premium-panel">
    <h3>Detalhamento da produção</h3>
    {rows.length?<div className="report-table-scroll"><table className="report-table">
     <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Taxa prevista</th><th>Líquido previsto</th><th>Status</th></tr></thead>
     <tbody>{rows.map(r=><tr key={r.origem_id}><td>{date(r.data_referencia)}</td><td>{r.tipo}</td><td>{r.descricao}</td><td>{brl(r.valor_cobrado)}</td><td>{r.taxa_estimada==null?'—':brl(r.taxa_estimada)}</td><td>{r.liquido_estimado==null?'—':brl(r.liquido_estimado)}</td><td>{r.situacao}</td></tr>)}</tbody>
    </table></div>:<p>Nenhum registro encontrado neste período.</p>}
   </div>
   <p className="profile-notice">Documento de testes. O botão PDF utiliza a impressão do navegador; escolha “Salvar como PDF”. Não é relatório contábil ou fiscal.</p>
  </>}
 </section>;
}
