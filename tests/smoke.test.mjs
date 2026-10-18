import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quoteInfinity,rateForPayment,infinityRates} from '../src/PaymentRates.js';

const asCents=n=>Math.round(n*100);
test('Pix, dinheiro e transferencia nao descontam taxa de maquina',()=>{
 for(const method of ['pix','dinheiro','transferencia']){
  const r=quoteInfinity(700,1,'visa','inicial','dia',method,false);
  assert.equal(r.gross,700);assert.equal(r.fee,0);assert.equal(r.net,700);
 }
});
test('Debito sem repasse desconta a taxa do valor acordado',()=>{
 const r=quoteInfinity(700,1,'visa','inicial','dia','debito',false);
 assert.equal(r.rate,1.37);assert.equal(r.gross,700);assert.equal(r.fee,9.59);
 assert.equal(r.net,690.41);
});
test('Credito 1x sem repasse preserva preco paciente e diminui liquido',()=>{
 const r=quoteInfinity(700,1,'visa','inicial','dia','credito',false);
 assert.equal(r.rate,3.15);assert.equal(r.gross,700);assert.equal(r.fee,22.05);
 assert.equal(r.net,677.95);
});
test('Credito 1x com repasse preserva liquido aproximado',()=>{
 const r=quoteInfinity(700,1,'visa','inicial','dia','credito',true);
 assert.equal(r.gross,722.77);assert.equal(r.fee,22.77);assert.equal(r.net,700);
});
test('Repassar ou absorver taxa funciona de 1 a 12 parcelas, todas as faixas',()=>{
 for(const brand of ['visa','outras'])for(const tier of Object.keys(infinityRates[brand]))
 for(const plan of ['dia','hora'])for(let n=1;n<=12;n++){
  for(const pass of [false,true]){
   const p=quoteInfinity(4490,n,brand,tier,plan,'credito',pass);
   assert.ok(p&&p.rate>0);
   assert.equal(p.rate,rateForPayment('credito',n,brand,tier,plan));
   assert.ok(Math.abs(asCents(p.gross-p.fee-p.net))<=1);
   assert.equal(p.passed,pass);
   assert.ok(pass?Math.abs(asCents(p.net-4490))<=1:p.gross===4490);
   assert.ok(p.perInstallment>0);
  }
 }
});
test('7x sem repasse nao acresce preco ao paciente',()=>{
 const r=quoteInfinity(7500,7,'visa','inicial','dia','credito',false);
 assert.equal(r.gross,7500);assert.ok(r.net<7500);
});
test('7x com repasse nao duplica taxa e nao da prejuizo estimado',()=>{
 const r=quoteInfinity(7500,7,'visa','inicial','dia','credito',true);
 assert.ok(r.gross>7500);assert.ok(Math.abs(r.net-7500)<=0.01);
});
test('Valores e parcelamentos invalidos sao rejeitados',()=>{
 for(const base of [0,-5,Number.NaN,Infinity])assert.equal(quoteInfinity(base,1),null);
 for(const count of [0,-1,13,1.5])assert.equal(quoteInfinity(100,count),null);
});
test('Acesso a relatorios e auditoria e checado no SQL, nao so menu',()=>{
 const files=[
  'supabase/migrations/20261120_relatorios_gerenciais_por_perfil_teste.sql',
  'supabase/migrations/20261121_painel_auditoria_geral_teste.sql'
 ];
 for(const file of files){
  const sql=readFileSync(file,'utf8');
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/auth\.uid\(\)/);
  assert.match(sql,/REVOKE ALL ON FUNCTION/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION/);
 }
 const main=readFileSync('src/main.jsx','utf8');
 assert.match(main,/Auditoria'&&\['medico','administrativo'\]\.includes\(profile\.perfil\)/);
 assert.match(main,/Relatórios'&&\['medico','enfermeira'\]/);
});
test('O registro da taxa usa pagamento existente, sem segunda venda',()=>{
 const sql=readFileSync('supabase/migrations/20261118_taxas_reais_pagamento_financeiro_teste.sql','utf8');
 assert.match(sql,/public\.registrar_pagamento_receber_teste\(/);
 assert.match(sql,/PRIMARY KEY REFERENCES public\.pagamentos_receber_teste\(id\)/);
 assert.match(sql,/INSERT INTO public\.taxas_pagamentos_teste/);
});
test('Registros Carol e Bruno tem verificacao de perfis independentes',()=>{
 const sql=readFileSync('supabase/migrations/20261119_repasse_opcional_taxa_teste.sql','utf8');
 assert.match(sql,/perfil='medico'/);
 assert.match(sql,/perfil='enfermeira'/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.validar_repasse_maquininha_teste/);
});

test('Relatorios nao devem excluir consultas faturadas nem duplicar protocolos',()=>{
 const sql=readFileSync('supabase/migrations/20261122_corrigir_relatorio_consultas_teste.sql','utf8');
 assert.match(sql,/FROM public.contas_receber_teste c/);
 assert.match(sql,/c\.protocolo_id IS NULL/);
 assert.match(sql,/c\.criado_por=auth\.uid\(\)/);
 assert.match(sql,/FROM public.protocolos_teste pr/);
 assert.match(sql,/NULL::numeric,NULL::numeric/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});
test('Estoque realiza baixa de insumos durante checagem em transacao do banco',()=>{
 const sql=readFileSync('supabase/migrations/20261027_insumos_estoque_checagem_teste.sql','utf8');
 assert.match(sql,/CREATE TRIGGER baixar_insumos_checagem_teste AFTER INSERT ON public.administracoes_teste/);
 assert.match(sql,/IF v_saldo<v_ins.quantidade THEN/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/UPDATE public.estoque_lotes_teste SET saldo=saldo-v_retirada/);
 assert.match(sql,/INSERT INTO public.insumos_movimentos_teste/);
});
test('Protecoes de autenticacao da integração sao so leitura',()=>{
 const source=readFileSync('tests/supabase.integration.test.mjs','utf8');
 assert.match(source,/persistSession:false/);
 assert.match(source,/signInWithPassword/);
 for(const method of ['.insert(','.delete(','.update(','.upsert(']){
  assert.ok(!source.includes(method),'Os testes autenticados não devem modificar dados: '+method);
 }
 for(const role of ['medico','enfermeira','equipe'])assert.ok(source.includes(role));
});

test('Gerente standby tem financeiro e auditoria sem acesso clinico',()=>{
 const main=readFileSync('src/main.jsx','utf8');
 const sql=readFileSync('supabase/migrations/20261123_perfil_gerente_administrativo_standby_teste.sql','utf8');
 assert.match(main,/administrativo:\['Visão geral','Agenda','Pacientes','Estoque','Financeiro','Auditoria'\]/);
 assert.match(main,/Auditoria'&&\['medico','administrativo'\]\.includes\(profile\.perfil\)/);
 assert.ok(!main.includes("administrativo:['Prescrições'"));
 assert.match(sql,/perfil IN \('medico','administrativo'\)/);
 assert.match(sql,/SECURITY DEFINER/);
 assert.match(sql,/CREATE POLICY pacientes_administrativo_ler_teste/);
 assert.match(sql,/listar_protocolos_financeiro_admin_teste/);
 assert.ok(!sql.includes('INSERT INTO public.profissionais('),'Nao ativar usuario automatico');
});

test('SQL do gerente reconhece tambem a verificacao p.perfil=equipe em pendencias',()=>{
 const sql=readFileSync('supabase/migrations/20261123_perfil_gerente_administrativo_standby_teste.sql','utf8');
 const base=readFileSync('supabase/migrations/20261110_fluxo_respostas_whatsapp_simulado_teste.sql','utf8');
 assert.match(base,/p\.perfil='equipe'/);
 assert.match(sql,/v_perfil\|p\\\\\.perfil/);
 assert.match(sql,/listar_pendencias_agenda_teste/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.listar_pendencias_agenda_teste\(\)/);
 assert.match(sql,/p\.perfil IN \('equipe','administrativo'\)/);
 assert.ok(!sql.includes("'resolver_pendencia_ao_reagendar_teste'\n ]"),'Trigger nao deve ser reescrito como RPC de agenda');
});

test('Calendario mensal tem isolamento de profissional e detalhes por dia',()=>{
 const cal=readFileSync('src/AppointmentCalendar.jsx','utf8');
 const app=readFileSync('src/ClinicCalendar.jsx','utf8');
 assert.match(cal,/listar_agendamentos_teste/);
 assert.match(cal,/role=>\['equipe','administrativo'\]\.includes\(role\)/);
 assert.match(cal,/a\.profissional_id===scope/);
 assert.match(cal,/a\.paciente_nome/);
 assert.match(cal,/setSelected\(d\)/);
 assert.match(app,/AppointmentCalendar/);
});
test('Confirmacao automatica permanece em rascunho sem API externa',()=>{
 const sql=readFileSync('supabase/migrations/20261124_agenda_whatsapp_rascunhos_sem_envio_teste.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.agenda_mensagens_rascunho_teste/);
 assert.match(sql,/AFTER INSERT OR UPDATE OF inicio,profissional_id,paciente_id,status/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 assert.match(sql,/REVOKE ALL ON public\.agenda_mensagens_rascunho_teste FROM PUBLIC,anon,authenticated/);
 assert.ok(!sql.includes('http_post'),'Nenhum envio HTTP na trigger');
 assert.match(sql,/NEW\.status='agendado'/);
});
test('Interface pode ser aberta em navegadores móveis',()=>{
 const html=readFileSync('index.html','utf8');
 const css=readFileSync('src/style.css','utf8');
 assert.match(html,/name="viewport" content="width=device-width, initial-scale=1(?:, viewport-fit=cover)?"/);
 assert.match(css,/@media\(max-width:650px\)/);
});

test('PWA publica manifesto, icone e registro sem armazenar dados clinicos offline',()=>{
 const manifest=JSON.parse(readFileSync('public/manifest.webmanifest','utf8'));
 const html=readFileSync('index.html','utf8');
 const sw=readFileSync('public/service-worker.js','utf8');
 const reg=readFileSync('src/registerPwa.js','utf8');
 assert.equal(manifest.display,'standalone');
 assert.ok(manifest.icons.length>0);
 for(const icon of manifest.icons)assert.ok(readFileSync('public'+icon.src).length>10);
 assert.match(html,/rel="manifest"/);
 assert.match(reg,/serviceWorker\.register/);
 assert.ok(!sw.includes("caches.open("),'Evitar caching de dados de pacientes');
 assert.ok(!sw.includes("addEventListener('fetch'"),'PWA deve continuar online-only');
});

test('Cabecalho e navegacao sao centralizados somente na tela mobile',()=>{
 const css=readFileSync('src/style.css','utf8');
 const section=css.slice(css.lastIndexOf('/* Alinhamento central do cabeçalho'));
 assert.match(section,/@media \(max-width: 767px\)/);
 assert.match(section,/main > header\{/);
 assert.match(section,/flex-direction:column/);
 assert.match(section,/main > nav\{/);
 assert.match(section,/justify-content:center/);
 assert.match(section,/main > \.session\{/);
});

test('Ficha integrada respeita secoes por perfil e fontes de dados',()=>{
 const main=readFileSync('src/main.jsx','utf8');
 const journey=readFileSync('src/PatientJourney.jsx','utf8');
 assert.match(main,/patientSectionsFor\(role\)/);
 assert.match(main,/PatientJourney key=/);
 assert.match(journey,/\['acompanhamento','Agenda e retornos'\]/);
 assert.match(journey,/role==='medico'\?/);
 assert.match(journey,/role==='enfermeira'\?/);
 assert.match(journey,/listar_agendamentos_teste/);
 assert.match(journey,/protocolos_operacionais_enfermagem_teste/);
 assert.match(journey,/listar_protocolos_com_insumos_teste/);
 assert.match(journey,/if\(a\.paciente_id===patientId\)/);
 assert.match(journey,/p=>p\.paciente_id===patientId/);
});

test('Ficha unificada preserva isolamento entre medico, enfermagem e administracao',()=>{
 const dashboard=readFileSync('src/PatientOverview.jsx','utf8');
 const main=readFileSync('src/main.jsx','utf8');
 assert.match(main,/PatientOverview/);
 assert.match(dashboard,/if\(clinical\(role\)\)\{/);
 assert.match(dashboard,/if\(role==='enfermeira'\)\{/);
 assert.match(dashboard,/listar_agendamentos_teste/);
 assert.match(dashboard,/\.filter\(a=>a\.paciente_id===patientId\)/);
 for(const resource of ['consultas_teste','prescricoes_teste','listar_protocolos_com_insumos_teste'])assert.ok(dashboard.includes(resource));
 assert.match(dashboard,/role==='medico'/);
 assert.ok(!dashboard.includes('sessionStorage'),'Dados clinicos nao devem ser armazenados em sessao');
 assert.ok(!dashboard.includes('localStorage'),'Dados clinicos nao devem ser armazenados localmente');
 assert.ok(!dashboard.includes('listar_protocolos_financeiro_admin_teste'),'Ficha admin nao solicita dados financeiros');
});

test('Atalhos da ficha apontam a secoes existentes e obedecem ao perfil',()=>{
 const main=readFileSync('src/main.jsx','utf8');
 const journey=readFileSync('src/PatientJourney.jsx','utf8');
 const css=readFileSync('src/style.css','utf8');
 assert.match(main,/patient-quick-access/);
 assert.match(main,/href=\{'#paciente-'\+id\}/);
 assert.match(journey,/role==='medico'\?\[\['prontuario'/);
 assert.match(journey,/role==='enfermeira'\?\[\['protocolos'/);
 assert.match(journey,/id="paciente-protocolos"/);
 assert.match(main,/id="paciente-cadastro"/);
 assert.match(main,/id="paciente-prescricoes"/);
 assert.match(main,/id="paciente-documentos"/);
 assert.match(main,/id="paciente-administracoes"/);
 assert.match(css,/patient-quick-access \.patient-section-nav/);
});

test('Previa de receita e evolucao nao finge assinatura digital ou envio',()=>{
 const draft=readFileSync('src/DocumentPreparation.jsx','utf8');
 const rx=readFileSync('src/TestPrescriptions.jsx','utf8');
 const record=readFileSync('src/ClinicalRecord.jsx','utf8');
 assert.match(rx,/DocumentPreparation kind="receita"/);
 assert.match(record,/DocumentPreparation kind="evolucao"/);
 assert.match(draft,/NÃO ASSINADO DIGITALMENTE/);
 assert.match(draft,/Assinar com Bird ID — em preparação/);
 assert.match(draft,/Enviar pelo WhatsApp — indisponível/);
 assert.match(draft,/disabled title="Aguardando credenciais Bird ID/);
 assert.match(draft,/disabled title="Disponível somente para PDF assinado/);
 assert.ok(!draft.includes('localStorage'),'Não armazenar documentos clinicos no navegador');
 assert.ok(!draft.includes('fetch('),'Nenhum envio externo de documentos');
});
