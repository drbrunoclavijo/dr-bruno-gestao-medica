-- Somente leitura: mostra a regra COMPLETA das políticas do estoque.
-- Não revela dados de pacientes, custos, lotes ou credenciais.
SELECT tablename,policyname,permissive,cmd,
       array_to_string(roles,',') AS roles,
       qual AS condicao_select,
       with_check AS condicao_gravacao
FROM pg_policies
WHERE schemaname='public'
 AND tablename IN ('estoque_lotes_teste','estoque_produtos_teste')
ORDER BY tablename,policyname;
-- Importante: políticas PERMISSIVE são combinadas por OR.
-- GRANT SELECT em tabela com custo libera a coluna para papéis cobertos
-- pelas políticas, mesmo que o aplicativo não solicite a coluna.
