import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
test('Diagnostico do estoque nao altera banco nem le dados operacionais',()=>{
 const sql=readFileSync('supabase/diagnostics/20261019_permissoes_estoque_somente_leitura.sql','utf8');
 assert.match(sql,/pg_policies/);assert.match(sql,/role_table_grants/);assert.match(sql,/rowsecurity/);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE)\s+(?:INTO|TABLE|FUNCTION|ON|FROM|POLICY)/i);
 assert.doesNotMatch(sql,/custo_total_aquisicao|paciente_id|cpf|email/);
});