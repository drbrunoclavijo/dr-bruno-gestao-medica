-- SOMENTE LEITURA. Confere dependencias da coluna de custo antes da migracao.
-- Nao exibe valores, pacientes, chaves ou dados clinicos.
WITH f AS (
 SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args,
        pg_get_functiondef(p.oid) body
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind IN ('f','p')
), dependent AS (
 SELECT proname,args,
   position('estoque_lotes_teste' in body)>0 uses_lots,
   position('custo_total_aquisicao' in body)>0 uses_cost,
   has_function_privilege('authenticated',oid,'EXECUTE') callable
 FROM f
 WHERE body ILIKE '%estoque_lotes_teste%'
    OR body ILIKE '%custo_total_aquisicao%'
)
SELECT proname AS funcao,args AS parametros,uses_lots AS utiliza_lotes,
       uses_cost AS utiliza_custo,callable AS executavel_authenticated
FROM dependent ORDER BY proname,args;
-- Nao confirma se uma funcao revela o custo; examine as funcoes encontradas
-- antes de ativar a migracao de restricao.
