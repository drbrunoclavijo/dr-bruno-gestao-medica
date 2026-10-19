-- Diagnóstico somente leitura: regras EFETIVAS de acesso aos lotes.
-- Não contém nem retorna valores de custo, pacientes ou credenciais.
SELECT 'POLITICA' AS tipo,
       schemaname||'.'||tablename||'.'||policyname AS objeto,
       'cmd='||cmd||'; permissive='||permissive||'; roles='||array_to_string(roles,',') AS parametros,
       qual::text AS expressao
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('estoque_lotes_teste','estoque_produtos_teste')
UNION ALL
SELECT 'GRANT COLUNA',table_schema||'.'||table_name||'.'||column_name,
       grantee||':'||privilege_type, NULL
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='estoque_lotes_teste'
 AND grantee IN ('authenticated','anon','PUBLIC')
UNION ALL
SELECT 'FUNCAO',n.nspname||'.'||p.proname,
       pg_get_function_identity_arguments(p.oid),
       'security_definer='||p.prosecdef||'; executable='||has_function_privilege('authenticated',p.oid,'EXECUTE')
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname LIKE '%estoque%'
ORDER BY tipo,objeto;
