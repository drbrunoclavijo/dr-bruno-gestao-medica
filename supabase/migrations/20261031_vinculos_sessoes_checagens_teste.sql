-- Majestic Santé | Vínculo posterior de sessão a item prescrito e visualização pela enfermagem.
-- Apenas dados fictícios. Não cria administração e não movimenta estoque.
BEGIN;
CREATE OR REPLACE FUNCTION public.vincular_item_sessao_teste(
 p_sessao_id uuid,p_item_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_protocolo uuid;v_status text;v_existente uuid;v_status_protocolo text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM public.profissionais prof
 WHERE prof.id=auth.uid() AND prof.ativo AND prof.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 IF p_sessao_id IS NULL OR p_item_id IS NULL THEN RAISE EXCEPTION 'Sessão ou item ausente'; END IF;
 SELECT s.protocolo_id,s.status,s.item_prescricao_id
 INTO v_protocolo,v_status,v_existente
 FROM public.sessoes_protocolos_teste s WHERE s.id=p_sessao_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessão não encontrada'; END IF;
 SELECT p.status INTO v_status_protocolo FROM public.protocolos_teste p
 WHERE p.id=v_protocolo FOR UPDATE;
 IF v_status<>'agendada' OR v_status_protocolo<>'ativo'
 THEN RAISE EXCEPTION 'Sessão ou protocolo não está ativo'; END IF;
 IF v_existente IS NOT NULL THEN RAISE EXCEPTION 'Sessão já possui prescrição vinculada'; END IF;
 IF NOT EXISTS(
 SELECT 1 FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste i ON i.prescricao_id=rel.prescricao_id
 WHERE rel.protocolo_id=v_protocolo AND i.id=p_item_id
 ) THEN RAISE EXCEPTION 'Item não pertence ao paciente/protocolo desta sessão'; END IF;
 -- O item precisa permanecer não checado e sem sessão ativa.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text,0));
 IF EXISTS(SELECT 1 FROM public.administracoes_teste a WHERE a.item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Item já checado'; END IF;
 IF EXISTS(SELECT 1 FROM public.sessoes_protocolos_teste s
  WHERE s.item_prescricao_id=p_item_id AND s.status='agendada')
 THEN RAISE EXCEPTION 'Item já associado a outra sessão ativa'; END IF;
 UPDATE public.sessoes_protocolos_teste SET item_prescricao_id=p_item_id
 WHERE id=p_sessao_id;
END $$;

CREATE OR REPLACE FUNCTION public.sessoes_paciente_enfermagem_teste(p_paciente_id uuid)
RETURNS TABLE(
 sessao_id uuid,item_prescricao_id uuid,protocolo_nome text,
 data_prevista date,descricao text,status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM public.profissionais prof WHERE prof.id=auth.uid()
 AND prof.ativo AND prof.perfil IN ('medico','enfermeira')
 ) THEN RAISE EXCEPTION 'Acesso restrito à equipe clínica'; END IF;
 IF p_paciente_id IS NULL THEN RAISE EXCEPTION 'Paciente inválido'; END IF;
 RETURN QUERY
 SELECT s.id,s.item_prescricao_id,p.nome::text,s.data_prevista,
 s.descricao::text,s.status::text
 FROM public.sessoes_protocolos_teste s
 JOIN public.protocolos_teste p ON p.id=s.protocolo_id
 WHERE p.paciente_id=p_paciente_id AND s.status='agendada'
  AND s.item_prescricao_id IS NOT NULL
 ORDER BY s.data_prevista,s.id LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.vincular_item_sessao_teste(uuid,uuid),
 public.sessoes_paciente_enfermagem_teste(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vincular_item_sessao_teste(uuid,uuid),
 public.sessoes_paciente_enfermagem_teste(uuid) TO authenticated;
COMMIT;
