-- Majestic Sante | despesas operacionais ficticias e resumo de resultado de caixa.
-- Dados exclusivamente de teste. Nunca importar dados pessoais reais nesta fase.
BEGIN;
CREATE TABLE IF NOT EXISTS public.despesas_financeiras_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 descricao text NOT NULL CHECK(length(btrim(descricao)) BETWEEN 3 AND 200),
 categoria text NOT NULL CHECK(categoria IN
 ('aluguel','pessoal','energia','agua','internet','marketing','manutencao',
  'material_escritorio','impostos','taxa_cartao','medicamentos','insumos','outros')),
 valor numeric(12,2) NOT NULL CHECK(valor>0 AND valor<=10000000),
 vencimento date NOT NULL,
 pago_em date,
 observacao text CHECK(observacao IS NULL OR length(observacao)<=300),
 status text NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','cancelada')),
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 cancelado_por uuid REFERENCES auth.users(id),
 cancelado_em timestamptz,
 motivo_cancelamento text CHECK(motivo_cancelamento IS NULL OR length(motivo_cancelamento)<=300)
);
CREATE INDEX IF NOT EXISTS despesas_financeiras_data_teste_idx
 ON public.despesas_financeiras_teste(vencimento,pago_em);
ALTER TABLE public.despesas_financeiras_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.despesas_financeiras_teste FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.auditoria_despesas_financeiras_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 despesa_id uuid NOT NULL REFERENCES public.despesas_financeiras_teste(id) ON DELETE RESTRICT,
 acao text NOT NULL, usuario_id uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria_despesas_financeiras_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_despesas_financeiras_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.criar_despesa_financeira_teste(
 p_descricao text,p_categoria text,p_valor numeric,p_vencimento date,
 p_pago_em date DEFAULT NULL,p_observacao text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF length(btrim(coalesce(p_descricao,''))) NOT BETWEEN 3 AND 200
 OR p_categoria IS NULL OR p_categoria NOT IN
 ('aluguel','pessoal','energia','agua','internet','marketing','manutencao',
 'material_escritorio','impostos','taxa_cartao','medicamentos','insumos','outros')
 OR p_valor IS NULL OR p_valor<=0 OR p_valor>10000000 OR p_valor<>round(p_valor,2)
 OR p_vencimento IS NULL OR length(coalesce(p_observacao,''))>300
 OR (p_pago_em IS NOT NULL AND p_pago_em>current_date+1)
 THEN RAISE EXCEPTION 'Dados de despesa invalidos'; END IF;
 INSERT INTO public.despesas_financeiras_teste
 (descricao,categoria,valor,vencimento,pago_em,observacao,criado_por)
 VALUES(btrim(p_descricao),p_categoria,p_valor,p_vencimento,p_pago_em,
 nullif(btrim(p_observacao),''),auth.uid())
 RETURNING id INTO v_id;
 INSERT INTO public.auditoria_despesas_financeiras_teste(despesa_id,acao,usuario_id)
 VALUES(v_id,'criada',auth.uid());
 RETURN v_id;
END $fin$;

CREATE OR REPLACE FUNCTION public.quitar_despesa_financeira_teste(p_despesa_id uuid,p_pago_em date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF p_pago_em IS NULL OR p_pago_em>current_date+1 THEN RAISE EXCEPTION 'Data de pagamento invalida'; END IF;
 UPDATE public.despesas_financeiras_teste SET pago_em=p_pago_em
 WHERE id=p_despesa_id AND status='ativa' AND pago_em IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Despesa inexistente, cancelada ou ja paga'; END IF;
 INSERT INTO public.auditoria_despesas_financeiras_teste(despesa_id,acao,usuario_id)
 VALUES(p_despesa_id,'quitada',auth.uid());
END $fin$;

CREATE OR REPLACE FUNCTION public.cancelar_despesa_financeira_teste(p_despesa_id uuid,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 5 AND 300 THEN RAISE EXCEPTION 'Motivo de 5 a 300 caracteres'; END IF;
 UPDATE public.despesas_financeiras_teste
 SET status='cancelada',cancelado_em=now(),cancelado_por=auth.uid(),motivo_cancelamento=btrim(p_motivo)
 WHERE id=p_despesa_id AND status='ativa' AND pago_em IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Somente despesa nao paga pode ser cancelada'; END IF;
 INSERT INTO public.auditoria_despesas_financeiras_teste(despesa_id,acao,usuario_id)
 VALUES(p_despesa_id,'cancelada',auth.uid());
END $fin$;

CREATE OR REPLACE FUNCTION public.listar_despesas_financeiras_teste(p_ano integer)
RETURNS TABLE(id uuid,descricao text,categoria text,valor numeric,vencimento date,
 pago_em date,status text,observacao text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF p_ano NOT BETWEEN 2020 AND 2100 THEN RAISE EXCEPTION 'Ano invalido'; END IF;
 RETURN QUERY
 SELECT d.id,d.descricao,d.categoria,d.valor,d.vencimento,d.pago_em,d.status,d.observacao
 FROM public.despesas_financeiras_teste d
 WHERE (d.vencimento>=make_date(p_ano,1,1) AND d.vencimento<make_date(p_ano+1,1,1))
    OR (d.pago_em>=make_date(p_ano,1,1) AND d.pago_em<make_date(p_ano+1,1,1))
 ORDER BY d.vencimento DESC,d.criado_em DESC LIMIT 3000;
END $fin$;

CREATE OR REPLACE FUNCTION public.resumo_resultado_financeiro_teste(p_ano integer)
RETURNS TABLE(mes integer,recebido numeric,despesas_pagas numeric,
 despesas_previstas numeric,resultado_caixa numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF p_ano NOT BETWEEN 2020 AND 2100 THEN RAISE EXCEPTION 'Ano invalido'; END IF;
 RETURN QUERY
 WITH meses AS (SELECT generate_series(1,12) AS n),
 receitas AS (
  SELECT extract(month FROM (p.pago_em AT TIME ZONE 'America/Sao_Paulo'))::integer n,sum(p.valor) AS total
  FROM public.pagamentos_receber_teste p
  WHERE extract(year FROM (p.pago_em AT TIME ZONE 'America/Sao_Paulo'))=p_ano
  GROUP BY 1
 ),
 saidas AS (
  SELECT extract(month FROM d.pago_em)::integer n,sum(d.valor) AS total
  FROM public.despesas_financeiras_teste d
  WHERE d.status='ativa' AND d.pago_em IS NOT NULL AND extract(year FROM d.pago_em)=p_ano
  GROUP BY 1
 ),
 previstas AS (
  SELECT extract(month FROM d.vencimento)::integer n,sum(d.valor) AS total
  FROM public.despesas_financeiras_teste d
  WHERE d.status='ativa' AND d.pago_em IS NULL AND extract(year FROM d.vencimento)=p_ano
  GROUP BY 1
 )
 SELECT m.n,coalesce(r.total,0)::numeric,coalesce(s.total,0)::numeric,
 coalesce(p.total,0)::numeric,(coalesce(r.total,0)-coalesce(s.total,0))::numeric
 FROM meses m LEFT JOIN receitas r ON r.n=m.n
 LEFT JOIN saidas s ON s.n=m.n
 LEFT JOIN previstas p ON p.n=m.n
 ORDER BY m.n;
END $fin$;
REVOKE ALL ON FUNCTION public.criar_despesa_financeira_teste(text,text,numeric,date,date,text),
 public.quitar_despesa_financeira_teste(uuid,date),
 public.cancelar_despesa_financeira_teste(uuid,text),
 public.listar_despesas_financeiras_teste(integer),
 public.resumo_resultado_financeiro_teste(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_despesa_financeira_teste(text,text,numeric,date,date,text),
 public.quitar_despesa_financeira_teste(uuid,date),
 public.cancelar_despesa_financeira_teste(uuid,text),
 public.listar_despesas_financeiras_teste(integer),
 public.resumo_resultado_financeiro_teste(integer) TO authenticated;
COMMIT;
