-- Majestic Santé | vínculo EM LOTE de sessões e itens de prescrição, somente testes.
-- Operação transacional: se um vínculo falhar, nenhum é gravado.
-- Não cria prescrições, não checa procedimentos nem movimenta estoque.
BEGIN;
CREATE OR REPLACE FUNCTION public.vincular_itens_sessoes_em_lote_teste(
 p_protocolo_id uuid, p_sessao_ids uuid[], p_item_ids uuid[]
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_count integer; v_idx integer; v_session uuid; v_item uuid;
 v_status text; v_s_status text; v_existing uuid; v_session_protocol uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais prof
  WHERE prof.id=auth.uid() AND prof.ativo=true AND prof.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 v_count:=coalesce(array_length(p_sessao_ids,1),0);
 IF p_protocolo_id IS NULL OR p_item_ids IS NULL OR p_sessao_ids IS NULL
    OR v_count<1 OR v_count>50
    OR coalesce(array_length(p_item_ids,1),0)<>v_count
 THEN RAISE EXCEPTION 'Informe de 1 a 50 pares de sessão e item de prescrição'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(p_sessao_ids) AS x WHERE x IS NULL)
 OR EXISTS (SELECT 1 FROM unnest(p_item_ids) AS x WHERE x IS NULL)
 OR (SELECT count(DISTINCT x) FROM unnest(p_sessao_ids) AS x)<>v_count
 OR (SELECT count(DISTINCT x) FROM unnest(p_item_ids) AS x)<>v_count
 THEN RAISE EXCEPTION 'Sessões e itens devem ser diferentes e válidos'; END IF;
 SELECT p.status INTO v_status FROM public.protocolos_teste p
 WHERE p.id=p_protocolo_id FOR UPDATE;
 IF NOT FOUND OR v_status<>'ativo' THEN
  RAISE EXCEPTION 'Protocolo não encontrado ou inativo'; END IF;

 -- Bloqueios dos itens em ordem estável, para preservar integridade concorrente.
 PERFORM pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(k.item_id::text,0))
 FROM (SELECT DISTINCT x.item_id FROM unnest(p_item_ids) AS x(item_id)
       ORDER BY x.item_id) k;
 PERFORM 1 FROM public.sessoes_protocolos_teste ss
 WHERE ss.id=ANY(p_sessao_ids) ORDER BY ss.id FOR UPDATE;
 FOR v_idx IN 1..v_count LOOP
  v_session:=p_sessao_ids[v_idx];
  v_item:=p_item_ids[v_idx];
  SELECT ss.protocolo_id,ss.status,ss.item_prescricao_id
   INTO v_session_protocol,v_s_status,v_existing
  FROM public.sessoes_protocolos_teste ss WHERE ss.id=v_session;
  IF NOT FOUND OR v_session_protocol<>p_protocolo_id OR v_s_status<>'agendada'
    OR v_existing IS NOT NULL
  THEN RAISE EXCEPTION 'Uma das sessões foi cancelada, alterada ou já vinculada'; END IF;
  IF NOT EXISTS(
    SELECT 1 FROM public.protocolo_prescricoes_teste rel
    JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
    WHERE rel.protocolo_id=p_protocolo_id AND it.id=v_item
  ) THEN RAISE EXCEPTION 'Item de prescrição não pertence ao protocolo'; END IF;
  IF EXISTS(SELECT 1 FROM public.administracoes_teste a
    WHERE a.item_prescricao_id=v_item)
    OR EXISTS(SELECT 1 FROM public.sessoes_protocolos_teste ss
    WHERE ss.item_prescricao_id=v_item AND ss.status='agendada')
  THEN RAISE EXCEPTION 'Item já checado ou vinculado a outra sessão'; END IF;
  UPDATE public.sessoes_protocolos_teste SET item_prescricao_id=v_item
   WHERE id=v_session;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.vincular_itens_sessoes_em_lote_teste(uuid,uuid[],uuid[])
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vincular_itens_sessoes_em_lote_teste(uuid,uuid[],uuid[])
 TO authenticated;
COMMIT;
