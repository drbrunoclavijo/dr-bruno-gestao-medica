import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(path,'utf8');

test('Encerramento exige autenticação, papel médico e vínculo explícito',()=>{
 const sql=read('supabase/migrations/20261019_encerramento_consulta_teste.sql');
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(sql,/p\.perfil='medico'/);
 assert.match(sql,/v_cons\.agendamento_id IS DISTINCT FROM v_ag\.id/);
 assert.match(sql,/v_cons\.paciente_id<>v_ag\.paciente_id/);
 assert.match(sql,/v_cons\.profissional_id<>auth\.uid\(\)/);
 assert.match(sql,/nullif\(btrim\(coalesce\(v_cons\.evolucao/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/UNIQUE REFERENCES public\.agendamentos_teste/);
 assert.match(sql,/INSERT INTO public\.agendamentos_auditoria_teste/);
});

test('Agenda não permite concluir consultas pela alteração genérica de status',()=>{
 const sql=read('supabase/migrations/20261019_bloquear_finalizacao_direta_agenda_teste.sql');
 assert.match(sql,/p_status='realizado' AND v_tipo IN \('consulta','retorno'\)/);
 const calendar=read('src/ClinicCalendar.jsx');
 assert.match(calendar,/!\['consulta','retorno'\]\.includes\(a\.tipo\)/);
});

test('Interface encerra consulta vinculada por RPC e não marca como assinada',()=>{
 const form=read('src/ClinicalRecord.jsx');
 const end=read('src/VisitFinalization.jsx');
 assert.match(form,/payload\.agendamento_id=appointment\.appointmentId/);
 assert.match(end,/encerrar_consulta_teste/);
 assert.match(end,/linked\.length!==1/);
 assert.match(end,/p_consulta_id:linked\[0\]\.id/);
 assert.doesNotMatch(end,/status_assinatura='assinada'/);
});

test('Vínculo clínico com agenda é validado no servidor antes de salvar',()=>{
 const sql=read('supabase/migrations/20261019_validar_vinculo_consulta_agenda_teste.sql');
 assert.match(sql,/BEFORE INSERT ON public\.consultas_teste/);
 assert.match(sql,/v_ag\.paciente_id IS DISTINCT FROM NEW\.paciente_id/);
 assert.match(sql,/v_ag\.profissional_id IS DISTINCT FROM NEW\.profissional_id/);
 assert.match(sql,/v_ag\.tipo NOT IN \('consulta','retorno'\)/);
 assert.match(sql,/v_ag\.status NOT IN \('agendado','confirmado'\)/);
 assert.match(sql,/AT TIME ZONE 'America\/Sao_Paulo'/);
});

test('Erro de encerramento nao esconde controles da revisao e permite nova tentativa',()=>{
 const src=read('src/VisitFinalization.jsx');
 assert.match(src,/\[finishError,setFinishError\]=useState\(''\)/);
 assert.match(src,/setFinishError\('Não foi possível encerrar a consulta:/);
 assert.match(src,/\{finishError&&<p className="form-message" role="alert">/);
 assert.match(src,/setFinishError\(''\);/);
});

test('Confirmacao de encerramento exige retorno consistente do banco',()=>{
 const src=read('src/VisitFinalization.jsx');
 const sql=read('supabase/migrations/20261019_consultar_encerramento_consulta_teste.sql');
 assert.match(src,/consultar_encerramento_consulta_teste/);
 assert.match(src,/details\.status!=='realizado'/);
 assert.match(src,/details\.agendamento_id!==appointment\.appointmentId/);
 assert.match(src,/details\.consulta_id!==linked\[0\]\.id/);
 assert.match(sql,/e\.medico_id=auth\.uid\(\)/);
 assert.match(sql,/a\.profissional_id=auth\.uid\(\)/);
});
