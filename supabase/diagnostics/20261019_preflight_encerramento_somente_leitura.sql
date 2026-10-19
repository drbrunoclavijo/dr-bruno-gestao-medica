-- Diagnóstico SOMENTE LEITURA para Supabase de homologação.
-- Não retorna pacientes, dados clínicos, credenciais ou conteúdo de prontuários.
-- Execute no SQL Editor do projeto ISOLADO antes de aplicar as migrações.
SELECT item, resultado, detalhe FROM (
 SELECT 'Tabela profissionais'::text item,
        CASE WHEN to_regclass('public.profissionais') IS NULL THEN 'AUSENTE' ELSE 'OK' END resultado,
        'Identidades e perfis'::text detalhe
 UNION ALL SELECT 'Tabela consultas_teste',
        CASE WHEN to_regclass('public.consultas_teste') IS NULL THEN 'AUSENTE' ELSE 'OK' END,
        'Prontuário de teste'
 UNION ALL SELECT 'Tabela agendamentos_teste',
        CASE WHEN to_regclass('public.agendamentos_teste') IS NULL THEN 'AUSENTE' ELSE 'OK' END,
        'Agenda de teste'
 UNION ALL SELECT 'Tabela auditoria',
        CASE WHEN to_regclass('public.agendamentos_auditoria_teste') IS NULL THEN 'AUSENTE' ELSE 'OK' END,
        'Auditoria da agenda'
 UNION ALL SELECT 'Tabela pendencias',
        CASE WHEN to_regclass('public.pendencias_agenda_teste') IS NULL THEN 'AUSENTE' ELSE 'OK' END,
        'Pendências de reagendamento'
 UNION ALL SELECT 'RPC atualizar status',
        CASE WHEN to_regprocedure('public.atualizar_status_agendamento_teste(uuid,text)') IS NULL THEN 'AUSENTE' ELSE 'OK' END,
        'Função de agenda atualmente instalada'
 UNION ALL SELECT 'Coluna vínculo da consulta',
        CASE WHEN EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='consultas_teste' AND column_name='agendamento_id'
        ) THEN 'PRESENTE' ELSE 'AINDA NÃO INSTALADA' END,
        'Coluna criada pela primeira migração desta etapa'
 UNION ALL SELECT 'RPC encerrar consulta',
        CASE WHEN to_regprocedure('public.encerrar_consulta_teste(uuid,uuid,jsonb)') IS NULL THEN 'AINDA NÃO INSTALADA' ELSE 'PRESENTE' END,
        'Função transacional da nova etapa'
 UNION ALL SELECT 'RPC consultar encerramento',
        CASE WHEN to_regprocedure('public.consultar_encerramento_consulta_teste(uuid)') IS NULL THEN 'AINDA NÃO INSTALADA' ELSE 'PRESENTE' END,
        'Leitura restrita do encerramento'
) diagnostico ORDER BY item;
-- Rode primeiro no ambiente de homologação e confira também suas políticas RLS.
