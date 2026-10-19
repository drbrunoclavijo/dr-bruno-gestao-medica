-- Consulta segura dos detalhes de encerramento. Exclusiva do medico responsavel.
-- Ambiente de homologacao com pacientes ficticios.
BEGIN;
CREATE OR REPLACE FUNCTION public.consultar_encerramento_consulta_teste(p_agendamento_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso medico obrigatorio'; END IF;
 SELECT pg_catalog.jsonb_build_object(
  'id',e.id,
  'agendamento_id',e.agendamento_id,
  'consulta_id',e.consulta_id,
  'encerrado_em',e.encerrado_em,
  'medico_nome',p.nome,
  'status',a.status
 ) INTO v_result
 FROM public.encerramentos_consulta_teste e
 JOIN public.agendamentos_teste a ON a.id=e.agendamento_id
 JOIN public.profissionais p ON p.id=e.medico_id
 WHERE e.agendamento_id=p_agendamento_id AND e.medico_id=auth.uid()
   AND a.profissional_id=auth.uid();
 RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.consultar_encerramento_consulta_teste(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_encerramento_consulta_teste(uuid) TO authenticated;
COMMIT;
