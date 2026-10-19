import React,{useMemo,useState} from 'react';
import {protocolTotals} from './ProtocolPricingMath.js';
import {pricingQuote} from './PricingMath.js';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n||0);
const defaults={title:'',visits:6,minutes:30,hour:0,fixed:0,volume:100,tax:0,fee:0,commission:0,margin:25,price:0};
const newItem=()=>({key:String(Date.now())+Math.random(),name:'',sessions:1,quantity:1,unitCost:0});
export default function ProtocolPricingSimulator(){
 const [p,setP]=useState(defaults),[items,setItems]=useState([newItem()]);
 const change=(key,v)=>setP(x=>({...x,[key]:key==='title'?v:Number(v)}));
 const changeItem=(key,field,v)=>setItems(a=>a.map(x=>x.key===key?{...x,[field]:field==='name'?v:Number(v)}:x));
 const totals=useMemo(()=>protocolTotals(items,p.visits,p.minutes,p.hour,p.fixed,p.volume),[items,p]);
 const estimate=useMemo(()=>totals?pricingQuote({materials:totals.supplies,minutes:0,hourCost:0,otherFixed:totals.labor+totals.fixed,
  taxPct:p.tax,feePct:p.fee,commissionPct:p.commission,marginPct:p.margin,marketPrice:p.price}):null,[totals,p]);
 const n=(k,label,step='0.01')=><label>{label}<input type="number" min="0" step={step} value={p[k]} onChange={e=>change(k,e.target.value)}/></label>;
 return <section className="form-section" aria-label="Precificação de protocolo completo">
  <h4>Protocolo completo com várias sessões</h4>
  <p>Simule todos os medicamentos, insumos e atendimentos do protocolo. As quantidades são informadas manualmente e não representam prescrição. Nenhum item altera o estoque.</p>
  <div className="clinical-fields">
   <label>Nome do protocolo<input maxLength={120} value={p.title} placeholder="Ex.: protocolo de acompanhamento de 90 dias" onChange={e=>change('title',e.target.value)}/></label>
   {n('visits','Número total de sessões','1')}{n('minutes','Minutos do profissional por sessão','1')}
   {n('hour','Custo por hora do profissional (R$)')}
   {n('fixed','Despesas fixas mensais rateáveis (R$)')}{n('volume','Atendimentos mensais estimados','1')}
  </div>
  <h4>Itens por protocolo</h4>
  {items.map((item,i)=><div className="clinical-fields" key={item.key} style={{marginBottom:12}}>
   <label>Medicamento ou insumo {i+1}<input maxLength={120} value={item.name} onChange={e=>changeItem(item.key,'name',e.target.value)} placeholder="Ex.: equipo, frasco, seringa"/></label>
   <label>Em quantas sessões?<input type="number" min="0" step="1" value={item.sessions} onChange={e=>changeItem(item.key,'sessions',e.target.value)}/></label>
   <label>Quantidade por sessão<input type="number" min="0" step="0.01" value={item.quantity} onChange={e=>changeItem(item.key,'quantity',e.target.value)}/></label>
   <label>Custo por unidade (R$)<input type="number" min="0" step="0.01" value={item.unitCost} onChange={e=>changeItem(item.key,'unitCost',e.target.value)}/></label>
   <button type="button" className="outline-gold" disabled={items.length===1} onClick={()=>setItems(a=>a.filter(x=>x.key!==item.key))}>Excluir item</button>
  </div>)}
  <button type="button" className="outline-gold" disabled={items.length>=200} onClick={()=>setItems(a=>[...a,newItem()])}>+ Adicionar medicamento ou insumo</button>
  <h4>Venda do protocolo</h4>
  <div className="clinical-fields">
   {n('tax','Impostos sobre a venda (%)')}{n('fee','Taxa de recebimento estimada (%)')}
   {n('commission','Comissões e repasses calculados sobre a venda (%)')}
   {n('margin','Margem líquida desejada sobre a venda (%)')}
   {n('price','Preço praticado ou proposto (R$)')}
  </div>
  {!estimate?<p className="form-message" role="alert">Confira os valores, quantidades e percentuais. O rateio mensal deve ser maior que zero, e os percentuais totais devem ser inferiores a 100%.</p>:<>
   <div className="detail-grid">
    <div className="detail-item"><span>Total em medicamentos e insumos</span><strong>{money(totals.supplies)}</strong></div>
    <div className="detail-item"><span>Tempo dos profissionais</span><strong>{money(totals.labor)}</strong></div>
    <div className="detail-item"><span>Rateio de despesas fixas</span><strong>{money(totals.fixed)}</strong></div>
    <div className="detail-item"><span>Custo completo estimado</span><strong>{money(totals.total)}</strong></div>
    <div className="detail-item"><span>Preço mínimo estimado</span><strong>{money(estimate.minimum)}</strong></div>
    <div className="detail-item"><span>Preço sugerido</span><strong>{money(estimate.suggested)}</strong></div>
    <div className="detail-item"><span>Resultado no preço informado</span><strong>{estimate.marketResult===null?'Informe um preço':money(estimate.marketResult)}</strong></div>
   </div>
  </>}
  <p className="profile-notice">O total considera o custo informado para cada item multiplicado por sua quantidade e número de sessões, somado ao tempo do profissional e ao rateio de despesas fixas. Taxas, impostos e comissões são estimativas configuráveis e não são cobradas nem duplicadas. Sem integração com estoque ou financeiro nesta versão.</p>
 </section>;
}
