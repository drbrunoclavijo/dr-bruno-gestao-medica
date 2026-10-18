-- Majestic Sante | DIAGNOSTICO somente leitura (nao insere, nao modifica).
-- Executar EXCLUSIVAMENTE no Supabase de homologacao.
-- Verifica configuracao de RLS e seguranca basica das RPCs.
WITH objetos AS (
 SELECT t.schemaname,t.tablename,c.relrowsecurity AS rowsecurity,c.relforcerowsecurity AS forcerowsecurity
 FROM pg_tables t JOIN pg_class c ON c.relname=t.tablename
 JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname=t.schemaname
 WHERE t.schemaname='public' AND t.tablename IN (
  'profissionais','pacientes','agendamentos_teste','protocolos_teste',
  'prescricoes_teste','prescricao_itens_teste','administracoes_teste',
  'contas_receber_teste','pagamentos_receber_teste','taxas_pagamentos_teste',
  'despesas_financeiras_teste','estoque_produtos_teste','estoque_lotes_teste',
  'estoque_movimentos_teste','agendamentos_auditoria_teste',
  'financeiro_auditoria_teste','auditoria_despesas_financeiras_teste'
 )
), dados AS (
 SELECT 'RLS'::text tipo,tablename::text recurso,
  CASE WHEN rowsecurity THEN 'OK' ELSE 'REVISAR' END status,
  'RLS '||CASE WHEN rowsecurity THEN 'habilitado' ELSE 'DESABILITADO' END::text detalhe
 FROM objetos
 UNION ALL
 SELECT 'RPC',p.proname::text,
 CASE WHEN p.prosecdef THEN 'OK' ELSE 'REVISAR' END,
 CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
  'listar_auditoria_geral_teste','listar_responsaveis_auditoria_teste',
  'listar_contas_receber_teste','registrar_pagamento_com_taxa_teste',
  'listar_pendencias_agenda_teste','listar_protocolos_financeiro_admin_teste',
  'relatorio_caixa_periodo_teste')
 UNION ALL
 SELECT 'RPC publica',p.proname::text,
  CASE WHEN has_function_privilege('anon',p.oid,'EXECUTE') THEN 'REVISAR' ELSE 'OK' END,
  CASE WHEN has_function_privilege('anon',p.oid,'EXECUTE') THEN
   'Papel anon pode executar — confirmar se permitido' ELSE 'anon sem EXECUTE' END::text
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN (
  'listar_auditoria_geral_teste','listar_responsaveis_auditoria_teste',
  'listar_contas_receber_teste','registrar_pagamento_com_taxa_teste',
  'listar_pendencias_agenda_teste','listar_protocolos_financeiro_admin_teste',
  'relatorio_caixa_periodo_teste')
)
SELECT tipo,recurso,status,detalhe FROM dados ORDER BY tipo,recurso;
