-- DIAGNOSTICO SOMENTE LEITURA: nao retorna custos, pacientes ou conteudo de funcoes.
-- Checa permissao EXECUTE e indicadores de validacao de perfil nas funcoes financeiras.
WITH funcs AS (
 SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS parametros,
        p.prosecdef,pg_get_functiondef(p.oid) AS codigo
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
 AND p.proname IN ('custo_saida_insumo_teste','previsao_custos_protocolos_teste',
   'calcular_custo_movimento_teste','adicionar_lote_estoque_teste')
)
SELECT proname AS funcao,parametros,prosecdef AS security_definer,
 has_function_privilege('authenticated',oid,'EXECUTE') AS executavel_authenticated,
 (codigo ILIKE '%auth.uid%') AS verifica_usuario,
 (codigo ILIKE '%profissionais%') AS consulta_perfil,
 (codigo ILIKE '%administrativo%') AS menciona_administrativo,
 (codigo ILIKE '%medico%') AS menciona_medico,
 (codigo ILIKE '%enfermeira%') AS menciona_enfermeira,
 (codigo ILIKE '%equipe%') AS menciona_equipe
FROM funcs ORDER BY proname,parametros;
