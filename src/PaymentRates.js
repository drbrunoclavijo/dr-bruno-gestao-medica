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

// Fonte: https://www.infinitepay.io/taxas (consulta 2026-10-17).
// Taxa Pix por QR Code/app/maquininha: 0%. Taxa débito varia por bandeira e plano.
// Valor "1 dia útil": taxas com antecipação da tabela principal da maquininha.
export const debitRates={
 visa:{inicial:1.37,vinte:0.85,quarenta:0.79,oitenta:0.75},
 outras:{inicial:2.58,vinte:2.08,quarenta:1.98,oitenta:1.88}
};
export const instantDebit=2.29;
export const paymentOptions=['pix','debito','credito','dinheiro','transferencia'];
export const paymentNames={pix:'Pix',debito:'Débito na InfinitePay',credito:'Crédito na InfinitePay',dinheiro:'Dinheiro',transferencia:'Transferência'};
export const rateForPayment=(method='credito',count=1,brand='visa',tier='inicial',plan='dia')=>{
 if(method==='pix'||method==='dinheiro'||method==='transferencia')return 0;
 if(method==='debito')return plan==='hora'?instantDebit:debitRates[brand][tier];
 return plan==='hora'?infinityInstant[count-1]:infinityRates[brand][tier][count-1];
};
// A decisão de repassar a taxa é livre em qualquer parcela.
// Sem repasse: cliente paga valor acordado e clínica absorve o desconto.
// Com repasse: gross-up para que o líquido estimado preserve o valor acordado.
export const quoteInfinity=(base,installments=1,brand='visa',tier='inicial',plan='dia',method='credito',passFee=false)=>{
 const count=method==='credito'?installments:1;
 const rate=rateForPayment(method,count,brand,tier,plan);
 if(!Number.isFinite(base)||base<=0||!Number.isInteger(count)||count<1||count>12||!Number.isFinite(rate)||rate<0||rate>=100)return null;
 const passed=Boolean(passFee)&&(method==='credito'||method==='debito');
 const gross=passed?Math.round(base/(1-rate/100)*100)/100:Math.round(base*100)/100;
 const fee=Math.round(gross*rate)/100;
 const net=Math.round(gross*100-fee*100)/100;
 return {rate,gross,fee,net,passed,absorbed:!passed,perInstallment:gross/count};
};
