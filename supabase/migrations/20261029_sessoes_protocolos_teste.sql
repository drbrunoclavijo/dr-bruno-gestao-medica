-- Majestic Santé Institute | agenda de sessões de protocolos de TESTE
-- Planejamento não é administração. A checagem pela enfermagem permanece
-- a única via de baixa de medicamentos e insumos.
BEGIN;
CREATE TABLE IF NOT EXISTS public.sessoes_protocolos_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 protocolo_id uuid NOT NULL REFERENCES public.protocolos_teste(id) ON DELETE RESTRICT,
 item_prescricao_id uuid UNIQUE REFERENCES public.prescricao_itens_teste(id) ON DELETE RESTRICT,
 data_prevista date NOT NULL,
 descricao text NOT NULL CHECK(length(btrim(descricao)) BETWEEN 1 AND 160),
 observacao text CHECK(observacao IS NULL OR length(observacao)<=1000),
 status text NOT NULL DEFAULT 'agendada' CHECK(status IN ('agendada','cancelada')),
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 cancelado_por uuid REFERENCES auth.users(id),
 cancelado_em timestamptz
);
CREATE INDEX IF NOT EXISTS sessoes_protocolos_teste_protocolo_idx
 ON public.sessoes_protocolos_teste(protocolo_id,data_prevista,id);
ALTER TABLE public.sessoes_protocolos_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sessoes_protocolos_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.itens_sessoes_protocolos_teste()
RETURNS TABLE(protocolo_id uuid,item_id uuid,medicamento text,ja_checado boolean,ja_agendado boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 RETURN QUERY SELECT rel.protocolo_id,it.id,it.medicamento::text,
 EXISTS(SELECT 1 FROM public.administracoes_teste a WHERE a.item_prescricao_id=it.id),
 EXISTS(SELECT 1 FROM public.sessoes_protocolos_teste s
        WHERE s.item_prescricao_id=it.id AND s.status='agendada')
 FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
 ORDER BY it.medicamento,it.id;
END $$;

CREATE OR REPLACE FUNCTION public.criar_sessao_protocolo_teste(
 p_protocolo_id uuid,p_data_prevista date,p_descricao text,
 p_item_prescricao_id uuid DEFAULT NULL,p_observacao text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;v_inicio date;v_dias integer;v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 SELECT inicio,duracao_dias,status INTO v_inicio,v_dias,v_status
 FROM public.protocolos_teste WHERE id=p_protocolo_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado'; END IF;
 IF v_status<>'ativo' THEN RAISE EXCEPTION 'Protocolo não está ativo'; END IF;
 IF p_data_prevista IS NULL OR p_data_prevista<v_inicio
 OR p_data_prevista>=v_inicio+v_dias
 THEN RAISE EXCEPTION 'A data precisa estar dentro do período do protocolo'; END IF;
 IF length(btrim(coalesce(p_descricao,''))) NOT BETWEEN 1 AND 160
 OR length(coalesce(p_observacao,''))>1000
 THEN RAISE EXCEPTION 'Descrição ou observação inválida'; END IF;
 IF p_item_prescricao_id IS NOT NULL THEN
  IF NOT EXISTS(
   SELECT 1 FROM public.protocolo_prescricoes_teste rel
   JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
   WHERE rel.protocolo_id=p_protocolo_id AND it.id=p_item_prescricao_id
  ) THEN RAISE EXCEPTION 'Item não pertence às prescrições vinculadas ao protocolo'; END IF;
  IF EXISTS(SELECT 1 FROM public.administracoes_teste WHERE item_prescricao_id=p_item_prescricao_id)
  THEN RAISE EXCEPTION 'Item já checado. Selecione item ainda pendente'; END IF;
 END IF;
 INSERT INTO public.sessoes_protocolos_teste(
 protocolo_id,data_prevista,descricao,item_prescricao_id,observacao,criado_por
 ) VALUES(
 p_protocolo_id,p_data_prevista,btrim(p_descricao),p_item_prescricao_id,
 nullif(btrim(p_observacao),''),auth.uid()
 ) RETURNING id INTO v_id;
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'Este item prescrito já foi associado a uma sessão. Escolha outro item.';
END $$;

CREATE OR REPLACE FUNCTION public.cancelar_sessao_protocolo_teste(p_sessao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_item uuid;v_status text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 SELECT item_prescricao_id,status INTO v_item,v_status
 FROM public.sessoes_protocolos_teste WHERE id=p_sessao_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
 IF v_status<>'agendada' THEN RAISE EXCEPTION 'Sessão já cancelada'; END IF;
 IF v_item IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.administracoes_teste WHERE item_prescricao_id=v_item
 ) THEN RAISE EXCEPTION 'Não é permitido cancelar sessão com checagem registrada'; END IF;
 UPDATE public.sessoes_protocolos_teste SET status='cancelada',
 cancelado_por=auth.uid(),cancelado_em=now() WHERE id=p_sessao_id;
END $$;

CREATE OR REPLACE FUNCTION public.listar_sessoes_protocolos_teste()
RETURNS TABLE(
 sessao_id uuid,protocolo_id uuid,data_prevista date,descricao text,
 observacao text,status text,item_prescricao_id uuid,
 medicamento text,checado_em timestamptz,criado_em timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 RETURN QUERY SELECT s.id,s.protocolo_id,s.data_prevista,s.descricao::text,
 s.observacao::text,s.status::text,s.item_prescricao_id,
 it.medicamento::text,a.checado_em,s.criado_em
 FROM public.sessoes_protocolos_teste s
 LEFT JOIN public.prescricao_itens_teste it ON it.id=s.item_prescricao_id
 LEFT JOIN public.administracoes_teste a ON a.item_prescricao_id=s.item_prescricao_id
 ORDER BY s.data_prevista,s.criado_em,s.id LIMIT 2000;
END $$;

REVOKE ALL ON FUNCTION public.itens_sessoes_protocolos_teste(),
 public.criar_sessao_protocolo_teste(uuid,date,text,uuid,text),
 public.cancelar_sessao_protocolo_teste(uuid),
 public.listar_sessoes_protocolos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.itens_sessoes_protocolos_teste(),
 public.criar_sessao_protocolo_teste(uuid,date,text,uuid,text),
 public.cancelar_sessao_protocolo_teste(uuid),
 public.listar_sessoes_protocolos_teste() TO authenticated;
COMMIT;
