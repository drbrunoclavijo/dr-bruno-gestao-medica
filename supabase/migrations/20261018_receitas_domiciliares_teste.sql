-- Receita domiciliar ficticia independente da prescricao de aplicacoes.
-- Somente medico autenticado e ativo. Sem assinatura ICP-Brasil e sem WhatsApp.
BEGIN;
CREATE TABLE IF NOT EXISTS public.receitas_domiciliares_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 medico_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT DEFAULT auth.uid(),
 criado_em timestamptz NOT NULL DEFAULT now(),
 tipo text NOT NULL DEFAULT 'simples' CHECK (tipo='simples'),
 indicacoes jsonb NOT NULL CHECK (jsonb_typeof(indicacoes)='array' AND jsonb_array_length(indicacoes) BETWEEN 1 AND 20),
 observacoes text CHECK (length(observacoes)<=2000),
 status_assinatura text NOT NULL DEFAULT 'nao_assinada' CHECK(status_assinatura='nao_assinada'),
 CONSTRAINT receita_domiciliar_medidas CHECK(pg_column_size(indicacoes)<=25000)
);
CREATE INDEX IF NOT EXISTS receitas_domiciliares_paciente_idx ON public.receitas_domiciliares_teste(paciente_id,criado_em DESC);
ALTER TABLE public.receitas_domiciliares_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.receitas_domiciliares_teste FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.receitas_domiciliares_teste TO authenticated;
CREATE POLICY receitas_domiciliares_medico_ler_teste ON public.receitas_domiciliares_teste
FOR SELECT TO authenticated USING (
 medico_id=auth.uid()
 AND EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico')
);
CREATE OR REPLACE FUNCTION public.salvar_receita_domiciliar_teste(
 p_paciente_id uuid,p_indicacoes jsonb,p_observacoes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $rc$
DECLARE v_id uuid;v_item jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Apenas medico ativo pode registrar receitas domiciliares';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes WHERE id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente de teste nao encontrado';END IF;
 IF p_indicacoes IS NULL OR jsonb_typeof(p_indicacoes)<>'array'
 OR jsonb_array_length(p_indicacoes) NOT BETWEEN 1 AND 20
 OR pg_column_size(p_indicacoes)>25000 OR length(coalesce(p_observacoes,''))>2000
 THEN RAISE EXCEPTION 'Receita invalida';END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_indicacoes)
 LOOP
  IF jsonb_typeof(v_item)<>'object'
  OR nullif(btrim(v_item->>'medicamento'),'') IS NULL
  OR nullif(btrim(v_item->>'posologia'),'') IS NULL
  OR length(coalesce(v_item->>'medicamento',''))>200
  OR length(coalesce(v_item->>'posologia',''))>500
  OR length(coalesce(v_item->>'quantidade',''))>120
  OR length(coalesce(v_item->>'orientacoes',''))>1000
  THEN RAISE EXCEPTION 'Item de receita incompleto ou longo demais';END IF;
 END LOOP;
 INSERT INTO public.receitas_domiciliares_teste(paciente_id,medico_id,indicacoes,observacoes)
 VALUES(p_paciente_id,auth.uid(),p_indicacoes,nullif(btrim(p_observacoes),''))
 RETURNING id INTO v_id;
 RETURN v_id;
END $rc$;
REVOKE ALL ON FUNCTION public.salvar_receita_domiciliar_teste(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.salvar_receita_domiciliar_teste(uuid,jsonb,text) TO authenticated;
COMMIT;
