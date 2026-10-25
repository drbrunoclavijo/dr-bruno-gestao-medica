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
 assert.match(main,/administrativo:\['Visão geral','Agenda','Pacientes','Estoque','Financeiro','Auditoria'(?:,'CRM')?\]/);
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

test('Receita domiciliar permanece separada e nao assinada',()=>{
 const rx=readFileSync('src/HomePrescriptions.jsx','utf8');
 const migration=readFileSync('supabase/migrations/20261018_receitas_domiciliares_teste.sql','utf8');
 const main=readFileSync('src/main.jsx','utf8');
 assert.match(main,/HomePrescriptions/);
 assert.match(rx,/salvar_receita_domiciliar_teste/);
 assert.match(rx,/DocumentPreparation kind="domiciliar"/);
 assert.match(rx,/SEM assinatura Bird ID/);
 assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
 assert.match(migration,/medico_id=auth\.uid\(\)/);
 assert.match(migration,/p\.perfil='medico'/);
 assert.match(migration,/CHECK\(status_assinatura='nao_assinada'\)/);
 assert.ok(!migration.includes('http_post'),'Sem envio por WhatsApp na receita');
});
test('Termos clinicos tem finalidade distinta e impressao sem consentimento automatico',()=>{
 const terms=readFileSync('src/PatientTerms.jsx','utf8');
 const main=readFileSync('src/main.jsx','utf8');
 const journey=readFileSync('src/PatientJourney.jsx','utf8');
 assert.match(main,/PatientTerms/);
 assert.match(main,/id="paciente-receitas"/);
 assert.match(journey,/\['termos','Termos'\]/);
 assert.match(terms,/imagem-assistencia/);
 assert.match(terms,/imagem-divulgacao/);
 assert.match(terms,/injetaveis/);
 assert.match(terms,/offlabel/);
 assert.match(terms,/medicamentos injetáveis/);
 assert.match(terms,/NÃO COMPROVA CONSENTIMENTO/);
 assert.match(terms,/window\.print\(\)/);
 assert.ok(!terms.includes('supabase.from('),'O termo nao deve gravar consentimento automatico');
});

test('PDF de teste pode ser exportado e arquivado em bucket privado sem afirmar assinatura',async ()=>{
 const {generateUnsignedPdf}=await import('../src/UnsignedPdf.js');
 const pdf=generateUnsignedPdf({title:'Receita domiciliar',patientName:'Paciente Fictício',professionalName:'Dr. Bruno Clavijo',date:'18/10/2026',sections:[{title:'Medicamento',content:'Dose e posologia ilustrativas, sem prescrição real.'}]});
 assert.equal(pdf.type,'application/pdf');
 const contents=await pdf.text();
 assert.ok(contents.startsWith('%PDF-1.4'));
 assert.match(contents,/NAO ASSINADO/);
 assert.match(contents,/xref/);
 assert.match(contents,/startxref/);
 assert.ok(pdf.size>300);
 const preparation=readFileSync('src/DocumentPreparation.jsx','utf8');
 assert.match(preparation,/Baixar PDF não assinado/);
 assert.match(preparation,/Salvar PDF no aplicativo/);
 assert.match(preparation,/registrar_documento_paciente_teste/);
 assert.match(preparation,/documentos-pacientes-teste/);
 assert.match(preparation,/p_categoria:'outro'/);
 assert.match(preparation,/Assinar com Bird ID — em preparação/);
 assert.match(preparation,/Enviar pelo WhatsApp — indisponível/);
 for(const moduleName of ['HomePrescriptions','TestPrescriptions','ClinicalRecord']){
  const view=readFileSync('src/'+moduleName+'.jsx','utf8');
  assert.match(view,/patientId=\{patientId\} supabase=\{supabase\}/);
 }
});

