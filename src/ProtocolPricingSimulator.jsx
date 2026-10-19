import React,{useEffect,useMemo,useState} from 'react';
import {rateForPayment,tiers} from './PaymentRates.js';
import {protocolTotals} from './ProtocolPricingMath.js';
import {pricingQuote} from './PricingMath.js';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n||0);
const defaults={title:'',visits:6,minutes:30,hour:0,fixed:0,volume:100,tax:0,fee:0,commission:0,margin:25,price:0};
const newItem=()=>({key:String(Date.now())+Math.random(),name:'',sessions:1,quantity:1,unitCost:0});
export default function ProtocolPricingSimulator({supabase}){
 const [p,setP]=useState(defaults),[items,setItems]=useState([newItem()]);
 const [products,setProducts]=useState([]),[stockError,setStockError]=useState(''),[stockBusy,setStockBusy]=useState(false);
 const [method,setMethod]=useState('pix'),[brand,setBrand]=useState('visa'),[tier,setTier]=useState('inicial'),[plan,setPlan]=useState('dia'),[installments,setInstallments]=useState(1);
 const feeRate=rateForPayment(method,installments,brand,tier,plan);
 async function loadStock(){
  if(!supabase)return;
  setStockBusy(true);setStockError('');
  const [a,b]=await Promise.all([
   supabase.from('estoque_produtos_teste').select('id,nome,unidade,ativo'),
   supabase.from('estoque_lotes_teste').select('produto_id,saldo,validade,quantidade_inicial,custo_total_aquisicao')
  ]);
  if(a.error||b.error){setStockError('Não foi possível consultar os custos do estoque com este perfil. Confira as permissões no Supabase.');setProducts([]);}
  else{
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
   setProducts((a.data||[]).filter(x=>x.ativo).map(x=>{
    const candidates=(b.data||[]).filter(l=>l.produto_id===x.id&&Number(l.saldo)>0&&Number(l.quantidade_inicial)>0&&l.custo_total_aquisicao!==null&&(!l.validade||l.validade>=today));
    const totalUnits=candidates.reduce((s,l)=>s+Number(l.saldo),0);
    const sumCost=candidates.reduce((s,l)=>s+Number(l.saldo)*Number(l.custo_total_aquisicao)/Number(l.quantidade_inicial),0);
    return {...x,cost:totalUnits>0?sumCost/totalUnits:null,missingCost:(b.data||[]).some(l=>l.produto_id===x.id&&Number(l.saldo)>0&&(!l.validade||l.validade>=today)&&l.custo_total_aquisicao===null)};
   }));
  }
  setStockBusy(false);
 }
 useEffect(()=>{loadStock();},[supabase]);
 const change=(key,v)=>setP(x=>({...x,[key]:key==='title'?v:Number(v)}));
 const chooseStock=(key,id)=>{
  const product=products.find(x=>x.id===id);
  setItems(a=>a.map(x=>x.key===key?{...x,stockId:id,name:product?.nome||x.name,unitCost:product?.cost??0}:x));
 };
 const changeItem=(key,field,v)=>setItems(a=>a.map(x=>x.key===key?{...x,[field]:field==='name'?v:Number(v)}:x));
 const totals=useMemo(()=>protocolTotals(items,p.visits,p.minutes,p.hour,p.fixed,p.volume),[items,p]);
 const estimate=useMemo(()=>totals?pricingQuote({materials:totals.supplies,minutes:0,hourCost:0,otherFixed:totals.labor+totals.fixed,
  taxPct:p.tax,feePct:feeRate,commissionPct:p.commission,marginPct:p.margin,marketPrice:p.price}):null,[totals,p,feeRate]);
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
  <h4>Itens por protocolo</h4><p>Custos do estoque são uma média ponderada dos lotes válidos com saldo. Produtos com qualquer lote válido sem custo cadastrado ficam indisponíveis para seleção até a regularização. Revise o valor antes de utilizar. Não é realizada baixa.</p>{stockError&&<p className="form-message" role="alert">{stockError}</p>}<button type="button" className="outline-gold" disabled={stockBusy} onClick={loadStock}>{stockBusy?'Consultando...':'Atualizar custos do estoque'}</button>
  {items.map((item,i)=><div className="clinical-fields" key={item.key} style={{marginBottom:12}}>
   <label>Buscar no estoque<select value={item.stockId||''} onChange={e=>chooseStock(item.key,e.target.value)}><option value="">Valor manual</option>{products.filter(x=>x.cost!==null&&!x.missingCost).map(x=><option key={x.id} value={x.id}>{x.nome} ({x.unidade}) · {money(x.cost)}/unidade</option>)}</select></label>
   <label>Medicamento ou insumo {i+1}<input maxLength={120} value={item.name} onChange={e=>changeItem(item.key,'name',e.target.value)} placeholder="Ex.: equipo, frasco, seringa"/></label>
   <label>Em quantas sessões?<input type="number" min="0" step="1" value={item.sessions} onChange={e=>changeItem(item.key,'sessions',e.target.value)}/></label>
   <label>Quantidade por sessão<input type="number" min="0" step="0.01" value={item.quantity} onChange={e=>changeItem(item.key,'quantity',e.target.value)}/></label>
   <label>Custo por unidade (R$)<input type="number" min="0" step="0.01" value={item.unitCost} onChange={e=>changeItem(item.key,'unitCost',e.target.value)}/></label>
   <button type="button" className="outline-gold" disabled={items.length===1} onClick={()=>setItems(a=>a.filter(x=>x.key!==item.key))}>Excluir item</button>
  </div>)}
  <button type="button" className="outline-gold" disabled={items.length>=200} onClick={()=>setItems(a=>[...a,newItem()])}>+ Adicionar medicamento ou insumo</button>
  <h4>Venda do protocolo</h4>
  <div className="clinical-fields">
   {n('tax','Alíquota efetiva total da clínica (%), informada pelo contador')}
   {n('commission','Comissões e repasses calculados sobre a venda (%)')}
   {n('margin','Margem líquida desejada sobre a venda (%)')}
   {n('price','Preço praticado ou proposto (R$)')}
   <label>InfinitePay, forma de pagamento<select value={method} onChange={e=>setMethod(e.target.value)}><option value="pix">Pix</option><option value="debito">Débito</option><option value="credito">Crédito</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option></select></label>
   {(method==='credito'||method==='debito')&&<><label>Bandeira<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="visa">Visa/Mastercard</option><option value="outras">Elo/Amex/outras</option></select></label>
   <label>Faixa da maquininha<select value={tier} onChange={e=>setTier(e.target.value)}>{Object.entries(tiers).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
   <label>Recebimento<select value={plan} onChange={e=>setPlan(e.target.value)}><option value="dia">1 dia útil</option><option value="hora">Na hora</option></select></label></>}
   {method==='credito'&&<label>Parcelamento<select value={installments} onChange={e=>setInstallments(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}x</option>)}</select></label>}
  </div>
  <p>Taxa InfinitePay aplicada automaticamente: <strong>{feeRate.toFixed(2).replace('.',',')}%</strong>.</p>
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
