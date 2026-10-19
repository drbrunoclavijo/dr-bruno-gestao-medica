-- Diagnóstico SOMENTE LEITURA, dados exclusivamente fictícios.
-- Execute no SQL Editor do mesmo projeto e envie apenas os resultados.
-- Não exibe pacientes, medicamentos, quantidades, preços, chaves ou identidades.
WITH objects AS (
 SELECT 'estoque_produtos_teste'::text name UNION ALL
 SELECT 'estoque_lotes_teste' UNION ALL
 SELECT 'profissionais'
), cols AS (
 SELECT table_name,column_name,data_type
 FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('estoque_produtos_teste','estoque_lotes_teste','profissionais')
), tbl AS (
 SELECT table_name,rowsecurity
 FROM (SELECT c.relname AS table_name,c.relrowsecurity AS rowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public') t
)
SELECT 'tabela' AS categoria, o.name AS objeto,
       CASE WHEN to_regclass('public.'||o.name) IS NULL THEN 'AUSENTE'
            ELSE CASE WHEN coalesce(tbl.rowsecurity,false) THEN 'EXISTE, RLS LIGADA' ELSE 'EXISTE, RLS DESLIGADA' END END AS detalhe
FROM objects o LEFT JOIN tbl ON tbl.table_name=o.name
UNION ALL
SELECT 'coluna',c.table_name||'.'||c.column_name,c.data_type FROM cols c
UNION ALL
SELECT 'politica',p.tablename||'.'||p.policyname,
       'comando='||p.cmd||'; roles='||array_to_string(p.roles,',')
FROM pg_policies p WHERE p.schemaname='public'
 AND p.tablename IN ('estoque_produtos_teste','estoque_lotes_teste','profissionais')
UNION ALL
SELECT 'permissao',t.table_name||'.'||t.privilege_type,
       'papel='||t.grantee
FROM information_schema.role_table_grants t
WHERE t.table_schema='public'
 AND t.table_name IN ('estoque_produtos_teste','estoque_lotes_teste')
 AND t.grantee IN ('anon','authenticated','PUBLIC')
UNION ALL
SELECT 'funcao',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
       'security_definer='||p.prosecdef::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
AND p.proname IN ('criar_produto_estoque_teste','criar_insumo_estoque_teste',
 'adicionar_lote_estoque_teste','definir_estoque_minimo_teste')
ORDER BY categoria,objeto;
