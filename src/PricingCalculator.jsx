import React,{useMemo,useState} from 'react';
import {pricingQuote,splitProtocolRevenue} from './PricingMath.js';
import {rateForPayment,tiers} from './PaymentRates.js';

const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n||0);
const initial={name:'',materials:0,minutes:45,hourCost:0,fixedMonthly:0,appointmentsMonthly:100,otherFixed:0,taxPct:0,feePct:0,commissionPct:0,marginPct:25,marketPrice:0,clinicPct:30};
export default function PricingCalculator({role}){
 const allowed=['medico','enfermeira','administrativo'].includes(role);
 const [form,setForm]=useState(initial),[brand,setBrand]=useState('visa'),[tier,setTier]=useState('inicial'),[plan,setPlan]=useState('dia'),[installments,setInstallments]=useState(1),[method,setMethod]=useState('pix');
 const paymentRate=useMemo(()=>rateForPayment(method,installments,brand,tier,plan),[method,installments,brand,tier,plan]);
 const quote=useMemo(()=>pricingQuote({...form,feePct:paymentRate}),[form,paymentRate]);
 const split=useMemo(()=>splitProtocolRevenue({price:form.marketPrice,materials:form.materials,professionalCost:Number(form.minutes)*Number(form.hourCost)/60,otherCost:form.otherFixed,taxPct:form.taxPct,paymentPct:paymentRate,clinicPct:form.clinicPct}),[form,paymentRate]);
 if(!allowed)return <div className="premium-panel"><p>Acesso não autorizado.</p></div>;
 const edit=(key,value)=>setForm(v=>({...v,[key]:key==='name'?value:Number(value)}));
 const field=(key,label,step='0.01')=><label key={key}>{label}<input type="number" min="0" step={step} value={form[key]} onChange={e=>edit(key,e.target.value)}/></label>;
 return <section className="premium-panel">
  <div className="panel-title"><span className="title-icon" aria-hidden="true">◇</span><div><h3>Calculadora de precificação</h3><p>Simulador de preço para consultas, procedimentos e protocolos.</p></div></div>
  <p className="profile-notice">Simulação local com valores fictícios. Nenhum preço, estoque, repasse, venda ou cadastro será alterado. As taxas InfinitePay são estimativas e devem ser conferidas na conta da clínica.</p>
  <div className="clinical-fields">
   <label>Nome do procedimento<input type="text" maxLength={120} value={form.name} onChange={e=>edit('name',e.target.value)} placeholder="Ex.: Consulta de alta performance"/></label>
   {field('materials','Materiais, medicações e insumos por atendimento (R$)')}
   {field('minutes','Duração real estimada (minutos)','1')}
   {field('hourCost','Custo da hora do profissional (R$)')}
   {field('fixedMonthly','Despesas fixas mensais a ratear (R$)')}
   {field('appointmentsMonthly','Atendimentos mensais usados no rateio','1')}
   {field('otherFixed','Outros custos diretos por atendimento (R$)')}
   {field('taxPct','Impostos sobre preço de venda (%)')}
   {field('commissionPct','Repasses/comissões sobre preço de venda (%)')}
   {field('marginPct','Margem desejada sobre venda (%)')}
   {field('marketPrice','Preço atual ou preço para comparação (R$)')}
   {field('clinicPct','Parcela da clínica sobre valor após impostos e taxas (%)')}
  </div>
  <div className="form-section"><h4>Forma de recebimento</h4><div className="clinical-fields">
   <label>Pagamento<select value={method} onChange={e=>setMethod(e.target.value)}>
    <option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="transferencia">Transferência</option><option value="debito">Débito InfinitePay</option><option value="credito">Crédito InfinitePay</option>
   </select></label>
   {(method==='credito'||method==='debito')&&<>
    <label>Bandeira<select value={brand} onChange={e=>setBrand(e.target.value)}><option value="visa">Visa/Mastercard (tabela Visa estimada)</option><option value="outras">Outras bandeiras</option></select></label>
    <label>Faixa de faturamento<select value={tier} onChange={e=>setTier(e.target.value)}>{Object.entries(tiers).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>Recebimento<select value={plan} onChange={e=>setPlan(e.target.value)}><option value="dia">1 dia útil</option><option value="hora">Na hora</option></select></label>
   </>}
   {method==='credito'&&<label>Parcelas<select value={installments} onChange={e=>setInstallments(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}x</option>)}</select></label>}
  </div><p>Taxa de pagamento estimada: <strong>{paymentRate.toFixed(2).replace('.',',')}%</strong>. A taxa está incluída no cálculo, não é somada novamente.</p></div>
  {!quote?<p className="form-message" role="alert">Confira os valores: o número de atendimentos deve ser positivo, e a soma de taxas, repasses, impostos e margem deve ser inferior a 100%.</p>:<>
   <div className="detail-grid">
    <div className="detail-item"><span>Custo completo por atendimento</span><strong>{brl(quote.cost)}</strong></div>
    <div className="detail-item"><span>Preço mínimo para cobrir custos</span><strong>{brl(quote.minimum)}</strong></div>
    <div className="detail-item"><span>Preço sugerido para sua margem</span><strong>{brl(quote.suggested)}</strong></div>
    <div className="detail-item"><span>Resultado estimado no preço informado</span><strong>{quote.marketResult===null?'Informe um preço':brl(quote.marketResult)}</strong></div>
   </div>
   <p className="profile-notice">Custo: materiais {brl(quote.breakdown.materials)} + tempo profissional {brl(quote.breakdown.labor)} + rateio {brl(quote.breakdown.fixed)} + outros {brl(quote.breakdown.other)}. Margem é percentual sobre a venda, não acréscimo sobre custo. Os valores são estimativas gerenciais, não orientação tributária.</p>
  </>}
  {split&&Number(form.marketPrice)>0&&<div className="form-section"><h4>Distribuição estimada do preço informado</h4>
   <div className="detail-grid">
    <div className="detail-item"><span>Receita após impostos e taxa do pagamento</span><strong>{brl(split.afterDeductions)}</strong></div>
    <div className="detail-item"><span>Parcela da clínica, antes dos custos diretos</span><strong>{brl(split.clinicShare)}</strong></div>
    <div className="detail-item"><span>Parcela destinada ao profissional, antes de eventuais custos próprios</span><strong>{brl(split.professionalShare)}</strong></div>
    <div className="detail-item"><span>Resultado total após custos diretos</span><strong>{brl(split.combinedNet)}</strong></div>
   </div>
   <p className="profile-notice">Modelo de simulação: os custos diretos informados são descontados apenas uma vez no resultado total. A parcela da clínica é calculada sobre o valor após impostos e taxas, e não representa lucro líquido. Defina o contrato real de repasse antes de usar estes números para decisões.</p>
  </div>}
  {!split&&<p className="form-message" role="alert">Confira os percentuais de divisão de receita.</p>}
  <button type="button" className="outline-gold" onClick={()=>{setForm(initial);setMethod('pix');setInstallments(1);}}>Limpar simulação</button>
 </section>;
}
