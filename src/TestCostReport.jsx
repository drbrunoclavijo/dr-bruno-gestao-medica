import React,{useEffect,useMemo,useState} from 'react';

const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n));
const dateTime=v=>v?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(v)):'Data não informada';

export default function TestCostReport({supabase}){
 const [rows,setRows]=useState([]),[supplyRows,setSupplyRows]=useState([]),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [query,setQuery]=useState('');
 async function load(){
  setBusy(true);setError('');
  const [meds,supplies]=await Promise.all([
   supabase.rpc('relatorio_consumo_prescricoes_teste'),
   supabase.rpc('relatorio_consumo_insumos_teste')
  ]);
  if(meds.error||supplies.error){setError('Não foi possível consultar o relatório: '+(meds.error||supplies.error).message);setRows([]);setSupplyRows([]);}
  else{setRows(meds.data||[]);setSupplyRows(supplies.data||[]);}
  setBusy(false);
 }
 useEffect(()=>{load()},[]);
 const groups=useMemo(()=>{
  const map=new Map();
  for(const r of rows){
   if(!map.has(r.prescricao_id))map.set(r.prescricao_id,{
    key:r.prescricao_id,patient:r.paciente_nome,date:r.prescrito_em,
    entries:[],total:0,unknown:0
   });
   const group=map.get(r.prescricao_id);
   group.entries.push(r);
   if(r.custo_saida===null||r.custo_saida===undefined)group.unknown++;
   else group.total+=Number(r.custo_saida);
  }
  return [...map.values()];
 },[rows]);
 const filtered=groups.filter(g=>g.patient?.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
 const known=filtered.reduce((n,g)=>n+g.total,0);
 const missing=filtered.reduce((n,g)=>n+g.unknown,0);
 const filteredSupplies=supplyRows.filter(r=>r.paciente_nome?.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
 const suppliesCost=filteredSupplies.reduce((n,r)=>n+Number(r.custo_saida||0),0);
 const suppliesMissing=filteredSupplies.filter(r=>r.custo_saida==null).length;
 return <section className="premium-panel cost-report">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">R$</span><div>
   <h3>Consumo e custos por prescrição de teste</h3>
   <p>Somente perfil médico. Custos baseados nas baixas efetivamente registradas no estoque fictício.</p>
  </div></div>
  <p className="profile-notice">O agrupamento é por prescrição, não por protocolo de tratamento completo. Custos desconhecidos não são contabilizados como zero. Os medicamentos e insumos contabilizados são os que tiveram baixa na checagem, sem honorários ou despesas indiretas.</p>
  {error&&<p className="form-message" role="alert">{error}</p>}
  <div className="record-top">
   <h4>Baixas registradas</h4>
   <button type="button" className="outline-gold" onClick={load} disabled={busy}>Atualizar</button>
  </div>
  <label className="inventory-report-search">Pesquisar paciente fictício
   <input type="search" placeholder="Buscar pelo nome" value={query} onChange={e=>setQuery(e.target.value)}/>
  </label>
  {busy?<p>Carregando custos...</p>:<><div className="inventory-report-metrics">
   <div><small>Prescrições com baixa</small><strong>{filtered.length}</strong></div>
   <div><small>Custos conhecidos</small><strong>{money(known)}</strong></div>
   <div><small>Custos conhecidos de insumos</small><strong>{money(suppliesCost)}</strong></div>
   <div><small>Total conhecido (medicamentos + insumos)</small><strong>{money(known+suppliesCost)}</strong></div>
   <div><small>Saídas sem custo informado</small><strong>{missing+suppliesMissing}</strong></div>
  </div>
  {filtered.length===0?<p className="record-empty">Não há baixas fictícias vinculadas a prescrições nesta consulta.</p>:
   <div className="record-list">{filtered.map(g=><details className="record-entry" key={g.key}>
    <summary><span>{g.patient} · {dateTime(g.date)}</span><span>{money(g.total)}{g.unknown?' + custo(s) pendente(s)':''}</span></summary>
    <div className="record-content">
     {g.entries.map((r,i)=><div key={i} className="prescription-preview">
      <strong>{r.medicamento} · {r.produto_nome}</strong>
      <p>Quantidade: {r.quantidade} {r.unidade} · Lote: {r.lote}</p>
      <p>Checagem: {dateTime(r.baixa_em)} · Responsável: {r.responsavel_nome}</p>
      <p>Valor da saída: <strong>{r.custo_saida==null?'Não informado':money(r.custo_saida)}</strong></p>
     </div>)}
     <p className="inventory-report-total">Subtotal conhecido desta prescrição: <strong>{money(g.total)}</strong>{g.unknown>0&&' · Parcial: há saídas sem custo'}</p>
    </div>
   </details>)}</div>}
  <div className="record-top"><h4>Insumos utilizados nas checagens fictícias</h4></div>
  {filteredSupplies.length===0?<p className="record-empty">Nenhum soro, equipo, Jelco ou outro insumo com baixa vinculada a uma prescrição fictícia.</p>:
  <div className="record-list">{filteredSupplies.map((r,i)=><div className="form-section" key={i}>
   <strong>{r.paciente_nome} · {r.insumo_nome}</strong>
   <p>Medicamento associado: {r.medicamento} · Quantidade: {r.quantidade} {r.unidade} · Lote: {r.lote}</p>
   <p>Baixa: {dateTime(r.baixa_em)} · Custo: <strong>{r.custo_saida==null?'Não informado':money(r.custo_saida)}</strong></p>
  </div>)}</div>}
  </>}
 </section>;
}