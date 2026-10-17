-- Majestic Sante | Perfis separados de precificacao, procedimentos da Carol e taxas.
-- Dados ficticios; nao movimenta dinheiro nem emite cobranças.
BEGIN;
ALTER TABLE public.protocolos_precificacao_teste
 ADD COLUMN IF NOT EXISTS forma_pagamento text NOT NULL DEFAULT 'credito'
 CHECK(forma_pagamento IN ('pix','debito','credito','dinheiro','transferencia'));
ALTER TABLE public.protocolos_precificacao_teste
 ADD COLUMN IF NOT EXISTS taxa_valor numeric(12,2) NOT NULL DEFAULT 0 CHECK(taxa_valor>=0);
ALTER TABLE public.protocolos_precificacao_teste
 ADD COLUMN IF NOT EXISTS liquido_estimado numeric(12,2) NOT NULL DEFAULT 0 CHECK(liquido_estimado>=0);

CREATE TABLE IF NOT EXISTS public.procedimentos_carol_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 descricao text NOT NULL CHECK(length(btrim(descricao)) BETWEEN 3 AND 160),
 detalhes text CHECK(detalhes IS NULL OR length(detalhes)<=1000),
 data_prevista date NOT NULL,
 valor_acordado numeric(12,2) NOT NULL CHECK(valor_acordado>0),
 total_cobrado numeric(12,2) NOT NULL CHECK(total_cobrado>0),
 forma_pagamento text NOT NULL CHECK(forma_pagamento IN ('pix','debito','credito','dinheiro','transferencia')),
 parcelas integer NOT NULL CHECK(parcelas BETWEEN 1 AND 12),
 taxa_percentual numeric(6,3) NOT NULL CHECK(taxa_percentual>=0 AND taxa_percentual<100),
 taxa_valor numeric(12,2) NOT NULL CHECK(taxa_valor>=0),
 liquido_estimado numeric(12,2) NOT NULL CHECK(liquido_estimado>=0),
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.procedimentos_carol_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.procedimentos_carol_teste FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS procedimentos_carol_criado_teste_idx ON public.procedimentos_carol_teste(criado_por,criado_em DESC);

