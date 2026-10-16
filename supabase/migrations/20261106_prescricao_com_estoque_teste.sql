-- Majestic Sante | Prescription plus OPTIONAL inventory link in one transaction (TEST DATA ONLY).
-- An error in ANY item rolls back both prescription and inventory links.
-- Does not decrease inventory, select batches, check or administer medication.
BEGIN;
CREATE OR REPLACE FUNCTION public.salvar_prescricao_com_estoque_teste(
 p_paciente_id uuid,p_consulta_id uuid,p_itens jsonb,p_observacoes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_medico uuid:=auth.uid();v_id uuid;v_item_id uuid;v_item jsonb;
 v_produto uuid;v_quantidade numeric;v_index integer:=0;v_tipo text;v_ativo boolean;
BEGIN
 IF v_medico IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=v_medico AND p.perfil='medico' AND p.ativo=true
 ) THEN RAISE EXCEPTION 'Perfil medico nao autorizado'; END IF;
 IF p_paciente_id IS NULL OR p_consulta_id IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.consultas_teste c WHERE c.id=p_consulta_id AND c.paciente_id=p_paciente_id
 ) THEN RAISE EXCEPTION 'Consulta nao pertence ao paciente'; END IF;
 IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_itens) NOT BETWEEN 1 AND 20
 THEN RAISE EXCEPTION 'Informe de 1 a 20 itens'; END IF;
 IF length(coalesce(p_observacoes,''))>3000 THEN RAISE EXCEPTION 'Observacoes muito longas'; END IF;
 -- Validate ALL input before writing.
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
  v_index:=v_index+1;
  IF jsonb_typeof(v_item)<>'object'
    OR length(btrim(coalesce(v_item->>'medicamento',''))) NOT BETWEEN 1 AND 200
    OR length(btrim(coalesce(v_item->>'dose',''))) NOT BETWEEN 1 AND 150
    OR length(btrim(coalesce(v_item->>'via',''))) NOT BETWEEN 1 AND 100
    OR length(btrim(coalesce(v_item->>'frequencia',''))) NOT BETWEEN 1 AND 150
    OR length(coalesce(v_item->>'duracao',''))>150
    OR length(coalesce(v_item->>'orientacoes',''))>3000
  THEN RAISE EXCEPTION 'Item %: dados clinicos invalidos',v_index; END IF;
  IF v_item ? 'produto_id' AND nullif(v_item->>'produto_id','') IS NOT NULL THEN
   BEGIN
    v_produto:=(v_item->>'produto_id')::uuid;
    v_quantidade:=(v_item->>'quantidade_estoque')::numeric;
   EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'Item %: produto ou quantidade do estoque invalido',v_index;
   END;
   IF v_produto IS NULL OR v_quantidade IS NULL OR v_quantidade<=0
    OR v_quantidade>100000 OR v_quantidade<>round(v_quantidade,3)
   THEN RAISE EXCEPTION 'Item %: quantidade deve ter ate tres decimais',v_index; END IF;
   SELECT p.tipo_produto::text,p.ativo INTO v_tipo,v_ativo
   FROM public.estoque_produtos_teste p WHERE p.id=v_produto;
   IF NOT FOUND OR v_tipo<>'medicamento' OR v_ativo IS DISTINCT FROM true
   THEN RAISE EXCEPTION 'Item %: selecione medicamento ativo no estoque',v_index; END IF;
  ELSIF v_item ? 'quantidade_estoque' AND nullif(v_item->>'quantidade_estoque','') IS NOT NULL
   THEN RAISE EXCEPTION 'Item %: escolha um produto para a quantidade informada',v_index;
  END IF;
 END LOOP;
 INSERT INTO public.prescricoes_teste(paciente_id,consulta_id,medico_id,observacoes)
 VALUES(p_paciente_id,p_consulta_id,v_medico,nullif(btrim(p_observacoes),''))
 RETURNING id INTO v_id;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_itens) LOOP
  INSERT INTO public.prescricao_itens_teste(
   prescricao_id,medicamento,dose,via,frequencia,duracao,orientacoes
  ) VALUES(
   v_id,btrim(v_item->>'medicamento'),btrim(v_item->>'dose'),
   btrim(v_item->>'via'),btrim(v_item->>'frequencia'),
   nullif(btrim(v_item->>'duracao'),''),nullif(btrim(v_item->>'orientacoes'),'')
  ) RETURNING id INTO v_item_id;
  IF nullif(v_item->>'produto_id','') IS NOT NULL THEN
   INSERT INTO public.estoque_vinculos_teste(item_prescricao_id,produto_id,quantidade)
   VALUES(v_item_id,(v_item->>'produto_id')::uuid,(v_item->>'quantidade_estoque')::numeric);
  END IF;
 END LOOP;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.salvar_prescricao_com_estoque_teste(uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_prescricao_com_estoque_teste(uuid,uuid,jsonb,text) TO authenticated;
COMMIT;
