import test from 'node:test';
import assert from 'node:assert/strict';
import {crmToday,crmPhoneDigits,crmValidBrazilianPhone,crmWhatsAppUrl,crmDueTasks} from '../src/crmUtils.js';

test('CRM usa a data local de São Paulo, não a data UTC',()=>{
 assert.equal(crmToday(new Date('2026-10-26T01:30:00.000Z')),'2026-10-25');
});
test('telefone com DDD brasileiro funciona, sem aceitar número estrangeiro ou curto',()=>{
 assert.equal(crmPhoneDigits('(45) 99832-7711'),'45998327711');
 assert.equal(crmValidBrazilianPhone('(45) 99832-7711'),true);
 assert.equal(crmValidBrazilianPhone('(45) 3232-1234'),true);
 assert.equal(crmValidBrazilianPhone('123'),false);
 assert.equal(crmValidBrazilianPhone('+595 981 123 456'),false);
 assert.equal(crmWhatsAppUrl('(45) 99832-7711'),'https://wa.me/5545998327711');
 assert.equal(crmWhatsAppUrl('telefone errado'),null);
});
test('lembretes de hoje e atrasados não incluem tarefas concluídas ou futuras',()=>{
 const tasks=[
 {situacao:'pendente',vencimento:'2026-10-24'},
 {situacao:'pendente',vencimento:'2026-10-25'},
 {situacao:'pendente',vencimento:'2026-10-26'},
 {situacao:'concluida',vencimento:'2026-10-24'}
 ];
 assert.equal(crmDueTasks(tasks,'2026-10-25').length,2);
});