CREATE OR REPLACE FUNCTION public.criar_procedimento_carol_teste(
 p_paciente_id uuid,p_descricao text,p_detalhes text,p_data_prevista date,
 p_valor_acordado numeric,p_total_cobrado numeric,p_forma text,
 p_parcelas integer,p_taxa numeric,p_taxa_valor numeric,p_liquido numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
   AND u.ativo AND u.perfil='enfermeira')
 THEN RAISE EXCEPTION 'Cadastro reservado ao perfil de enfermagem'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes pa WHERE pa.id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente ficticio nao encontrado'; END IF;
 IF length(btrim(coalesce(p_descricao,''))) NOT BETWEEN 3 AND 160
 OR length(coalesce(p_detalhes,''))>1000 OR p_data_prevista IS NULL
 OR p_valor_acordado IS NULL OR p_valor_acordado<=0 OR p_valor_acordado>10000000
 OR p_total_cobrado IS NULL OR p_total_cobrado<=0 OR p_total_cobrado>10000000
 OR p_valor_acordado<>round(p_valor_acordado,2) OR p_total_cobrado<>round(p_total_cobrado,2)
 OR p_forma NOT IN ('pix','debito','credito','dinheiro','transferencia')
 OR p_parcelas NOT BETWEEN 1 AND 12 OR (p_forma<>'credito' AND p_parcelas<>1)
 OR p_taxa IS NULL OR p_taxa<0 OR p_taxa>50 OR p_taxa<>round(p_taxa,3)
 OR p_taxa_valor IS NULL OR p_taxa_valor<0 OR p_taxa_valor<>round(p_taxa_valor,2)
 OR p_liquido IS NULL OR p_liquido<0 OR p_liquido<>round(p_liquido,2)
 OR abs(round(p_total_cobrado*p_taxa/100,2)-p_taxa_valor)>0.01
 OR abs(p_total_cobrado-p_taxa_valor-p_liquido)>0.01
 OR (p_forma<>'credito' AND p_total_cobrado<>p_valor_acordado)
 OR (p_forma='credito' AND p_parcelas<=6 AND p_total_cobrado<>p_valor_acordado)
 OR (p_forma='credito' AND p_parcelas>6 AND abs(round(p_valor_acordado/(1-p_taxa/100),2)-p_total_cobrado)>0.01)
 THEN RAISE EXCEPTION 'Parametros financeiros invalidos'; END IF;
 INSERT INTO public.procedimentos_carol_teste(
 paciente_id,descricao,detalhes,data_prevista,valor_acordado,total_cobrado,forma_pagamento,
 parcelas,taxa_percentual,taxa_valor,liquido_estimado,criado_por
 ) VALUES(p_paciente_id,btrim(p_descricao),nullif(btrim(p_detalhes),''),
 p_data_prevista,p_valor_acordado,p_total_cobrado,p_forma,p_parcelas,
 p_taxa,p_taxa_valor,p_liquido,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $p$;

CREATE OR REPLACE FUNCTION public.listar_procedimentos_carol_teste()
RETURNS TABLE(id uuid,paciente_nome text,descricao text,detalhes text,data_prevista date,
 valor_acordado numeric,total_cobrado numeric,forma_pagamento text,
 parcelas integer,taxa_percentual numeric,taxa_valor numeric,liquido_estimado numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
   AND u.ativo AND u.perfil='enfermeira')
 THEN RAISE EXCEPTION 'Acesso reservado ao perfil de enfermagem'; END IF;
 RETURN QUERY SELECT pr.id,p.nome::text,pr.descricao,pr.detalhes,pr.data_prevista,
  pr.valor_acordado,pr.total_cobrado,pr.forma_pagamento,pr.parcelas,
  pr.taxa_percentual,pr.taxa_valor,pr.liquido_estimado
 FROM public.procedimentos_carol_teste pr
 JOIN public.pacientes p ON p.id=pr.paciente_id
 WHERE pr.criado_por=auth.uid()
 ORDER BY pr.criado_em DESC LIMIT 500;
END $p$;

-- A gravacao da venda do Bruno preserva o valor do protocolo,
-- mas detalha a taxa de cartao mesmo quando a clinica a absorve.
CREATE OR REPLACE FUNCTION public.criar_protocolo_com_pagamento_teste(
 p_paciente_id uuid,p_codigo text,p_inicio date,p_valor_acordado numeric,
 p_total_cobrado numeric,p_parcelas integer,p_taxa numeric,
 p_percentual_clinica numeric,p_forma text,p_taxa_valor numeric,p_liquido numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
   AND u.ativo AND u.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao medico'; END IF;
 IF p_forma NOT IN ('pix','debito','credito','dinheiro','transferencia')
 OR (p_forma<>'credito' AND p_parcelas<>1)
 OR (p_forma<>'credito' AND p_total_cobrado<>p_valor_acordado)
 OR p_taxa IS NULL OR p_taxa<0 OR p_taxa>50
 OR p_taxa_valor IS NULL OR p_taxa_valor<0 OR p_taxa_valor<>round(p_taxa_valor,2)
 OR p_liquido IS NULL OR p_liquido<0 OR p_liquido<>round(p_liquido,2)
 OR abs(round(p_total_cobrado*p_taxa/100,2)-p_taxa_valor)>0.01
 OR abs(p_total_cobrado-p_taxa_valor-p_liquido)>0.01
 OR (p_forma='credito' AND p_parcelas<=6 AND p_total_cobrado<>p_valor_acordado)
 THEN RAISE EXCEPTION 'Pagamento ou taxas inconsistentes'; END IF;
 -- Funcao anterior exige taxa zero nos primeiros seis parcelamentos;
 -- portanto, a criacao clinica continua na RPC de percentual e a tabela
 -- de precificacao e gravada aqui com a taxa real separadamente.
 IF NOT EXISTS(SELECT 1 FROM public.catalogo_servicos_teste c
    WHERE c.codigo=p_codigo AND c.tipo='protocolo' AND c.ativo)
 THEN RAISE EXCEPTION 'Protocolo nao consta no catalogo'; END IF;
 IF p_valor_acordado IS NULL OR p_valor_acordado<=0 OR p_valor_acordado>10000000
 OR p_total_cobrado IS NULL OR p_total_cobrado<=0 OR p_total_cobrado>10000000
 OR p_parcelas NOT BETWEEN 1 AND 12
 OR p_valor_acordado<>round(p_valor_acordado,2)
 OR p_total_cobrado<>round(p_total_cobrado,2)
 OR p_taxa<>round(p_taxa,3)
 OR (p_parcelas>6 AND abs(round(p_valor_acordado/(1-p_taxa/100),2)-p_total_cobrado)>0.01)
 THEN RAISE EXCEPTION 'Valores e parcelamento invalidos'; END IF;
 SELECT public.criar_protocolo_com_percentual_teste(
  p_paciente_id,c.nome,p_inicio,c.duracao_dias,p_total_cobrado,p_percentual_clinica)
 INTO v_id FROM public.catalogo_servicos_teste c WHERE c.codigo=p_codigo;
 INSERT INTO public.protocolos_precificacao_teste
 (protocolo_id,codigo_catalogo,valor_tabela,valor_acordado,parcelas,taxa_infinitepay,
 total_cobrado,forma_pagamento,taxa_valor,liquido_estimado,criado_por)
 SELECT v_id,c.codigo,c.valor_tabela,p_valor_acordado,p_parcelas,p_taxa,
 p_total_cobrado,p_forma,p_taxa_valor,p_liquido,auth.uid()
 FROM public.catalogo_servicos_teste c WHERE c.codigo=p_codigo;
 RETURN v_id;
END $p$;

CREATE OR REPLACE FUNCTION public.listar_precificacao_pagamento_teste()
RETURNS TABLE(protocolo_id uuid,valor_tabela numeric,valor_acordado numeric,
 parcelas integer,taxa_infinitepay numeric,total_cobrado numeric,
 forma_pagamento text,taxa_valor numeric,liquido_estimado numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $p$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
   AND u.ativo AND u.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao medico'; END IF;
 RETURN QUERY SELECT p.protocolo_id,p.valor_tabela,p.valor_acordado,p.parcelas,
 p.taxa_infinitepay,p.total_cobrado,p.forma_pagamento,p.taxa_valor,p.liquido_estimado
 FROM public.protocolos_precificacao_teste p ORDER BY p.criado_em DESC LIMIT 2000;
END $p$;

REVOKE ALL ON FUNCTION public.criar_procedimento_carol_teste(uuid,text,text,date,numeric,numeric,text,integer,numeric,numeric,numeric),
 public.listar_procedimentos_carol_teste(),
 public.criar_protocolo_com_pagamento_teste(uuid,text,date,numeric,numeric,integer,numeric,numeric,text,numeric,numeric),
 public.listar_precificacao_pagamento_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_procedimento_carol_teste(uuid,text,text,date,numeric,numeric,text,integer,numeric,numeric,numeric),
 public.listar_procedimentos_carol_teste(),
 public.criar_protocolo_com_pagamento_teste(uuid,text,date,numeric,numeric,integer,numeric,numeric,text,numeric,numeric),
 public.listar_precificacao_pagamento_teste() TO authenticated;
COMMIT;
