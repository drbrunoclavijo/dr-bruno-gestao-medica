-- Majestic Sante | catalogo de servicos e precificacao de tratamentos ficticios.
-- Nao permite que consultas sejam tratadas como protocolos de aplicacoes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.catalogo_servicos_teste(
 codigo text PRIMARY KEY,
 nome text NOT NULL,
 tipo text NOT NULL CHECK(tipo IN ('protocolo','consulta')),
 valor_tabela numeric(12,2) NOT NULL CHECK(valor_tabela>0),
 duracao_dias integer,
 ativo boolean NOT NULL DEFAULT true
);
INSERT INTO public.catalogo_servicos_teste(codigo,nome,tipo,valor_tabela,duracao_dias)
VALUES
 ('essential_reset','Essential Reset','protocolo',4490,45),
 ('performance_90','Performance 90','protocolo',7500,90),
 ('elite_longevity','Elite Longevity Premium','protocolo',10900,90),
 ('consulta_ortopedia','Consulta ortopédica','consulta',550,NULL),
 ('consulta_performance','Consulta de alta performance','consulta',700,NULL)
ON CONFLICT(codigo) DO UPDATE SET
 nome=excluded.nome,tipo=excluded.tipo,valor_tabela=excluded.valor_tabela,
 duracao_dias=excluded.duracao_dias;
ALTER TABLE public.catalogo_servicos_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogo_servicos_teste FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.protocolos_precificacao_teste(
 protocolo_id uuid PRIMARY KEY REFERENCES public.protocolos_teste(id) ON DELETE RESTRICT,
 codigo_catalogo text NOT NULL REFERENCES public.catalogo_servicos_teste(codigo),
 valor_tabela numeric(12,2) NOT NULL CHECK(valor_tabela>0),
 valor_acordado numeric(12,2) NOT NULL CHECK(valor_acordado>0),
 parcelas integer NOT NULL CHECK(parcelas BETWEEN 1 AND 12),
 taxa_infinitepay numeric(6,3) NOT NULL CHECK(taxa_infinitepay>=0 AND taxa_infinitepay<100),
 total_cobrado numeric(12,2) NOT NULL CHECK(total_cobrado>0),
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.protocolos_precificacao_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.protocolos_precificacao_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.listar_catalogo_servicos_teste()
RETURNS TABLE(codigo text,nome text,tipo text,valor_tabela numeric,duracao_dias integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $catalogo$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao medico'; END IF;
 RETURN QUERY SELECT c.codigo,c.nome,c.tipo,c.valor_tabela,c.duracao_dias
 FROM public.catalogo_servicos_teste c WHERE c.ativo ORDER BY
 CASE c.codigo WHEN 'essential_reset' THEN 1 WHEN 'performance_90' THEN 2
 WHEN 'elite_longevity' THEN 3 WHEN 'consulta_ortopedia' THEN 4 ELSE 5 END;
END $catalogo$;

CREATE OR REPLACE FUNCTION public.criar_protocolo_catalogo_teste(
 p_paciente_id uuid,p_codigo text,p_inicio date,p_valor_acordado numeric,
 p_total_cobrado numeric,p_parcelas integer,p_taxa numeric,p_percentual_clinica numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $catalogo$
DECLARE v_catalogo record;v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao medico'; END IF;
 SELECT c.* INTO v_catalogo FROM public.catalogo_servicos_teste c
 WHERE c.codigo=p_codigo AND c.tipo='protocolo' AND c.ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo nao encontrado no catalogo'; END IF;
 IF p_valor_acordado IS NULL OR p_valor_acordado<=0 OR p_valor_acordado>10000000
 OR p_valor_acordado<>round(p_valor_acordado,2)
 OR p_total_cobrado IS NULL OR p_total_cobrado<=0 OR p_total_cobrado>10000000
 OR p_total_cobrado<>round(p_total_cobrado,2)
 OR p_parcelas NOT BETWEEN 1 AND 12 OR p_taxa IS NULL
 OR p_taxa<0 OR p_taxa>=100 OR p_taxa<>round(p_taxa,3)
 OR p_percentual_clinica IS NULL OR p_percentual_clinica<0 OR p_percentual_clinica>100
 OR p_percentual_clinica<>round(p_percentual_clinica,2)
 OR p_inicio IS NULL THEN RAISE EXCEPTION 'Dados de precificacao invalidos'; END IF;
 IF p_parcelas<=6 AND (p_taxa<>0 OR p_total_cobrado<>p_valor_acordado)
 THEN RAISE EXCEPTION 'Ate 6x deve permanecer sem acrescimo'; END IF;
 IF p_parcelas>6 AND (p_taxa<=0 OR abs(p_total_cobrado-round(p_valor_acordado/(1-p_taxa/100),2))>0.01)
 THEN RAISE EXCEPTION 'Taxa e total das parcelas nao correspondem ao calculo'; END IF;
 v_id:=public.criar_protocolo_com_percentual_teste(
 p_paciente_id,v_catalogo.nome,p_inicio,v_catalogo.duracao_dias,
 p_total_cobrado,p_percentual_clinica);
 INSERT INTO public.protocolos_precificacao_teste
 (protocolo_id,codigo_catalogo,valor_tabela,valor_acordado,parcelas,taxa_infinitepay,total_cobrado,criado_por)
 VALUES(v_id,p_codigo,v_catalogo.valor_tabela,p_valor_acordado,p_parcelas,p_taxa,p_total_cobrado,auth.uid());
 RETURN v_id;
END $catalogo$;

CREATE OR REPLACE FUNCTION public.listar_precificacao_protocolos_teste()
RETURNS TABLE(protocolo_id uuid,valor_tabela numeric,valor_acordado numeric,
 parcelas integer,taxa_infinitepay numeric,total_cobrado numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $catalogo$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao medico'; END IF;
 RETURN QUERY SELECT p.protocolo_id,p.valor_tabela,p.valor_acordado,p.parcelas,p.taxa_infinitepay,p.total_cobrado
 FROM public.protocolos_precificacao_teste p ORDER BY p.criado_em DESC LIMIT 2000;
END $catalogo$;

REVOKE ALL ON FUNCTION public.listar_catalogo_servicos_teste(),
 public.criar_protocolo_catalogo_teste(uuid,text,date,numeric,numeric,integer,numeric,numeric),
 public.listar_precificacao_protocolos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_catalogo_servicos_teste(),
 public.criar_protocolo_catalogo_teste(uuid,text,date,numeric,numeric,integer,numeric,numeric),
 public.listar_precificacao_protocolos_teste() TO authenticated;
COMMIT;
