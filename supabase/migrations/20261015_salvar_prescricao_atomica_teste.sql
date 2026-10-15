-- Prescrições fictícias: salvamento atômico de cabeçalho e itens.
-- Somente testes. Revisar segurança e rastreabilidade antes de uso clínico.
CREATE OR REPLACE FUNCTION public.salvar_prescricao_teste(
 p_paciente_id uuid, p_consulta_id uuid, p_itens jsonb, p_observacoes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
 v_medico uuid := auth.uid();
 v_id uuid;
 v_item jsonb;
BEGIN
 IF v_medico IS NULL THEN RAISE EXCEPTION 'Sessão não autenticada'; END IF;
 IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 20 THEN
   RAISE EXCEPTION 'Informe de 1 a 20 medicamentos fictícios';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.profissionais p WHERE p.id=v_medico AND p.perfil='medico' AND p.ativo=true
 ) THEN RAISE EXCEPTION 'Perfil médico não autorizado'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.consultas_teste c WHERE c.id=p_consulta_id AND c.paciente_id=p_paciente_id
 ) THEN RAISE EXCEPTION 'Consulta não corresponde ao paciente ou não está acessível'; END IF;
 IF length(coalesce(p_observacoes,''))>3000 THEN RAISE EXCEPTION 'Observações muito longas'; END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
   IF jsonb_typeof(v_item) <> 'object'
      OR length(btrim(coalesce(v_item->>'medicamento',''))) NOT BETWEEN 1 AND 200
      OR length(btrim(coalesce(v_item->>'dose',''))) NOT BETWEEN 1 AND 150
      OR length(btrim(coalesce(v_item->>'via',''))) NOT BETWEEN 1 AND 100
      OR length(btrim(coalesce(v_item->>'frequencia',''))) NOT BETWEEN 1 AND 150
      OR length(coalesce(v_item->>'duracao',''))>150
      OR length(coalesce(v_item->>'orientacoes',''))>3000
   THEN RAISE EXCEPTION 'Dados de medicamento incompletos ou inválidos'; END IF;
 END LOOP;
 INSERT INTO public.prescricoes_teste (paciente_id, consulta_id, medico_id, observacoes)
 VALUES (p_paciente_id,p_consulta_id,v_medico,nullif(btrim(p_observacoes),''))
 RETURNING id INTO v_id;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
  INSERT INTO public.prescricao_itens_teste
    (prescricao_id,medicamento,dose,via,frequencia,duracao,orientacoes)
  VALUES (v_id,btrim(v_item->>'medicamento'),btrim(v_item->>'dose'),
          btrim(v_item->>'via'),btrim(v_item->>'frequencia'),
          nullif(btrim(v_item->>'duracao'),''),
          nullif(btrim(v_item->>'orientacoes'),''));
 END LOOP;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.salvar_prescricao_teste(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_prescricao_teste(uuid,uuid,jsonb,text) TO authenticated;
