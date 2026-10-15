-- MAJESTIC SANTÉ | BIBLIOTECA CLÍNICA DE TESTES (ARQUIVOS FICTÍCIOS).
-- Atenção: não há validação LGPD/segurança para dados reais.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('documentos-pacientes-teste','documentos-pacientes-teste',false,10485760,
 ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,
 allowed_mime_types=ARRAY['application/pdf','image/jpeg','image/png','image/webp'];

CREATE TABLE IF NOT EXISTS public.documentos_pacientes_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 consulta_id uuid REFERENCES public.consultas_teste(id) ON DELETE RESTRICT,
 categoria text NOT NULL CHECK(categoria IN ('exame','bioimpedancia','foto_evolucao','outro')),
 titulo text NOT NULL CHECK(length(btrim(titulo)) BETWEEN 1 AND 180),
 descricao text CHECK(descricao IS NULL OR length(descricao)<=1000),
 data_documento date,
 nome_original text NOT NULL CHECK(length(nome_original) BETWEEN 1 AND 240),
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
 tamanho_bytes bigint NOT NULL CHECK(tamanho_bytes>0 AND tamanho_bytes<=10485760),
 caminho text NOT NULL UNIQUE CHECK(length(caminho)<=300),
 enviado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documentos_pacientes_teste_paciente_idx
 ON public.documentos_pacientes_teste(paciente_id,criado_em DESC);
ALTER TABLE public.documentos_pacientes_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documentos_pacientes_teste FROM anon,authenticated;
GRANT SELECT ON public.documentos_pacientes_teste TO authenticated;
DROP POLICY IF EXISTS documentos_pacientes_medico_ler ON public.documentos_pacientes_teste;
CREATE POLICY documentos_pacientes_medico_ler ON public.documentos_pacientes_teste
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico')
);

-- O médico só pode enviar para pasta de paciente existente, dentro de sua pasta de usuário.
DROP POLICY IF EXISTS "documentos_teste_upload_medico" ON storage.objects;
CREATE POLICY "documentos_teste_upload_medico" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id='documentos-pacientes-teste'
 AND split_part(name,'/',1)=auth.uid()::text
 AND split_part(name,'/',2)<>''
 AND split_part(name,'/',3)<>''
 AND split_part(name,'/',4)=''
 AND EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico')
 AND EXISTS(SELECT 1 FROM public.pacientes pa
  WHERE pa.id::text=split_part(name,'/',2))
);
DROP POLICY IF EXISTS "documentos_teste_download_medico" ON storage.objects;
CREATE POLICY "documentos_teste_download_medico" ON storage.objects
 FOR SELECT TO authenticated USING(
 bucket_id='documentos-pacientes-teste'
 AND EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico')
 AND EXISTS(SELECT 1 FROM public.documentos_pacientes_teste d WHERE d.caminho=name)
);

-- Somente uma função controlada pode registrar metadados, após validar arquivo no Storage.
CREATE OR REPLACE FUNCTION public.registrar_documento_paciente_teste(
 p_paciente_id uuid,p_consulta_id uuid,p_categoria text,p_titulo text,
 p_descricao text,p_data_documento date,p_nome_original text,p_mime_type text,
 p_tamanho_bytes bigint,p_caminho text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.profissionais WHERE id=auth.uid() AND ativo=true AND perfil='medico'
 ) THEN RAISE EXCEPTION 'Somente médico autorizado pode anexar documento de teste'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes WHERE id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente fictício não encontrado'; END IF;
 IF p_consulta_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.consultas_teste WHERE id=p_consulta_id AND paciente_id=p_paciente_id
 ) THEN RAISE EXCEPTION 'Consulta não pertence ao paciente'; END IF;
 IF p_categoria IS NULL OR p_categoria NOT IN('exame','bioimpedancia','foto_evolucao','outro')
 OR length(btrim(coalesce(p_titulo,''))) NOT BETWEEN 1 AND 180
 OR length(coalesce(p_descricao,''))>1000
 OR length(coalesce(p_nome_original,'')) NOT BETWEEN 1 AND 240
 OR p_mime_type IS NULL OR p_mime_type NOT IN('application/pdf','image/jpeg','image/png','image/webp')
 OR p_tamanho_bytes IS NULL OR p_tamanho_bytes<1 OR p_tamanho_bytes>10485760
 OR p_caminho IS NULL OR length(p_caminho)>300
 OR split_part(p_caminho,'/',1)<>auth.uid()::text
 OR split_part(p_caminho,'/',2)<>p_paciente_id::text
 OR split_part(p_caminho,'/',3)=''
 OR split_part(p_caminho,'/',4)<>''
 THEN RAISE EXCEPTION 'Metadados de documento inválidos'; END IF;
 IF p_categoria='foto_evolucao' AND p_mime_type='application/pdf'
 THEN RAISE EXCEPTION 'Foto de evolução deve ser imagem'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id='documentos-pacientes-teste'
  AND o.name=p_caminho AND o.owner_id=auth.uid()::text
  AND o.metadata->>'mimetype'=p_mime_type
  AND (o.metadata->>'size')::bigint=p_tamanho_bytes
 ) THEN RAISE EXCEPTION 'Arquivo de teste não encontrado ou metadados divergentes'; END IF;
 INSERT INTO public.documentos_pacientes_teste(
 paciente_id,consulta_id,categoria,titulo,descricao,data_documento,
 nome_original,mime_type,tamanho_bytes,caminho,enviado_por
 ) VALUES(
 p_paciente_id,p_consulta_id,p_categoria,btrim(p_titulo),nullif(btrim(p_descricao),''),
 p_data_documento,p_nome_original,p_mime_type,p_tamanho_bytes,p_caminho,auth.uid()
 ) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_documento_paciente_teste(uuid,uuid,text,text,text,date,text,text,bigint,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_documento_paciente_teste(uuid,uuid,text,text,text,date,text,text,bigint,text)
 TO authenticated;
COMMIT;
