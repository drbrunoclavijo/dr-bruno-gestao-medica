import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pricingQuote,splitProtocolRevenue} from '../src/PricingMath.js';

test('Preco minimo e margem sobre venda seguem gross-up',()=>{
 const q=pricingQuote({materials:100,minutes:60,hourCost:50,fixedMonthly:1000,appointmentsMonthly:100,taxPct:10,feePct:5,commissionPct:10,marginPct:25});
 assert.ok(q);assert.equal(q.cost,160);
 assert.ok(Math.abs(q.minimum-160/0.75)<0.001);
 assert.ok(Math.abs(q.suggested-320)<0.001);
});
test('Entrada invalida nao cria valor incorreto',()=>{
 assert.equal(pricingQuote({appointmentsMonthly:0}),null);
 assert.equal(pricingQuote({marginPct:90,taxPct:15}),null);
 assert.equal(pricingQuote({materials:-1}),null);
});
test('Precificacao acessivel apenas para tres perfis autorizados',()=>{
 const main=readFileSync('src/main.jsx','utf8');
 assert.match(main,/activeTab==='Precificação'&&\['medico','enfermeira','administrativo'\]\.includes\(profile\.perfil\)/);
 assert.match(main,/equipe:\['Visão geral','Agenda','Pacientes','Estoque'\]/);
 assert.match(main,/administrativo:\['Visão geral','Agenda','Pacientes','Estoque','Financeiro','Precificação','Auditoria'\]/);
 const component=readFileSync('src/PricingCalculator.jsx','utf8');
 assert.match(component,/\['medico','enfermeira','administrativo'\]\.includes\(role\)/);
 assert.doesNotMatch(component,/supabase\.from\(|supabase\.rpc\(/);
});

test('Distribuicao separa imposto, taxa, clinica e resultado sem duplicar custos',()=>{
 const v=splitProtocolRevenue({price:1000,materials:100,professionalCost:50,otherCost:25,taxPct:10,paymentPct:5,clinicPct:30});
 assert.equal(v.taxes,100);
 assert.equal(v.fees,50);
 assert.equal(v.afterDeductions,850);
 assert.equal(v.clinicShare,255);
 assert.equal(v.professionalShare,595);
 assert.equal(v.directCosts,175);
 assert.equal(v.combinedNet,675);
 assert.equal(splitProtocolRevenue({price:1000,clinicPct:101}),null);
});

test('Secretaria cadastra estoque sem acesso a precificacao ou detalhes de custos',()=>{
 const inventory=readFileSync('src/TestInventory.jsx','utf8');
 const main=readFileSync('src/main.jsx','utf8');
 assert.match(inventory,/canRegister=\['medico','enfermeira','equipe'\]/);
 assert.match(inventory,/showCosts=\['medico','enfermeira','administrativo'\]/);
 assert.match(inventory,/showCosts&&<p className="inventory-cost-overview">/);
 assert.match(main,/equipe:\['Visão geral','Agenda','Pacientes','Estoque'\]/);
});

test('Consulta da secretaria ao estoque nao solicita colunas de custo',()=>{
 const inventory=readFileSync('src/TestInventory.jsx','utf8');
 assert.match(inventory,/consultar_custos_lotes_teste/);
 assert.match(inventory,/\.select\('id,produto_id,lote,validade,saldo,quantidade_inicial'\)/);
 assert.match(inventory,/const knownValue=showCosts\?/);
});
