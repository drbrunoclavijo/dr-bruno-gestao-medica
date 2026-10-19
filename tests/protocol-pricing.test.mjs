import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {protocolTotals} from '../src/ProtocolPricingMath.js';
import {pricingQuote} from '../src/PricingMath.js';

test('Custo por item e sessao soma medicamentos insumos tempo e rateio',()=>{
 const r=protocolTotals([{sessions:6,quantity:2,unitCost:15},{sessions:3,quantity:1,unitCost:40}],6,30,100,1000,100);
 assert.deepEqual(r,{supplies:300,labor:300,fixed:60,total:660});
 const q=pricingQuote({materials:r.supplies,otherFixed:r.labor+r.fixed,marginPct:25,taxPct:10,feePct:5});
 assert.ok(Math.abs(q.suggested-1100)<1e-8);
});

test('Valida dados inconsistentes e volumes nulos',()=>{
 assert.equal(protocolTotals([{sessions:-1,quantity:1,unitCost:2}],3),null);
 assert.equal(protocolTotals([{sessions:1,quantity:1,unitCost:2}],3,30,60,200,0),null);
 assert.equal(protocolTotals([{sessions:2.5,quantity:1,unitCost:2}],3),null);
});
test('Aba de precificacao inclui simulador sem acesso ao banco',()=>{
 const screen=readFileSync('src/PricingCalculator.jsx','utf8');
 const protocol=readFileSync('src/ProtocolPricingSimulator.jsx','utf8');
 assert.match(screen,/ProtocolPricingSimulator/);
 assert.match(protocol,/protocolTotals/);
 assert.ok(!protocol.includes('supabase.rpc('));
 assert.match(protocol,/supabase\.from\('estoque_lotes_teste'\)/);
 assert.match(protocol,/rateForPayment/);
});