test('Todos os termos e receitas exibem identificacao profissional e contato oficial',async ()=>{
 const identity=await import('../src/ClinicIdentity.js');
 assert.equal(identity.CLINIC_IDENTITY.crm,'CRM/PR 34466');
 assert.equal(identity.CLINIC_IDENTITY.phone,'(45) 99832-7711');
 assert.match(identity.CLINIC_IDENTITY.address,/Rua Quito, 145, Beverly Falls Park/);
 const terms=readFileSync('src/PatientTerms.jsx','utf8');
 const preview=readFileSync('src/DocumentPreparation.jsx','utf8');
 const generator=readFileSync('src/UnsignedPdf.js','utf8');
 assert.match(terms,/terms-professional-crm/);
 assert.match(terms,/terms-paper-footer/);
 assert.match(terms,/CLINIC_IDENTITY.crm/);
 assert.match(terms,/CLINIC_IDENTITY.address/);
 assert.match(preview,/document-clinic-contact/);
 assert.match(preview,/CLINIC_IDENTITY.phone/);
 assert.match(generator,/CLINIC_IDENTITY.address/);
 assert.match(generator,/CLINIC_IDENTITY.phone/);
 const {generateUnsignedPdf}=await import('../src/UnsignedPdf.js');
 const pdf=generateUnsignedPdf({title:'Receita domiciliar',patientName:'Paciente Exemplo',professionalName:'Dr. Bruno Clavijo',date:'18/10/2026',sections:[]});
 const body=await pdf.text();
 assert.ok(body.includes('CRM/PR 34466'));
 assert.match(body,/Rua Quito, 145/);
 assert.match(body,/99832-7711/);
});

test('Receitas de teste identificam CPF e endereco e nao liberam controlados', async()=>{
 const {patientIdentification}=await import('../src/PatientPrescriptionIdentity.js');
 const id=patientIdentification({cpf:'52998224725',logradouro:'Rua Exemplo',numero:'12',bairro:'Centro',cidade:'Foz do Iguaçu',uf:'PR'});
 assert.equal(id.cpf,'529.982.247-25');
 assert.match(id.address,/Rua Exemplo, 12/);
 const {generateUnsignedPdf}=await import('../src/UnsignedPdf.js');
 const pdf=generateUnsignedPdf({title:'Rascunho',patientName:'Paciente ficticio',patientCpf:id.cpf,patientAddress:id.address,professionalName:'Dr. Bruno Clavijo',date:'18/10/2026',sections:[]});
 const data=await pdf.text();
 assert.ok(data.includes('529.982.247-25'));
 assert.ok(data.includes('Rua Exemplo, 12'));
 assert.ok(data.includes('NAO ASSINADO'));
 const preview=readFileSync('src/DocumentPreparation.jsx','utf8');
 assert.match(preview,/CPF do paciente/);
 assert.match(preview,/Endereço do paciente/);
 assert.match(preview,/RECEITUÁRIO CONTROLADO NÃO HABILITADO/);
 const plans=readFileSync('docs/bird-id-assinatura-e-receituario-controlado-homologacao.md','utf8');
 assert.match(plans,/PKCE S256/);
 assert.match(plans,/NÃO CONECTADO, NÃO ASSINADO, NÃO HOMOLOGADO/);
 assert.match(plans,/SNCR/);
});

