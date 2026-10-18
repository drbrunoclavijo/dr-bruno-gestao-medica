-- Majestic Sante | Gerente comercial em espera: perfil administrativo.
-- NAO cria usuarios ou credenciais. Apenas prepara autorizacoes controladas.
-- EXECUTAR somente no banco de TESTES. Clinica real exige homologacao de permissoes.
BEGIN;
-- Compatibilizar somente eventual CHECK simples de papeis atualmente existentes.
DO $$
DECLARE c record; v text;
BEGIN
 FOR c IN SELECT conname, pg_get_constraintdef(oid) AS definicao
  FROM pg_constraint WHERE conrelid='public.profissionais'::regclass
  AND contype='c' AND pg_get_constraintdef(oid) ILIKE '%perfil%'
 LOOP
  v:=c.definicao;
  IF v ILIKE '%administrativo%' THEN CONTINUE; END IF;
  IF v ILIKE '%medico%' AND v ILIKE '%enfermeira%' AND v ILIKE '%equipe%'
     AND v NOT ILIKE '% OR %' THEN
   EXECUTE format('ALTER TABLE public.profissionais DROP CONSTRAINT %I',c.conname);
  ELSE
   RAISE EXCEPTION 'Restricao de perfil desconhecida: %. Revisar manualmente antes de habilitar novo perfil.',c.conname;
  END IF;
 END LOOP;
END $$;
ALTER TABLE public.profissionais
 ADD CONSTRAINT profissionais_perfil_comercial_teste_ck
 CHECK (perfil IN ('medico','enfermeira','equipe','administrativo'));

-- Nao cria nenhuma conta: o papel so passa a existir quando vinculado a um
-- usuario autenticado e ativo em public.profissionais por um administrador.
-- Replica o escopo cadastral da equipe para o novo perfil (nao prontuarios).
GRANT SELECT,INSERT,UPDATE ON public.pacientes TO authenticated;
DROP POLICY IF EXISTS pacientes_administrativo_ler_teste ON public.pacientes;
CREATE POLICY pacientes_administrativo_ler_teste ON public.pacientes
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo=true AND p.perfil='administrativo'));
DROP POLICY IF EXISTS pacientes_administrativo_inserir_teste ON public.pacientes;
CREATE POLICY pacientes_administrativo_inserir_teste ON public.pacientes
 FOR INSERT TO authenticated WITH CHECK (
  EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo=true AND p.perfil='administrativo'));
DROP POLICY IF EXISTS pacientes_administrativo_atualizar_teste ON public.pacientes;
CREATE POLICY pacientes_administrativo_atualizar_teste ON public.pacientes
 FOR UPDATE TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo=true AND p.perfil='administrativo'))
 WITH CHECK (
  EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo=true AND p.perfil='administrativo'));

-- Produtos e lotes: leitura operacional, semelhante a equipe, sem historico clinico.
GRANT SELECT ON public.estoque_produtos_teste,public.estoque_lotes_teste TO authenticated;
DROP POLICY IF EXISTS estoque_produtos_admin_comercial_teste ON public.estoque_produtos_teste;
CREATE POLICY estoque_produtos_admin_comercial_teste ON public.estoque_produtos_teste
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo AND p.perfil='administrativo'));
DROP POLICY IF EXISTS estoque_lotes_admin_comercial_teste ON public.estoque_lotes_teste;
CREATE POLICY estoque_lotes_admin_comercial_teste ON public.estoque_lotes_teste
 FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo AND p.perfil='administrativo'));

-- Ampliar SOMENTE as funcoes de FINANCEIRO e AUDITORIA selecionadas, e
-- SOMENTE a comparacao de perfil medico (sem liberar prescricoes/prontuarios).
DO $adm$
DECLARE n text; f record; def text; patched text; changed integer;
BEGIN
 FOR n IN SELECT unnest(ARRAY[
  'listar_contas_receber_teste','listar_pagamentos_receber_teste',
  'criar_conta_receber_teste','registrar_pagamento_receber_teste',
  'cancelar_conta_receber_teste','criar_conta_parcelada_teste',
  'listar_parcelas_receber_teste','resumo_financeiro_mensal_teste',
  'criar_despesa_financeira_teste','quitar_despesa_financeira_teste',
  'cancelar_despesa_financeira_teste','listar_despesas_financeiras_teste',
  'resumo_resultado_financeiro_teste','origens_contas_financeiras_teste',
  'criar_conta_por_origem_teste','resumo_financeiro_inicial_teste',
  'registrar_pagamento_com_taxa_teste','resumo_taxas_pagamentos_teste',
  'taxas_resumo_atual_teste','relatorio_caixa_periodo_teste',
  'listar_auditoria_geral_teste','listar_responsaveis_auditoria_teste'
 ]) LOOP
  SELECT p.oid, p.proname INTO f FROM pg_proc p
   JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname=n;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcao de gestao ausente: %',n; END IF;
  def:=pg_get_functiondef(f.oid);
  IF def NOT ILIKE '%SECURITY DEFINER%' OR def NOT ILIKE '%auth.uid%'
  THEN RAISE EXCEPTION 'Funcao sem verificacao/autorizacao esperada: %',n; END IF;
  patched:=regexp_replace(def, 'perfil\s*=\s*''medico''',
    'perfil IN (''medico'',''administrativo'')','gi');
  IF patched=def THEN RAISE EXCEPTION 'Autorizacao medica nao localizada em %; revise versao.',n; END IF;
  EXECUTE patched;
 END LOOP;
