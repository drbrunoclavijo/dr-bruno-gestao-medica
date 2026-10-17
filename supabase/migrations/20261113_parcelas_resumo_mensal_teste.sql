-- Majestic Sante | Parcelamento real por vencimentos para contas FICTICIAS.
-- Nao cria cobranças, pagamento bancario, nem emissao de documentos fiscais.
BEGIN;
CREATE TABLE IF NOT EXISTS public.parcelas_receber_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas_receber_teste(id) ON DELETE RESTRICT,
 numero integer NOT NULL CHECK(numero BETWEEN 1 AND 36),
 valor numeric(12,2) NOT NULL CHECK(valor>0),
 vencimento date NOT NULL,
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(conta_id,numero)
);
CREATE INDEX IF NOT EXISTS parcelas_receber_vencimento_teste_idx
 ON public.parcelas_receber_teste(vencimento,conta_id);
ALTER TABLE public.parcelas_receber_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.parcelas_receber_teste FROM PUBLIC,anon,authenticated;

-- Contas cadastradas anteriormente continuam validas como parcela unica.
INSERT INTO public.parcelas_receber_teste(conta_id,numero,valor,vencimento)
SELECT c.id,1,c.valor_total,c.vencimento
FROM public.contas_receber_teste c
WHERE NOT EXISTS(SELECT 1 FROM public.parcelas_receber_teste p WHERE p.conta_id=c.id);

CREATE OR REPLACE FUNCTION public.criar_conta_parcelada_teste(
 p_paciente_id uuid,p_protocolo_id uuid,p_descricao text,p_valor numeric,
 p_primeiro_vencimento date,p_numero_parcelas integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
DECLARE v_id uuid;v_centavos bigint;v_base bigint;v_resto bigint;
 v_i integer;v_mes date;v_ultimo_dia integer;v_dia integer;v_vencimento date;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true)
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente nao encontrado'; END IF;
 IF p_protocolo_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.protocolos_teste p WHERE p.id=p_protocolo_id AND p.paciente_id=p_paciente_id)
 THEN RAISE EXCEPTION 'Protocolo nao corresponde ao paciente'; END IF;
 IF length(btrim(coalesce(p_descricao,''))) NOT BETWEEN 3 AND 200
 OR p_valor IS NULL OR p_valor<=0 OR p_valor>10000000 OR p_valor<>round(p_valor,2)
 OR p_primeiro_vencimento IS NULL OR p_numero_parcelas IS NULL
 OR p_numero_parcelas NOT BETWEEN 1 AND 36
 OR round(p_valor*100)::bigint<p_numero_parcelas
 THEN RAISE EXCEPTION 'Descricao, valor, vencimento ou quantidade de parcelas invalida'; END IF;
 v_centavos:=round(p_valor*100)::bigint;
 v_base:=v_centavos/p_numero_parcelas;
 v_resto:=v_centavos%p_numero_parcelas;
 INSERT INTO public.contas_receber_teste(paciente_id,protocolo_id,descricao,valor_total,vencimento,criado_por)
 VALUES(p_paciente_id,p_protocolo_id,btrim(p_descricao),p_valor,p_primeiro_vencimento,auth.uid())
 RETURNING id INTO v_id;
 FOR v_i IN 0..p_numero_parcelas-1 LOOP
  v_mes:=(date_trunc('month',p_primeiro_vencimento)::date+make_interval(months=>v_i))::date;
  v_ultimo_dia:=extract(day FROM (v_mes+interval '1 month'-interval '1 day'))::integer;
  v_dia:=least(extract(day FROM p_primeiro_vencimento)::integer,v_ultimo_dia);
  v_vencimento:=v_mes+(v_dia-1);
  INSERT INTO public.parcelas_receber_teste(conta_id,numero,valor,vencimento)
  VALUES(v_id,v_i+1,(v_base+CASE WHEN v_i<v_resto THEN 1 ELSE 0 END)/100.0,v_vencimento);
 END LOOP;
 INSERT INTO public.financeiro_auditoria_teste(conta_id,acao,usuario_id)
 VALUES(v_id,'conta_parcelada_'||p_numero_parcelas,auth.uid());
 RETURN v_id;
END $financeiro$;

-- Pagamentos ja efetuados sao distribuidos apenas para VISUALIZACAO,
-- em ordem de vencimento; nao modifica o historico bancario nem a baixa original.
CREATE OR REPLACE FUNCTION public.listar_parcelas_receber_teste()
RETURNS TABLE(parcela_id uuid,conta_id uuid,numero integer,valor numeric,
 vencimento date,valor_alocado numeric,saldo numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true)
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 RETURN QUERY
 WITH pag AS (
  SELECT p.conta_id,sum(p.valor) AS total_pago
  FROM public.pagamentos_receber_teste p GROUP BY p.conta_id
 ), seq AS (
  SELECT pa.id,pa.conta_id,pa.numero,pa.valor,pa.vencimento,
    coalesce(sum(pa.valor) OVER(
      PARTITION BY pa.conta_id ORDER BY pa.numero
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS anterior
  FROM public.parcelas_receber_teste pa
 )
 SELECT s.id,s.conta_id,s.numero,s.valor,s.vencimento,
  least(s.valor,greatest(coalesce(p.total_pago,0)-s.anterior,0))::numeric,
  (s.valor-least(s.valor,greatest(coalesce(p.total_pago,0)-s.anterior,0)))::numeric
 FROM seq s LEFT JOIN pag p ON p.conta_id=s.conta_id
 ORDER BY s.vencimento,s.conta_id,s.numero LIMIT 10000;
END $financeiro$;

-- Fluxo financeiro mensal: vencimentos previstos versus recebimentos efetivos registrados.
CREATE OR REPLACE FUNCTION public.resumo_financeiro_mensal_teste(p_ano integer)
RETURNS TABLE(mes integer,previsto numeric,recebido numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true)
 THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF p_ano NOT BETWEEN 2020 AND 2100 THEN RAISE EXCEPTION 'Ano invalido'; END IF;
 RETURN QUERY
 WITH meses AS (SELECT generate_series(1,12) AS n),
 previstos AS (
  SELECT extract(month FROM pa.vencimento)::integer n,sum(pa.valor)::numeric total
  FROM public.parcelas_receber_teste pa
  JOIN public.contas_receber_teste c ON c.id=pa.conta_id
  WHERE c.status='aberta' AND extract(year FROM pa.vencimento)=p_ano
  GROUP BY 1
 ), recebimentos AS (
  SELECT extract(month FROM (pg.pago_em AT TIME ZONE 'America/Sao_Paulo'))::integer n,
    sum(pg.valor)::numeric total
  FROM public.pagamentos_receber_teste pg
  WHERE extract(year FROM (pg.pago_em AT TIME ZONE 'America/Sao_Paulo'))=p_ano
  GROUP BY 1
 )
 SELECT m.n,coalesce(p.total,0)::numeric,coalesce(r.total,0)::numeric
 FROM meses m LEFT JOIN previstos p ON p.n=m.n LEFT JOIN recebimentos r ON r.n=m.n
 ORDER BY m.n;
END $financeiro$;
REVOKE ALL ON FUNCTION public.criar_conta_parcelada_teste(uuid,uuid,text,numeric,date,integer),
 public.listar_parcelas_receber_teste(),public.resumo_financeiro_mensal_teste(integer)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_conta_parcelada_teste(uuid,uuid,text,numeric,date,integer),
 public.listar_parcelas_receber_teste(),public.resumo_financeiro_mensal_teste(integer)
 TO authenticated;
COMMIT;
