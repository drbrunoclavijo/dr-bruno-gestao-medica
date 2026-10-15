-- MAJESTIC SANTÉ | Ângulo escolhido no ato do envio (arquivos fictícios).
-- Instalar depois de 20261021_documentos_pacientes_teste.sql
-- e 20261022_angulo_fotos_evolucao_teste.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.registrar_foto_evolucao_com_angulo_teste(
 p_paciente_id uuid,
 p_consulta_id uuid,
 p_titulo text,
 p_descricao text,
 p_data_documento date,
 p_nome_original text,
 p_mime_type text,
 p_tamanho_bytes bigint,
 p_caminho text,
 p_angulo_foto text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF p_angulo_foto IS NULL OR p_angulo_foto NOT IN (
  'frente','costas','perfil_direito','perfil_esquerdo','outro'
 ) THEN
  RAISE EXCEPTION 'Selecione um ângulo corporal válido';
 END IF;
 IF p_mime_type IS NULL OR p_mime_type NOT IN('image/jpeg','image/png','image/webp') THEN
  RAISE EXCEPTION 'Fotos de evolução devem ser imagens válidas';
 END IF;
 -- Reaproveita todas as validações de acesso, paciente, consulta, arquivo e tamanho;
 -- qualquer erro na classificação desfaz também o registro do documento.
 v_id:=public.registrar_documento_paciente_teste(
  p_paciente_id,p_consulta_id,'foto_evolucao',p_titulo,p_descricao,
  p_data_documento,p_nome_original,p_mime_type,p_tamanho_bytes,p_caminho
 );
 UPDATE public.documentos_pacientes_teste
 SET angulo_foto=p_angulo_foto
 WHERE id=v_id AND paciente_id=p_paciente_id AND categoria='foto_evolucao';
 IF NOT FOUND THEN RAISE EXCEPTION 'Falha ao associar ângulo à foto'; END IF;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_foto_evolucao_com_angulo_teste(
 uuid,uuid,text,text,date,text,text,bigint,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_foto_evolucao_com_angulo_teste(
 uuid,uuid,text,text,date,text,text,bigint,text,text) TO authenticated;
COMMIT;