test('Agenda inicia somente consulta do proprio medico e prepara rascunho sem gravar',()=>{
 const calendar=readFileSync('src/ClinicCalendar.jsx','utf8');
 const month=readFileSync('src/AppointmentCalendar.jsx','utf8');
 const main=readFileSync('src/main.jsx','utf8');
 const clinical=readFileSync('src/ClinicalRecord.jsx','utf8');
 assert.match(calendar,/role==='medico'&&a\.profissional_id===userId/);
 assert.match(month,/role==='medico'&&a\.profissional_id===userId/);
 assert.match(calendar,/onOpenClinical\?\.\(a\)/);
 assert.match(month,/onOpenClinical\?\.\(a\)/);
 assert.match(main,/appointment\.profissional_id!==session\.user\.id/);
 assert.match(main,/setClinicalTarget\(\{patientId:appointment\.paciente_id/);
 assert.match(main,/setTab\('Pacientes'\)/);
 assert.match(main,/clinicalTarget\?\.patientId===selected\.id/);
 assert.match(clinical,/setShowForm\(true\)/);
 assert.match(clinical,/data_consulta:appointment\.date/);
 assert.match(clinical,/O status da agenda não é alterado automaticamente/);
 assert.ok(!clinical.includes('atualizar_status_agendamento_teste'),'Salvar consulta não deve concluir agenda automaticamente');
});

test('Fluxo integrado abre os formularios existentes sem concluir nem assinar',()=>{
 const flow=readFileSync('src/ClinicalWorkflow.jsx','utf8');
 const app=readFileSync('src/main.jsx','utf8');
 const clinical=readFileSync('src/ClinicalRecord.jsx','utf8');
 const home=readFileSync('src/HomePrescriptions.jsx','utf8');
 const injectable=readFileSync('src/TestPrescriptions.jsx','utf8');
 assert.match(app,/role==='medico'&&<ClinicalWorkflow/);
 assert.match(app,/patientId:selectedId,step,sequence:old.sequence\+1/);
 assert.match(app,/workflowChoice\.patientId===selected\.id/);
 assert.match(app,/scrollIntoView/);
 for(const key of ['consulta','domiciliar','aplicacoes','finalizacao'])assert.match(flow,new RegExp("key:'"+key+"'"));
 for(const target of ['paciente-prontuario','paciente-receitas','paciente-prescricoes','paciente-documentos'])
  assert.ok(flow.includes(target));
 assert.match(clinical,/if\(workflowRequest>0&&canWrite\)setShowForm\(true\)/);
 assert.match(home,/if\(workflowRequest>0\)setOpen\(true\)/);
 assert.match(injectable,/if\(workflowRequest>0&&canWrite\)setOpen\(true\)/);
 assert.ok(!flow.includes('supabase.rpc('),'Guia nao modifica o backend');
 assert.ok(!flow.includes('window.location'),'Fluxo nao deve trocar de pagina');
 assert.match(flow,/Não há prescrição, salvamento, assinatura, envio ou conclusão automática/);
});

test('Finalizacao assistida le registros reais sem registrar fechamento clinico', async()=>{
 const flow=readFileSync('src/ClinicalWorkflow.jsx','utf8');
 const finalization=readFileSync('src/VisitFinalization.jsx','utf8');
 const main=readFileSync('src/main.jsx','utf8');
 assert.match(flow,/VisitFinalization supabase=\{supabase\} patientId=\{patientId\}/);
 assert.match(flow,/activeStep==='finalizacao'/);
 assert.match(main,/patientId=\{selected.id\} supabase=\{supabase\} appointment=/);
 for(const table of ['consultas_teste','receitas_domiciliares_teste','prescricoes_teste','documentos_pacientes_teste'])
  assert.ok(finalization.includes("supabase.from('"+table+"')"));
 assert.match(finalization,/sameDay\(x.data_consulta,day\)/);
 assert.match(finalization,/sameDay\(x.criado_em,day\)/);
 assert.match(finalization,/checks.every\(x=>confirmed\[x.id\]\)/);
 assert.match(finalization,/!summary.clinical/);
 assert.match(finalization,/status_assinatura!=='assinada'/);
 assert.match(finalization,/NÃO encerra o agendamento/);
 assert.ok(!finalization.includes('supabase.rpc('),'A finalizacao de teste nao grava alteracoes via RPC');
 assert.ok(!finalization.includes('.insert('),'A revisao nao grava documentos');
 assert.ok(!finalization.includes('.update('),'A revisao nao atualiza agendamentos');
 assert.match(finalization,/export function summarizeVisit/);
});
