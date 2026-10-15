-- Majestic Sante | Angulos de fotografia de evolucao - SOMENTE TESTES FICTICIOS.
BEGIN;
ALTER TABLE public.documentos_pacientes_teste
 ADD COLUMN IF NOT EXISTS angulo_foto text;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='documentos_pacientes_teste_angulo_ck') THEN
  ALTER TABLE public.documentos_pacientes_teste
   ADD CONSTRAINT documentos_pacientes_teste_angulo_ck CHECK (
    angulo_foto IS NULL OR
    (categoria='foto_evolucao' AND angulo_foto IN ('frente','costas','perfil_direito','perfil_esquerdo','outro'))
   );
 END IF;
END $$;

-- Preserva registros anteriores e permite classificar a foto posteriormente.
CREATE OR REPLACE FUNCTION public.classificar_foto_evolucao_teste(
 p_documento_id uuid,p_paciente_id uuid,p_angulo_foto text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 IF p_angulo_foto IS NOT NULL AND p_angulo_foto NOT IN
  ('frente','costas','perfil_direito','perfil_esquerdo','outro')
 THEN RAISE EXCEPTION 'Angulo invalido'; END IF;
 UPDATE public.documentos_pacientes_teste d SET angulo_foto=p_angulo_foto
 WHERE d.id=p_documento_id AND d.paciente_id=p_paciente_id
 AND d.categoria='foto_evolucao' AND d.mime_type LIKE 'image/%';
 IF NOT FOUND THEN RAISE EXCEPTION 'Foto de evolucao nao encontrada'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.classificar_foto_evolucao_teste(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.classificar_foto_evolucao_teste(uuid,uuid,text) TO authenticated;

-- A rotina já existente de upload continua intacta; categoria e ângulo
-- ficam separados e a classificação é feita após registrar a imagem.
COMMIT;
