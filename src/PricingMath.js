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