END $adm$;

-- Agenda administrativa: acesso semelhante ao da equipe.
DO $adm$
DECLARE n text; f record; def text; patched text;
BEGIN
 FOR n IN SELECT unnest(ARRAY[
  'agenda_profissionais_teste','listar_agendamentos_teste',
  'agenda_aplicacoes_administrativa_teste','salvar_agendamento_teste',
  'atualizar_status_agendamento_teste','simular_resposta_agendamento_teste'
 ]) LOOP
  SELECT p.oid,p.proname INTO f FROM pg_proc p
   JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname=n;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcao de agenda ausente: %',n; END IF;
  def:=pg_get_functiondef(f.oid);
  IF def NOT ILIKE '%SECURITY DEFINER%' THEN RAISE EXCEPTION 'Agenda com definicao inesperada: %',n; END IF;
  patched:=regexp_replace(def, '''medico''\s*,\s*''enfermeira''\s*,\s*''equipe''',
   '''medico'',''enfermeira'',''equipe'',''administrativo''','gi');
  -- A funcao de pendencias usa p.perfil='equipe', e outras usam v_perfil='equipe'.
  -- Substituir as duas formas, sem afetar validacoes medicas de outras areas.
  patched:=regexp_replace(patched, '(v_perfil|p\\.perfil)\\s*=\\s*''equipe''',
   '\\1 IN (''equipe'',''administrativo'')','gi');
  IF patched=def THEN RAISE EXCEPTION 'Acesso da equipe nao localizado em %; revise antes.',n; END IF;
  EXECUTE patched;
 END LOOP;
END $adm$;

-- Funcao de pendencias: reescrita EXPLICITA para os dois papeis administrativos.
-- Nao reescrever via regexp pg_get_functiondef: o PostgreSQL normaliza expressoes.
CREATE OR REPLACE FUNCTION public.listar_pendencias_agenda_teste()
RETURNS TABLE(pendencia_id uuid,agendamento_id uuid,paciente_nome text,
 profissional_nome text,inicio_local text,aberta_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo
   AND p.perfil IN ('equipe','administrativo')
 ) THEN RAISE EXCEPTION 'Painel exclusivo da equipe administrativa'; END IF;
 RETURN QUERY SELECT pe.id,a.id,pa.nome::text,pr.nome::text,
  to_char(a.inicio AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')::text,
  pe.aberta_em
 FROM public.pendencias_agenda_teste pe
 JOIN public.agendamentos_teste a ON a.id=pe.agendamento_id
 JOIN public.pacientes pa ON pa.id=a.paciente_id
 JOIN public.profissionais pr ON pr.id=a.profissional_id
 WHERE pe.status='aberta' ORDER BY pe.aberta_em DESC LIMIT 300;
END $agenda$;
REVOKE ALL ON FUNCTION public.listar_pendencias_agenda_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_pendencias_agenda_teste() TO authenticated;

-- Exposicao minima de metadados financeiros de protocolos, sem detalhes de prescricao.
CREATE OR REPLACE FUNCTION public.listar_protocolos_financeiro_admin_teste()
RETURNS TABLE(protocolo_id uuid,paciente_id uuid,paciente_nome text,nome text,
 preco_cobrado numeric,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $adm$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
  AND p.ativo AND p.perfil IN ('medico','administrativo'))
 THEN RAISE EXCEPTION 'Financeiro restrito ao medico e gerente autorizado'; END IF;
 RETURN QUERY SELECT pr.id,pr.paciente_id,pa.nome::text,pr.nome::text,
  pr.preco_cobrado,pr.status::text
 FROM public.protocolos_teste pr
 JOIN public.pacientes pa ON pa.id=pr.paciente_id
 ORDER BY pr.criado_em DESC LIMIT 300;
END $adm$;
REVOKE ALL ON FUNCTION public.listar_protocolos_financeiro_admin_teste()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_protocolos_financeiro_admin_teste()
 TO authenticated;
COMMIT;
