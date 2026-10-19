import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const migration=readFileSync('supabase/migrations/PENDENTE_restringir_custos_estoque_teste.sql','utf8');
test('Bloqueio dos custos revoga tabela e coluna, mantendo consulta operacional',()=>{
 assert.match(migration,/REVOKE SELECT ON TABLE public\.estoque_lotes_teste FROM authenticated/);
 assert.match(migration,/REVOKE SELECT \(custo_total_aquisicao\)/);
 assert.match(migration,/has_column_privilege\('authenticated'/);
 assert.match(migration,/GRANT SELECT \(id,produto_id,lote,validade,saldo,quantidade_inicial,cadastrado_por,criado_em\)/);
});
test('RPC de custos valida perfil e ativo no servidor',()=>{
 assert.match(migration,/p\.ativo AND p\.perfil IN \('medico','enfermeira','administrativo'\)/);
 assert.match(migration,/REVOKE ALL ON FUNCTION public\.consultar_custos_lotes_teste\(\) FROM PUBLIC,anon/);
 assert.doesNotMatch(migration,/GRANT EXECUTE ON FUNCTION public\.consultar_custos_lotes_teste\(\) TO equipe/);
});
