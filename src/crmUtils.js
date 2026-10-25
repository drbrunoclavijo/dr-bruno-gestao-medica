// Funções puras do CRM: sem dados clínicos, chamadas de rede ou efeitos colaterais.
export const crmToday=(now=new Date())=>{
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
};
export const crmPhoneDigits=value=>String(value||'').replace(/\D/g,'');
export const crmValidBrazilianPhone=value=>{
 const digits=crmPhoneDigits(value);
 // DDD 11-99 e número local com 8 ou 9 dígitos. Não valida existência da linha.
 return /^(?:[1-9][1-9])(?:[2-9]\d{7}|9\d{8})$/.test(digits);
};
export const crmWhatsAppUrl=value=>crmValidBrazilianPhone(value)?'https://wa.me/55'+crmPhoneDigits(value):null;
export const crmDueTasks=(tasks,today=crmToday())=>(tasks||[]).filter(t=>t.situacao==='pendente'&&t.vencimento<=today);
