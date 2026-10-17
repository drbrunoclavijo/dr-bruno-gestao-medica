-- Majestic Sante | Taxa da maquininha em pagamento efetivamente registrado.
-- Sem lancamento duplicado em despesas: resumo liquido deduz apenas esta tabela.
BEGIN;
CREATE TABLE IF NOT EXISTS public.taxas_pagamentos_teste(
 pagamento_id uuid PRIMARY KEY REFERENCES public.pagamentos_receber_teste(id) ON DELETE RESTRICT,
 taxa_percentual numeric(6,3) NOT NULL CHECK(taxa_percentual>=0 AND taxa_percentual<100),
 valor_taxa numeric(12,2) NOT NULL CHECK(valor_taxa>=0),
 liquido numeric(12,2) NOT NULL CHECK(liquido>=0),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.taxas_pagamentos_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.taxas_pagamentos_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.registrar_pagamento_com_taxa_teste(
 p_conta_id uuid,p_valor numeric,p_forma text,p_pago_em timestamptz,
 p_parcelas integer,p_referencia text,p_taxa numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
DECLARE v_id uuid;v_taxa numeric;v_net numeric;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.ativo AND p.perfil='medico') THEN RAISE EXCEPTION 'Acesso financeiro exclusivo ao medico'; END IF;
 IF p_taxa IS NULL OR p_taxa<0 OR p_taxa>50 OR p_taxa<>round(p_taxa,3)
 OR (p_forma NOT IN ('cartao_credito','cartao_debito') AND p_taxa<>0)
 OR (p_forma<>'cartao_credito' AND p_parcelas<>1)
 THEN RAISE EXCEPTION 'Taxa ou parcelamento invalidos'; END IF;
 v_id:=public.registrar_pagamento_receber_teste(p_conta_id,p_valor,p_forma,p_pago_em,p_parcelas,p_referencia);
 v_taxa:=round(p_valor*p_taxa/100,2);
 v_net:=p_valor-v_taxa;
 INSERT INTO public.taxas_pagamentos_teste(pagamento_id,taxa_percentual,valor_taxa,liquido)
 VALUES(v_id,p_taxa,v_taxa,v_net);
 RETURN v_id;
END $fin$;

CREATE OR REPLACE FUNCTION public.resumo_taxas_pagamentos_teste(p_ano integer)
RETURNS TABLE(mes integer,recebido_bruto numeric,desconto_maquininha numeric,recebido_liquido numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.ativo AND p.perfil='medico') THEN RAISE EXCEPTION 'Acesso financeiro exclusivo ao medico'; END IF;
 IF p_ano NOT BETWEEN 2020 AND 2100 THEN RAISE EXCEPTION 'Ano invalido'; END IF;
 RETURN QUERY
 SELECT m.n,
  coalesce(sum(pg.valor),0)::numeric,
  coalesce(sum(t.valor_taxa),0)::numeric,
  (coalesce(sum(pg.valor),0)-coalesce(sum(t.valor_taxa),0))::numeric
 FROM (SELECT generate_series(1,12) n) m
 LEFT JOIN public.pagamentos_receber_teste pg ON
  extract(month FROM (pg.pago_em AT TIME ZONE 'America/Sao_Paulo'))=m.n AND
  extract(year FROM (pg.pago_em AT TIME ZONE 'America/Sao_Paulo'))=p_ano
 LEFT JOIN public.taxas_pagamentos_teste t ON t.pagamento_id=pg.id
 GROUP BY m.n ORDER BY m.n;
END $fin$;

CREATE OR REPLACE FUNCTION public.taxas_resumo_atual_teste()
RETURNS TABLE(taxas_mes numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fin$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.ativo AND p.perfil='medico') THEN RAISE EXCEPTION 'Acesso financeiro exclusivo ao medico'; END IF;
 RETURN QUERY SELECT coalesce(sum(t.valor_taxa),0)::numeric
 FROM public.taxas_pagamentos_teste t
 JOIN public.pagamentos_receber_teste pg ON pg.id=t.pagamento_id
 WHERE date_trunc('month',pg.pago_em AT TIME ZONE 'America/Sao_Paulo')
 =date_trunc('month',now() AT TIME ZONE 'America/Sao_Paulo');
END $fin$;
REVOKE ALL ON FUNCTION public.registrar_pagamento_com_taxa_teste(uuid,numeric,text,timestamptz,integer,text,numeric),
 public.resumo_taxas_pagamentos_teste(integer),public.taxas_resumo_atual_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_pagamento_com_taxa_teste(uuid,numeric,text,timestamptz,integer,text,numeric),
 public.resumo_taxas_pagamentos_teste(integer),public.taxas_resumo_atual_teste() TO authenticated;
COMMIT;
