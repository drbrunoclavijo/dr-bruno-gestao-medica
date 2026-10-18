-- Majestic Santé Institute | Relatórios gerenciais FICTÍCIOS com isolamento por perfil.
-- Producao cadastrada != recebimento. Os totais da clínica não atribuem caixa por profissional.
BEGIN;
CREATE OR REPLACE FUNCTION public.relatorio_producao_periodo_teste(p_inicio date,p_fim date)
RETURNS TABLE(origem_id uuid,data_referencia date,tipo text,descricao text,
 valor_acordado numeric,valor_cobrado numeric,taxa_estimada numeric,
 liquido_estimado numeric,parcelas integer,situacao text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rel$
DECLARE v_perfil text;
BEGIN
 SELECT p.perfil INTO v_perfil FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo;
 IF v_perfil NOT IN ('medico','enfermeira') OR v_perfil IS NULL
 THEN RAISE EXCEPTION 'Perfil sem acesso a relatorios'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio>p_fim
 OR p_fim-p_inicio>730 THEN RAISE EXCEPTION 'Periodo invalido ou maior que 731 dias'; END IF;
 IF v_perfil='medico' THEN
  RETURN QUERY
  SELECT pr.id,pr.inicio,'Protocolo'::text,pr.nome::text,
    coalesce(pc.valor_acordado,pr.preco_cobrado)::numeric,
    pr.preco_cobrado::numeric,
    pc.taxa_valor::numeric,pc.liquido_estimado::numeric,
    pc.parcelas,pr.status::text
  FROM public.protocolos_teste pr
  LEFT JOIN public.protocolos_precificacao_teste pc ON pc.protocolo_id=pr.id
  WHERE pr.criado_por=auth.uid() AND pr.inicio BETWEEN p_inicio AND p_fim
  ORDER BY pr.inicio DESC,pr.criado_em DESC LIMIT 2000;
 ELSE
  RETURN QUERY
  SELECT cp.id,cp.data_prevista,'Procedimento'::text,cp.descricao::text,
    cp.valor_acordado,cp.total_cobrado,cp.taxa_valor,
    cp.liquido_estimado,cp.parcelas,'cadastrado'::text
  FROM public.procedimentos_carol_teste cp
  WHERE cp.criado_por=auth.uid() AND cp.data_prevista BETWEEN p_inicio AND p_fim
  ORDER BY cp.data_prevista DESC,cp.criado_em DESC LIMIT 2000;
 END IF;
END $rel$;

CREATE OR REPLACE FUNCTION public.relatorio_agenda_periodo_teste(p_inicio date,p_fim date)
RETURNS TABLE(tipo text,situacao text,total bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rel$
DECLARE v_perfil text;
BEGIN
 SELECT p.perfil INTO v_perfil FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo;
 IF v_perfil NOT IN ('medico','enfermeira') OR v_perfil IS NULL
 THEN RAISE EXCEPTION 'Perfil nao permitido'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio>p_fim OR p_fim-p_inicio>730
 THEN RAISE EXCEPTION 'Periodo invalido'; END IF;
 RETURN QUERY
 SELECT a.tipo::text,a.status::text,count(*)::bigint
 FROM public.agendamentos_teste a
 WHERE a.profissional_id=auth.uid()
  AND (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
 GROUP BY a.tipo,a.status ORDER BY 1,2;
END $rel$;

CREATE OR REPLACE FUNCTION public.relatorio_caixa_periodo_teste(p_inicio date,p_fim date)
RETURNS TABLE(recebido_bruto numeric,taxas_confirmadas numeric,
 despesas_pagas numeric,resultado_apos_taxas numeric,
 contas_criadas numeric,despesas_a_vencer numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $rel$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Caixa restrito ao medico'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio>p_fim OR p_fim-p_inicio>730
 THEN RAISE EXCEPTION 'Periodo invalido'; END IF;
 RETURN QUERY
 WITH receb AS (
  SELECT coalesce(sum(pg.valor),0)::numeric bruto,
   coalesce(sum(tf.valor_taxa),0)::numeric taxas
  FROM public.pagamentos_receber_teste pg
  LEFT JOIN public.taxas_pagamentos_teste tf ON tf.pagamento_id=pg.id
  WHERE (pg.pago_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
 ), desp AS (
  SELECT coalesce(sum(d.valor),0)::numeric pagas FROM public.despesas_financeiras_teste d
  WHERE d.status='ativa' AND d.pago_em BETWEEN p_inicio AND p_fim
 ), criado AS (
  SELECT coalesce(sum(c.valor_total),0)::numeric total FROM public.contas_receber_teste c
  WHERE c.status='aberta' AND
   (c.criado_em AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN p_inicio AND p_fim
 ), pendente AS (
  SELECT coalesce(sum(d.valor),0)::numeric total FROM public.despesas_financeiras_teste d
  WHERE d.status='ativa' AND d.pago_em IS NULL AND d.vencimento BETWEEN p_inicio AND p_fim
 )
 SELECT r.bruto,r.taxas,d.pagas,(r.bruto-r.taxas-d.pagas)::numeric,c.total,p.total
 FROM receb r CROSS JOIN desp d CROSS JOIN criado c CROSS JOIN pendente p;
END $rel$;
REVOKE ALL ON FUNCTION public.relatorio_producao_periodo_teste(date,date),
 public.relatorio_agenda_periodo_teste(date,date),
 public.relatorio_caixa_periodo_teste(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.relatorio_producao_periodo_teste(date,date),
 public.relatorio_agenda_periodo_teste(date,date),
 public.relatorio_caixa_periodo_teste(date,date) TO authenticated;
COMMIT;
