-- MAJESTIC SANTÉ | PROTOCOLOS FINANCEIROS DE TESTE, SEM DADOS REAIS.
BEGIN;
CREATE TABLE IF NOT EXISTS public.protocolos_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 nome text NOT NULL CHECK(length(btrim(nome)) BETWEEN 1 AND 160),
 inicio date NOT NULL,
 duracao_dias integer NOT NULL CHECK(duracao_dias BETWEEN 1 AND 730),
 preco_cobrado numeric(12,2) NOT NULL CHECK(preco_cobrado >= 0),
 status text NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','concluido','cancelado')),
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.protocolo_prescricoes_teste(
 protocolo_id uuid NOT NULL REFERENCES public.protocolos_teste(id) ON DELETE RESTRICT,
 prescricao_id uuid NOT NULL UNIQUE REFERENCES public.prescricoes_teste(id) ON DELETE RESTRICT,
 vinculado_por uuid NOT NULL REFERENCES auth.users(id),
 vinculado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(protocolo_id,prescricao_id)
);
CREATE INDEX IF NOT EXISTS protocolos_teste_paciente_idx ON public.protocolos_teste(paciente_id,criado_em DESC);
CREATE INDEX IF NOT EXISTS protocolo_prescricoes_protocolo_idx ON public.protocolo_prescricoes_teste(protocolo_id);
ALTER TABLE public.protocolos_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_prescricoes_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.protocolos_teste,public.protocolo_prescricoes_teste FROM anon,authenticated;

-- Somente médico ativo. As duas tabelas são acessadas por funções controladas.
CREATE OR REPLACE FUNCTION public.criar_protocolo_teste(
 p_paciente_id uuid,p_nome text,p_inicio date,p_duracao_dias integer,p_preco_cobrado numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes WHERE id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente fictício não encontrado'; END IF;
 IF p_nome IS NULL OR length(btrim(p_nome)) NOT BETWEEN 1 AND 160
 OR p_inicio IS NULL OR p_duracao_dias IS NULL OR p_duracao_dias NOT BETWEEN 1 AND 730
 OR p_preco_cobrado IS NULL OR p_preco_cobrado<0 OR p_preco_cobrado>9999999999.99
 THEN RAISE EXCEPTION 'Dados inválidos'; END IF;
 INSERT INTO public.protocolos_teste(paciente_id,nome,inicio,duracao_dias,preco_cobrado,criado_por)
 VALUES(p_paciente_id,btrim(p_nome),p_inicio,p_duracao_dias,p_preco_cobrado,auth.uid())
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.vincular_prescricao_protocolo_teste(
 p_protocolo_id uuid,p_prescricao_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_patient uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 SELECT paciente_id INTO v_patient FROM public.protocolos_teste WHERE id=p_protocolo_id;
 IF v_patient IS NULL THEN RAISE EXCEPTION 'Protocolo não encontrado'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.prescricoes_teste rx
  WHERE rx.id=p_prescricao_id AND rx.paciente_id=v_patient
 ) THEN RAISE EXCEPTION 'Prescrição não pertence ao paciente do protocolo'; END IF;
 INSERT INTO public.protocolo_prescricoes_teste(protocolo_id,prescricao_id,vinculado_por)
 VALUES(p_protocolo_id,p_prescricao_id,auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.listar_protocolos_teste()
RETURNS TABLE(
 protocolo_id uuid,paciente_id uuid,paciente_nome text,nome text,inicio date,
 duracao_dias integer,preco_cobrado numeric,status text,criado_em timestamptz,
 prescricoes_vinculadas bigint,checagens_registradas bigint,custo_conhecido numeric,
 saidas_sem_custo bigint,quantidade_saida numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 RETURN QUERY
 SELECT pr.id,pr.paciente_id,pa.nome::text,pr.nome::text,pr.inicio,
 pr.duracao_dias,pr.preco_cobrado,pr.status::text,pr.criado_em,
 (SELECT count(*) FROM public.protocolo_prescricoes_teste rel WHERE rel.protocolo_id=pr.id),
 (SELECT count(DISTINCT m.administracao_id)
 FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
 JOIN public.estoque_movimentos_teste m ON m.item_prescricao_id=it.id
 WHERE rel.protocolo_id=pr.id),
 (SELECT coalesce(sum(m.custo_saida),0)
 FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
 JOIN public.estoque_movimentos_teste m ON m.item_prescricao_id=it.id
 WHERE rel.protocolo_id=pr.id),
 (SELECT count(*)
 FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
 JOIN public.estoque_movimentos_teste m ON m.item_prescricao_id=it.id
 WHERE rel.protocolo_id=pr.id AND m.custo_saida IS NULL),
 (SELECT coalesce(sum(m.quantidade),0)
 FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
 JOIN public.estoque_movimentos_teste m ON m.item_prescricao_id=it.id
 WHERE rel.protocolo_id=pr.id)
 FROM public.protocolos_teste pr
 JOIN public.pacientes pa ON pa.id=pr.paciente_id
 ORDER BY pr.criado_em DESC LIMIT 300;
END $$;

CREATE OR REPLACE FUNCTION public.listar_prescricoes_para_protocolos_teste()
RETURNS TABLE(prescricao_id uuid,paciente_id uuid,paciente_nome text,criado_em timestamptz,protocolo_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 RETURN QUERY SELECT rx.id,rx.paciente_id,pa.nome::text,rx.criado_em,rel.protocolo_id
 FROM public.prescricoes_teste rx
 JOIN public.pacientes pa ON pa.id=rx.paciente_id
 LEFT JOIN public.protocolo_prescricoes_teste rel ON rel.prescricao_id=rx.id
 ORDER BY rx.criado_em DESC LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.criar_protocolo_teste(uuid,text,date,integer,numeric),
 public.vincular_prescricao_protocolo_teste(uuid,uuid),
 public.listar_protocolos_teste(),
 public.listar_prescricoes_para_protocolos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_protocolo_teste(uuid,text,date,integer,numeric),
 public.vincular_prescricao_protocolo_teste(uuid,uuid),
 public.listar_protocolos_teste(),
 public.listar_prescricoes_para_protocolos_teste() TO authenticated;
COMMIT;
