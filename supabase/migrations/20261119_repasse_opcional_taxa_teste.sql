-- MAJESTIC SANTE | Repasse opcional da taxa, separadamente por perfil (FICTICIO).
-- Atualiza apenas cadastros NOVOS; os anteriores conservam os valores registrados.
BEGIN;
ALTER TABLE public.protocolos_precificacao_teste ADD COLUMN IF NOT EXISTS repassar_taxa boolean NOT NULL DEFAULT false;
ALTER TABLE public.procedimentos_carol_teste ADD COLUMN IF NOT EXISTS repassar_taxa boolean NOT NULL DEFAULT false;
-- Identifica repasse nos registros anteriores pelo acréscimo que já existia.
UPDATE public.protocolos_precificacao_teste SET repassar_taxa=true
 WHERE total_cobrado>valor_acordado AND taxa_infinitepay>0 AND repassar_taxa=false;
UPDATE public.procedimentos_carol_teste SET repassar_taxa=true
 WHERE total_cobrado>valor_acordado AND taxa_percentual>0 AND repassar_taxa=false;

CREATE OR REPLACE FUNCTION public.validar_repasse_maquininha_teste(
 p_valor numeric,p_total numeric,p_forma text,p_parcelas integer,
 p_taxa numeric,p_taxa_valor numeric,p_liquido numeric,p_repassar boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $val$
DECLARE v_esperado numeric;
BEGIN
 IF p_valor IS NULL OR p_total IS NULL OR p_valor<=0 OR p_total<=0
 OR p_valor>10000000 OR p_total>10000000
 OR p_valor<>round(p_valor,2) OR p_total<>round(p_total,2)
 OR p_forma IS NULL OR p_forma NOT IN ('pix','debito','credito','dinheiro','transferencia')
 OR p_parcelas IS NULL OR p_parcelas NOT BETWEEN 1 AND 12
 OR (p_forma<>'credito' AND p_parcelas<>1)
 OR p_taxa IS NULL OR p_taxa<0 OR p_taxa>50 OR p_taxa<>round(p_taxa,3)
 OR p_taxa_valor IS NULL OR p_taxa_valor<0 OR p_taxa_valor<>round(p_taxa_valor,2)
 OR p_liquido IS NULL OR p_liquido<0 OR p_liquido<>round(p_liquido,2)
 OR p_repassar IS NULL
 OR (p_forma IN ('pix','dinheiro','transferencia') AND (p_taxa<>0 OR p_repassar))
 THEN RAISE EXCEPTION 'Dados de forma de pagamento ou taxas invalidos'; END IF;
 v_esperado:=CASE WHEN p_repassar
  THEN round(p_valor/(1-p_taxa/100),2) ELSE p_valor END;
 IF p_total<>v_esperado
 OR abs(round(p_total*p_taxa/100,2)-p_taxa_valor)>0.01
 OR abs(p_total-p_taxa_valor-p_liquido)>0.01
 THEN RAISE EXCEPTION 'Repasse, total cobrado ou liquido nao correspondem a taxa informada'; END IF;
END $val$;
REVOKE ALL ON FUNCTION public.validar_repasse_maquininha_teste(
 numeric,numeric,text,integer,numeric,numeric,numeric,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.criar_protocolo_com_repasse_taxa_teste(
 p_paciente_id uuid,p_codigo text,p_inicio date,p_valor_acordado numeric,
 p_total_cobrado numeric,p_parcelas integer,p_taxa numeric,p_percentual_clinica numeric,
 p_forma text,p_taxa_valor numeric,p_liquido numeric,p_repassar boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cad$
DECLARE v_id uuid;v_servico record;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso restrito ao medico'; END IF;
 PERFORM public.validar_repasse_maquininha_teste(p_valor_acordado,p_total_cobrado,
 p_forma,p_parcelas,p_taxa,p_taxa_valor,p_liquido,p_repassar);
 SELECT * INTO v_servico FROM public.catalogo_servicos_teste c
 WHERE c.codigo=p_codigo AND c.tipo='protocolo' AND c.ativo=true;
 IF NOT FOUND OR p_inicio IS NULL THEN RAISE EXCEPTION 'Protocolo ou data invalidos'; END IF;
 IF p_percentual_clinica IS NULL OR p_percentual_clinica<0
 OR p_percentual_clinica>100 OR p_percentual_clinica<>round(p_percentual_clinica,2)
 THEN RAISE EXCEPTION 'Percentual de repasse clinica invalido'; END IF;
 v_id:=public.criar_protocolo_com_percentual_teste(p_paciente_id,v_servico.nome,
 p_inicio,v_servico.duracao_dias,p_total_cobrado,p_percentual_clinica);
 INSERT INTO public.protocolos_precificacao_teste(
 protocolo_id,codigo_catalogo,valor_tabela,valor_acordado,parcelas,
 taxa_infinitepay,total_cobrado,forma_pagamento,taxa_valor,liquido_estimado,
 repassar_taxa,criado_por)
 VALUES(v_id,p_codigo,v_servico.valor_tabela,p_valor_acordado,p_parcelas,
 p_taxa,p_total_cobrado,p_forma,p_taxa_valor,p_liquido,p_repassar,auth.uid());
 RETURN v_id;
END $cad$;

CREATE OR REPLACE FUNCTION public.criar_procedimento_carol_repasse_teste(
 p_paciente_id uuid,p_descricao text,p_detalhes text,p_data_prevista date,
 p_valor_acordado numeric,p_total_cobrado numeric,p_forma text,p_parcelas integer,
 p_taxa numeric,p_taxa_valor numeric,p_liquido numeric,p_repassar boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cad$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='enfermeira')
 THEN RAISE EXCEPTION 'Acesso restrito ao perfil da enfermagem'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente ficticio nao encontrado'; END IF;
 IF length(btrim(coalesce(p_descricao,''))) NOT BETWEEN 3 AND 160
 OR length(coalesce(p_detalhes,''))>1000 OR p_data_prevista IS NULL
 THEN RAISE EXCEPTION 'Descricao ou data invalida'; END IF;
 PERFORM public.validar_repasse_maquininha_teste(p_valor_acordado,p_total_cobrado,
 p_forma,p_parcelas,p_taxa,p_taxa_valor,p_liquido,p_repassar);
 INSERT INTO public.procedimentos_carol_teste(
 paciente_id,descricao,detalhes,data_prevista,valor_acordado,total_cobrado,
 forma_pagamento,parcelas,taxa_percentual,taxa_valor,liquido_estimado,repassar_taxa,criado_por
 ) VALUES(p_paciente_id,btrim(p_descricao),nullif(btrim(p_detalhes),''),
 p_data_prevista,p_valor_acordado,p_total_cobrado,p_forma,p_parcelas,
 p_taxa,p_taxa_valor,p_liquido,p_repassar,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $cad$;

CREATE OR REPLACE FUNCTION public.listar_precificacao_repasse_teste()
RETURNS TABLE(protocolo_id uuid,valor_tabela numeric,valor_acordado numeric,
 parcelas integer,taxa_infinitepay numeric,total_cobrado numeric,
 forma_pagamento text,taxa_valor numeric,liquido_estimado numeric,repassar_taxa boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cad$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
  AND p.ativo AND p.perfil='medico') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 RETURN QUERY SELECT q.protocolo_id,q.valor_tabela,q.valor_acordado,
 q.parcelas,q.taxa_infinitepay,q.total_cobrado,q.forma_pagamento,q.taxa_valor,
 q.liquido_estimado,q.repassar_taxa
 FROM public.protocolos_precificacao_teste q ORDER BY q.criado_em DESC LIMIT 2000;
END $cad$;

CREATE OR REPLACE FUNCTION public.listar_procedimentos_carol_repasse_teste()
RETURNS TABLE(id uuid,paciente_nome text,descricao text,detalhes text,
 data_prevista date,valor_acordado numeric,total_cobrado numeric,
 forma_pagamento text,parcelas integer,taxa_percentual numeric,
 taxa_valor numeric,liquido_estimado numeric,repassar_taxa boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $cad$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
  AND p.ativo AND p.perfil='enfermeira') THEN RAISE EXCEPTION 'Acesso restrito'; END IF;
 RETURN QUERY SELECT q.id,pa.nome::text,q.descricao,q.detalhes,q.data_prevista,
 q.valor_acordado,q.total_cobrado,q.forma_pagamento,q.parcelas,
 q.taxa_percentual,q.taxa_valor,q.liquido_estimado,q.repassar_taxa
 FROM public.procedimentos_carol_teste q
 JOIN public.pacientes pa ON pa.id=q.paciente_id
 WHERE q.criado_por=auth.uid() ORDER BY q.criado_em DESC LIMIT 500;
END $cad$;

REVOKE ALL ON FUNCTION public.criar_protocolo_com_repasse_taxa_teste(uuid,text,date,numeric,numeric,integer,numeric,numeric,text,numeric,numeric,boolean),
 public.criar_procedimento_carol_repasse_teste(uuid,text,text,date,numeric,numeric,text,integer,numeric,numeric,numeric,boolean),
 public.listar_precificacao_repasse_teste(),public.listar_procedimentos_carol_repasse_teste()
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_protocolo_com_repasse_taxa_teste(uuid,text,date,numeric,numeric,integer,numeric,numeric,text,numeric,numeric,boolean),
 public.criar_procedimento_carol_repasse_teste(uuid,text,text,date,numeric,numeric,text,integer,numeric,numeric,numeric,boolean),
 public.listar_precificacao_repasse_teste(),public.listar_procedimentos_carol_repasse_teste()
 TO authenticated;
COMMIT;
