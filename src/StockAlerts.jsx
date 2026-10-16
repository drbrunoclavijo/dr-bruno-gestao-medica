import React,{useEffect,useState} from 'react';
const label={sem_estoque:'Sem estoque disponível',estoque_baixo:'Estoque abaixo do mínimo',vencido:'Lote vencido',proximo_vencimento:'Vencimento em até 30 dias'};
const shortDate=v=>v?String(v).slice(0,10).split('-').reverse().join('/'):'—';
export default function StockAlerts({supabase,onNavigate,compact=false}){
 const [alerts,setAlerts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){
  setLoading(true);setError('');
  const {data,error:err}=await supabase.rpc('alertas_estoque_teste');
  if(err){setError('Não foi possível consultar alertas: '+err.message+'. Verifique a migração de alertas de estoque.');setAlerts([]);}
  else setAlerts(data||[]);
  setLoading(false);
 }
 useEffect(()=>{load();},[]);
 const counts={sem_estoque:0,estoque_baixo:0,vencido:0,proximo_vencimento:0};
 for(const a of alerts)if(a.tipo_alerta in counts)counts[a.tipo_alerta]++;
 return <section className="premium-panel stock-alerts">
  <div className="dashboard-agenda-title">
   <div><h3>Alertas de estoque</h3><p>Saldo disponível em lotes válidos e validade dos materiais fictícios.</p></div>
   <div className="stock-alert-actions">
    <button className="outline-gold" type="button" disabled={loading} onClick={load}>Atualizar</button>
    {onNavigate&&<button className="gold-button" type="button" onClick={()=>onNavigate('Estoque')}>Abrir estoque →</button>}
   </div>
  </div>
  {error&&<p role="alert" className="form-message">{error}</p>}
  <div className="stock-alert-kpis">
   <div><small>Sem estoque</small><strong>{loading?'…':counts.sem_estoque}</strong></div>
   <div><small>Saldo baixo</small><strong>{loading?'…':counts.estoque_baixo}</strong></div>
   <div><small>Lotes vencidos</small><strong>{loading?'…':counts.vencido}</strong></div>
   <div><small>Vencem em 30 dias</small><strong>{loading?'…':counts.proximo_vencimento}</strong></div>
  </div>
  {loading?<p>Verificando alertas...</p>:!error&&alerts.length===0?<p className="record-empty">Nenhum alerta de estoque fictício no momento.</p>:
   <div className="stock-alert-list">{alerts.slice(0,compact?8:100).map((a,index)=>
    <div key={a.produto_id+'-'+a.tipo_alerta+'-'+(a.lote||index)} className="stock-alert-entry">
     <div><strong>{a.produto_nome}</strong><small>{a.tipo_produto==='insumo'?'Insumo':'Medicamento'} · {label[a.tipo_alerta]||a.tipo_alerta}</small></div>
     <div className="stock-alert-info">
      {a.lote?<span>Lote {a.lote} · {shortDate(a.validade)} · {Number(a.saldo_lote).toLocaleString('pt-BR')} {a.unidade}</span>:
       <span>Disponível: {Number(a.saldo_util).toLocaleString('pt-BR')} {a.unidade} · Mínimo: {Number(a.estoque_minimo).toLocaleString('pt-BR')}</span>}
     </div>
    </div>
   )}</div>}
  {alerts.length>(compact?8:100)&&<p className="record-empty">Exibindo {compact?8:100} de {alerts.length} alertas. Abra o estoque para mais informações.</p>}
  {alerts.length>=500&&<p className="profile-notice">Limite de 500 alertas atingido. Alguns resultados podem não aparecer.</p>}
  <p className="profile-notice">Os limites são configuráveis pelo médico, inicialmente em 5 unidades de cadastro por produto. Saldo vencido não conta como disponível. Alertas não substituem conferência física de lote, validade ou armazenamento.</p>
 </section>;
}
