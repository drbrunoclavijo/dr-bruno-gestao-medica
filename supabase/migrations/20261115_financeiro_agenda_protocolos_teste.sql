-- Majestic Sante | Integracao operacional Financeiro <-> Agenda e Protocolos.
-- Somente dados ficticios. Criacao de conta exige acao explicita do medico.
BEGIN;
ALTER TABLE public.contas_receber_teste
 ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES public.agendamentos_teste(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS contas_origem_agendamento_unico_teste
 ON public.contas_receber_teste(agendamento_id) WHERE agendamento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.origens_contas_financeiras_teste()
RETURNS TABLE(tipo_origem text,origem_id uuid,paciente_nome text,
 descricao text,valor_sugerido numeric,data_referencia date,conta_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso financeiro exclusivo ao medico'; END IF;
 RETURN QUERY
 SELECT 'consulta'::text,a.id,pa.nome::text,
  (CASE a.tipo WHEN 'retorno' THEN 'Retorno' WHEN 'procedimento' THEN 'Procedimento'
   WHEN 'consulta' THEN 'Consulta' ELSE 'Atendimento' END || ' · ' || p.nome)::text,
  NULL::numeric,(a.inicio AT TIME ZONE 'America/Sao_Paulo')::date,
  (SELECT c.id FROM public.contas_receber_teste c WHERE c.agendamento_id=a.id
   ORDER BY c.criado_em DESC LIMIT 1)
 FROM public.agendamentos_teste a
 JOIN public.pacientes pa ON pa.id=a.paciente_id
 JOIN public.profissionais p ON p.id=a.profissional_id
 WHERE a.status='realizado'
 UNION ALL
 SELECT 'protocolo'::text,pr.id,pa.nome::text,
  ('Protocolo · '||pr.nome)::text,pr.preco_cobrado,pr.inicio,
  (SELECT c.id FROM public.contas_receber_teste c WHERE c.protocolo_id=pr.id
   AND c.status='aberta' ORDER BY c.criado_em DESC LIMIT 1)
 FROM public.protocolos_teste pr
 JOIN public.pacientes pa ON pa.id=pr.paciente_id
 WHERE pr.status IN ('ativo','concluido') AND pr.preco_cobrado>0
 ORDER BY data_referencia DESC LIMIT 500;
END $fin$;

CREATE OR REPLACE FUNCTION public.criar_conta_por_origem_teste(
 p_tipo_origem text,p_origem_id uuid,p_valor numeric,
 p_primeiro_vencimento date,p_numero_parcelas integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
DECLARE v_id uuid;v_patient uuid;v_description text;v_protocol uuid;
 v_status text;v_price numeric;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso financeiro exclusivo ao medico'; END IF;
 IF p_origem_id IS NULL OR p_tipo_origem NOT IN ('consulta','protocolo')
 THEN RAISE EXCEPTION 'Origem invalida'; END IF;
 -- Mesmo identificador de origem nao pode gerar contas simultaneas.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tipo_origem||':'||p_origem_id::text,0));
 IF p_tipo_origem='consulta' THEN
  SELECT a.paciente_id,a.status,
   (CASE a.tipo WHEN 'retorno' THEN 'Retorno' WHEN 'procedimento' THEN 'Procedimento'
    WHEN 'consulta' THEN 'Consulta' ELSE 'Atendimento' END||' · '||pr.nome)
  INTO v_patient,v_status,v_description
  FROM public.agendamentos_teste a JOIN public.profissionais pr ON pr.id=a.profissional_id
  WHERE a.id=p_origem_id FOR UPDATE OF a;
  IF NOT FOUND OR v_status<>'realizado' THEN
   RAISE EXCEPTION 'Somente atendimento realizado pode gerar conta'; END IF;
  IF EXISTS(SELECT 1 FROM public.contas_receber_teste c WHERE c.agendamento_id=p_origem_id)
  THEN RAISE EXCEPTION 'Este atendimento ja possui conta financeira'; END IF;
 ELSE
  SELECT p.paciente_id,p.status,p.nome,p.preco_cobrado
  INTO v_patient,v_status,v_description,v_price
  FROM public.protocolos_teste p WHERE p.id=p_origem_id FOR UPDATE;
  IF NOT FOUND OR v_status NOT IN ('ativo','concluido') OR v_price<=0
  THEN RAISE EXCEPTION 'Protocolo indisponivel para faturamento'; END IF;
  IF EXISTS(SELECT 1 FROM public.contas_receber_teste c
   WHERE c.protocolo_id=p_origem_id AND c.status='aberta')
  THEN RAISE EXCEPTION 'Protocolo ja possui conta aberta; confira o financeiro antes de gerar outra'; END IF;
  v_protocol:=p_origem_id;
  v_description:='Protocolo · '||v_description;
 END IF;
 -- A validacao de valor, data e numero de parcelas permanece na RPC principal.
 v_id:=public.criar_conta_parcelada_teste(v_patient,v_protocol,v_description,p_valor,
  p_primeiro_vencimento,p_numero_parcelas);
 IF p_tipo_origem='consulta' THEN
  UPDATE public.contas_receber_teste c SET agendamento_id=p_origem_id WHERE c.id=v_id;
 END IF;
 INSERT INTO public.financeiro_auditoria_teste(conta_id,acao,usuario_id)
 VALUES(v_id,'gerada_de_'||p_tipo_origem,auth.uid());
 RETURN v_id;
END $fin$;

CREATE OR REPLACE FUNCTION public.resumo_financeiro_inicial_teste()
RETURNS TABLE(recebido_mes numeric,despesa_paga_mes numeric,
 resultado_caixa_mes numeric,saldo_a_receber numeric,parcelas_vencidas numeric,
 contas_pendentes bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso financeiro exclusivo ao medico'; END IF;
 RETURN QUERY
 WITH datas AS (SELECT date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo')::date AS ini),
 receita AS (SELECT coalesce(sum(p.valor),0)::numeric AS total
  FROM public.pagamentos_receber_teste p CROSS JOIN datas d
  WHERE (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date>=d.ini
   AND (p.pago_em AT TIME ZONE 'America/Sao_Paulo')::date<d.ini+interval '1 month'),
 despesa AS (SELECT coalesce(sum(e.valor),0)::numeric AS total
  FROM public.despesas_financeiras_teste e CROSS JOIN datas d
  WHERE e.status='ativa' AND e.pago_em>=d.ini AND e.pago_em<d.ini+interval '1 month'),
 saldo AS (SELECT coalesce(sum(c.valor_total-coalesce(p.total,0)),0)::numeric AS total,
   count(*) FILTER(WHERE c.valor_total>coalesce(p.total,0))::bigint AS quantidade
  FROM public.contas_receber_teste c
  LEFT JOIN LATERAL(SELECT sum(x.valor) AS total
   FROM public.pagamentos_receber_teste x WHERE x.conta_id=c.id) p ON true
  WHERE c.status='aberta'),
 vencidas AS (
  WITH acumulado AS (
    SELECT i.conta_id,i.vencimento,i.valor,
     coalesce(sum(i.valor) OVER (PARTITION BY i.conta_id ORDER BY i.numero
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)::numeric AS antes
    FROM public.parcelas_receber_teste i
    JOIN public.contas_receber_teste c ON c.id=i.conta_id AND c.status='aberta'
  ),
  pagos AS (SELECT p.conta_id,sum(p.valor) AS valor
   FROM public.pagamentos_receber_teste p GROUP BY p.conta_id)
  SELECT coalesce(sum(greatest(0,a.valor-greatest(0,least(a.valor,coalesce(p.valor,0)-a.antes)))),0)::numeric AS total
  FROM acumulado a LEFT JOIN pagos p ON p.conta_id=a.conta_id
  WHERE a.vencimento<(now() AT TIME ZONE 'America/Sao_Paulo')::date
 )
 SELECT r.total,d.total,(r.total-d.total)::numeric,s.total,v.total,s.quantidade
 FROM receita r CROSS JOIN despesa d CROSS JOIN saldo s CROSS JOIN vencidas v;
END $fin$;
REVOKE ALL ON FUNCTION public.origens_contas_financeiras_teste(),
 public.criar_conta_por_origem_teste(text,uuid,numeric,date,integer),
 public.resumo_financeiro_inicial_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.origens_contas_financeiras_teste(),
 public.criar_conta_por_origem_teste(text,uuid,numeric,date,integer),
 public.resumo_financeiro_inicial_teste() TO authenticated;
COMMIT;
