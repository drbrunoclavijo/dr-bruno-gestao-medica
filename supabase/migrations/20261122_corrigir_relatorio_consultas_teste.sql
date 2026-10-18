-- Majestic Sante | Correcao identificada nos testes: consultas e contas avulsas
-- do perfil medico nao eram mostradas na producao cadastral.
-- Nao classificar contas como recebimento; taxas e liquido ficam desconhecidos
-- ate que haja conciliacao do pagamento no Financeiro.
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
 IF v_perfil IS NULL OR v_perfil NOT IN ('medico','enfermeira')
 THEN RAISE EXCEPTION 'Perfil sem acesso a relatorios'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_inicio>p_fim OR p_fim-p_inicio>730
 THEN RAISE EXCEPTION 'Periodo invalido ou maior que 731 dias'; END IF;
 IF v_perfil='medico' THEN
  RETURN QUERY
  SELECT x.origem_id,x.data_referencia,x.tipo,x.descricao,
   x.valor_acordado,x.valor_cobrado,x.taxa_estimada,x.liquido_estimado,
   x.parcelas,x.situacao
  FROM (
   SELECT pr.id AS origem_id,pr.inicio AS data_referencia,
    'Protocolo'::text AS tipo,pr.nome::text AS descricao,
    coalesce(pc.valor_acordado,pr.preco_cobrado)::numeric AS valor_acordado,
    pr.preco_cobrado::numeric AS valor_cobrado,
    pc.taxa_valor::numeric AS taxa_estimada,
    pc.liquido_estimado::numeric AS liquido_estimado,
    pc.parcelas AS parcelas,pr.status::text AS situacao
   FROM public.protocolos_teste pr
   LEFT JOIN public.protocolos_precificacao_teste pc ON pc.protocolo_id=pr.id
   WHERE pr.criado_por=auth.uid() AND pr.inicio BETWEEN p_inicio AND p_fim
   UNION ALL
   SELECT c.id,c.vencimento AS data_referencia,
    CASE WHEN c.agendamento_id IS NOT NULL THEN 'Atendimento faturado'
     ELSE 'Conta avulsa de servico' END::text,
    c.descricao::text,c.valor_total::numeric,c.valor_total::numeric,
    NULL::numeric,NULL::numeric,NULL::integer,c.status::text
   FROM public.contas_receber_teste c
   WHERE c.protocolo_id IS NULL
    AND c.criado_por=auth.uid()
    AND c.vencimento BETWEEN p_inicio AND p_fim
  ) x
  ORDER BY x.data_referencia DESC,x.origem_id DESC LIMIT 2000;
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
REVOKE ALL ON FUNCTION public.relatorio_producao_periodo_teste(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.relatorio_producao_periodo_teste(date,date) TO authenticated;
COMMIT;
