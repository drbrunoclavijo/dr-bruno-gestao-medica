-- Somente leitura: dependencias reais do custo de aquisicao no codigo das funcoes.
-- Examina apenas funcoes comuns do schema public; nao exibe dados do estoque.
WITH funcs AS (
 SELECT p.oid, p.proname,
        pg_get_function_identity_arguments(p.oid) AS parametros,
        pg_get_functiondef(p.oid) AS definicao
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
)
SELECT proname AS funcao,parametros,
       (definicao ILIKE '%estoque_lotes_teste%') AS usa_tabela_lotes,
       (definicao ILIKE '%custo_total_aquisicao%') AS usa_custo_aquisicao,
       (definicao ILIKE '%SELECT *%') AS usa_select_asterisco
FROM funcs
WHERE definicao ILIKE '%estoque_lotes_teste%'
   OR definicao ILIKE '%custo_total_aquisicao%'
ORDER BY proname,parametros;
