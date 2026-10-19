// Cálculo exclusivamente local, sem persistência ou alterações financeiras.
export function pricingQuote({materials=0,minutes=0,hourCost=0,fixedMonthly=0,appointmentsMonthly=1,otherFixed=0,taxPct=0,feePct=0,commissionPct=0,marginPct=20,marketPrice=0}={}){
 const vals=[materials,minutes,hourCost,fixedMonthly,appointmentsMonthly,otherFixed,taxPct,feePct,commissionPct,marginPct,marketPrice].map(Number);
 if(vals.some(v=>!Number.isFinite(v)||v<0)||appointmentsMonthly<=0||minutes>1440)return null;
 const [mat,duration,hour,fixed,volume,other,tax,fee,commission,margin,market]=vals;
 const cost=mat+duration/60*hour+fixed/volume+other;
 const deductions=(tax+fee+commission)/100;
 const target=margin/100;
 if(deductions>=1||deductions+target>=1)return null;
 const minimum=cost/(1-deductions);
 const suggested=cost/(1-deductions-target);
 const resultAtMarket=market>0?market*(1-deductions)-cost:null;
 return {cost,minimum,suggested,profit:suggested*(1-deductions)-cost,marketResult:resultAtMarket,
  breakdown:{materials:mat,labor:duration/60*hour,fixed:fixed/volume,other},
  deductionsPct:deductions*100,marginPct:margin};
}

/** Simula distribuição financeira sem confundir repasse com despesa duplicada.
 * percentual de clinica aplica-se sobre receita liquida de impostos/taxas, antes
 * dos custos diretos. Custos sao subtraidos apenas uma vez.
 */
export function splitProtocolRevenue({price=0,materials=0,professionalCost=0,otherCost=0,taxPct=0,paymentPct=0,clinicPct=0}={}){
 const a=[price,materials,professionalCost,otherCost,taxPct,paymentPct,clinicPct].map(Number);
 if(a.some(x=>!Number.isFinite(x)||x<0)||taxPct+paymentPct>=100||clinicPct>100)return null;
 const [gross,mat,work,other,taxRate,feeRate,clinicRate]=a;
 const taxes=gross*taxRate/100,fees=gross*feeRate/100;
 const afterDeductions=gross-taxes-fees;
 const clinicShare=afterDeductions*clinicRate/100;
 const professionalShare=afterDeductions-clinicShare;
 const directCosts=mat+work+other;
 return {gross,taxes,fees,afterDeductions,clinicShare,professionalShare,directCosts,
  clinicNetAfterCosts:clinicShare-directCosts,combinedNet:afterDeductions-directCosts};
}
