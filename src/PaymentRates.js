// Taxas publicadas pela InfinitePay em 2026 — Maquininha/InfiniteTap.
// No plano 1 dia util, os indices incluem antecipacao conforme tabela oficial.
// Nao sao cobrancas nem taxas contratuais garantidas; confirme no app do estabelecimento.
export const infinityRates={
 visa:{
  inicial:[3.15,5.39,6.12,6.85,7.57,8.28,8.99,9.69,10.38,11.06,11.74,12.40],
  vinte:[2.89,4.22,4.83,5.44,6.05,6.64,7.24,7.82,8.41,8.98,9.56,10.12],
  quarenta:[2.79,4.08,4.65,5.21,5.77,6.32,6.87,7.42,7.96,8.49,9.03,9.56],
  oitenta:[2.69,3.94,4.46,4.98,5.49,5.99,6.51,6.99,7.51,7.99,8.49,8.99]
 },
 outras:{
  inicial:[4.91,6.47,7.20,7.92,8.63,9.33,10.03,10.72,11.41,12.08,12.75,13.41],
  vinte:[4.65,6.09,6.69,7.28,7.87,8.46,9.05,9.63,10.20,10.76,11.33,11.88],
  quarenta:[4.56,5.95,6.50,7.05,7.60,8.15,8.69,9.23,9.76,10.29,10.81,11.33],
  oitenta:[4.46,5.81,6.32,6.83,7.33,7.83,8.34,8.83,9.32,9.81,10.29,10.77]
 }
};
export const infinityInstant=[5.49,10.89,11.99,12.59,13.29,13.99,14.99,15.59,16.19,16.89,17.89,18.29];
export const tiers={inicial:'Até R$ 20 mil/mês',vinte:'R$ 20–40 mil/mês',quarenta:'R$ 40–80 mil/mês',oitenta:'Acima de R$ 80 mil/mês'};
export const ratePct=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';

export const quoteInfinity=(base,installments,brand='visa',tier='inicial',plan='dia')=>{
 const rate=installments<=6?0:(plan==='hora'?infinityInstant[installments-1]:infinityRates[brand][tier][installments-1]);
 if(!Number.isFinite(base)||base<=0||!Number.isInteger(installments)||installments<1||installments>12||!Number.isFinite(rate))return null;
 const gross=installments<=6?Math.round(base*100)/100:Math.round(base/(1-rate/100)*100)/100;
 return {rate,gross,fee:Math.round((gross-base)*100)/100,perInstallment:gross/installments};
};
