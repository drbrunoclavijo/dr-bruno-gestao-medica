-- Diagnóstico somente leitura: confirma permissões reais e retorno de funções auxiliares.
-- Não executa funções nem consulta dados clínicos ou valores de estoque.
SELECT p.proname AS funcao,
       pg_get_function_identity_arguments(p.oid) AS parametros,
       pg_get_function_result(p.oid) AS retorno,
       p.prosecdef AS security_definer,
       p.provolatile AS volatilidade,
       p.proacl::text AS grants_explicitos,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_executa,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_executa
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
 AND p.proname IN ('calcular_custo_movimento_teste','custo_saida_insumo_teste','previsao_custos_protocolos_teste')
ORDER BY p.proname;
