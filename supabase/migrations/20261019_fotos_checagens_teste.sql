-- MAJESTIC SANTÉ | DOCUMENTO FOTOGRÁFICO DA CHECAGEM FICTÍCIA.
-- AMBIENTE DE TESTES: não utilizar imagens reais de pacientes, rótulos reais ou dados pessoais.
-- Uma foto obrigatória nas NOVAS checagens; checagens antigas continuam intactas.
BEGIN;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('comprovantes-checagem-teste','comprovantes-checagem-teste',false,6291456,
 ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE
 SET public=false,file_size_limit=6291456,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];

ALTER TABLE public.administracoes_teste
 ADD COLUMN IF NOT EXISTS foto_caminho text;
ALTER TABLE public.administracoes_teste
 ADD CONSTRAINT administracoes_teste_foto_caminho_limite
 CHECK(foto_caminho IS NULL OR (length(foto_caminho)<=300 AND foto_caminho LIKE '%.%'));
-- Não adicionamos NOT NULL, pois os registros legados não têm anexo.

DROP POLICY IF EXISTS "checagem_teste_upload_enfermeira" ON storage.objects;
CREATE POLICY "checagem_teste_upload_enfermeira" ON storage.objects
 FOR INSERT TO authenticated WITH CHECK(
 bucket_id='comprovantes-checagem-teste'
 AND split_part(name,'/',1)=auth.uid()::text
 AND split_part(name,'/',2)<>''
 AND split_part(name,'/',3)<>''
 AND split_part(name,'/',4)=''
 AND EXISTS(SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='enfermeira')
 -- A fotografia só pode ser enviada para um item de prescrição visível à enfermagem.
 AND EXISTS(SELECT 1 FROM public.prescricao_itens_teste i
   WHERE i.id::text=split_part(name,'/',2))
);

DROP POLICY IF EXISTS "checagem_teste_ler_anexo_vinculado" ON storage.objects;
CREATE POLICY "checagem_teste_ler_anexo_vinculado" ON storage.objects
 FOR SELECT TO authenticated USING(
 bucket_id='comprovantes-checagem-teste'
 AND EXISTS(SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN('medico','enfermeira'))
 AND EXISTS(SELECT 1 FROM public.administracoes_teste a
   WHERE a.foto_caminho=name)
);

-- Uso da foto e baixa de estoque na mesma transação do banco.
CREATE OR REPLACE FUNCTION public.checar_com_foto_e_baixar_estoque_teste(
 p_item_id uuid,p_observacao text,p_foto_caminho text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_user uuid:=auth.uid();
 v_admin uuid;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=v_user AND p.ativo=true AND p.perfil='enfermeira'
 ) THEN RAISE EXCEPTION 'Acesso restrito à enfermagem'; END IF;

 IF p_foto_caminho IS NULL OR length(p_foto_caminho)>300
  OR split_part(p_foto_caminho,'/',1)<>v_user::text
  OR split_part(p_foto_caminho,'/',2)<>p_item_id::text
  OR split_part(p_foto_caminho,'/',3)=''
  OR split_part(p_foto_caminho,'/',4)<>''
 THEN RAISE EXCEPTION 'Foto inválida ou de outro usuário/item'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM storage.objects o
   WHERE o.bucket_id='comprovantes-checagem-teste'
   AND o.name=p_foto_caminho
   AND (o.metadata->>'mimetype') IN ('image/jpeg','image/png','image/webp')
 ) THEN RAISE EXCEPTION 'Foto não localizada ou tipo não permitido'; END IF;

 -- Reutiliza o fluxo já instalado que valida, checa e desconta saldos atomicamente.
 v_admin:=public.checar_e_baixar_estoque_teste(p_item_id,p_observacao);

 UPDATE public.administracoes_teste
 SET foto_caminho=p_foto_caminho WHERE id=v_admin AND profissional_id=v_user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Não foi possível vincular a imagem'; END IF;
 RETURN v_admin;
END;
$$;

-- Desabilita a chamada pública do método antigo que permitia checar sem foto.
-- A nova função SECURITY DEFINER continua podendo chamá-lo internamente.
REVOKE EXECUTE ON FUNCTION public.checar_e_baixar_estoque_teste(uuid,text) FROM authenticated,PUBLIC,anon;
REVOKE ALL ON FUNCTION public.checar_com_foto_e_baixar_estoque_teste(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checar_com_foto_e_baixar_estoque_teste(uuid,text,text) TO authenticated;

COMMIT;
