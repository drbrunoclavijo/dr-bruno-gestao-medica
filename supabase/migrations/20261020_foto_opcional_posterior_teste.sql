-- Majestic Santé Institute | foto opcional e inclusão posterior (ambiente fictício).
-- A checagem e a baixa de estoque podem ocorrer sem foto. Anexo posterior não gera nova baixa.
BEGIN;

ALTER TABLE public.administracoes_teste
 ADD COLUMN IF NOT EXISTS foto_anexada_em timestamptz;
ALTER TABLE public.administracoes_teste
 ADD COLUMN IF NOT EXISTS foto_anexada_por uuid REFERENCES auth.users(id);

-- Restaurar a função original, já protegida com perfil 'enfermeira' e com desconto transacional.
GRANT EXECUTE ON FUNCTION public.checar_e_baixar_estoque_teste(uuid,text) TO authenticated;

-- A foto só poderá ser vinculada uma vez ao registro já existente.
-- O responsável original pela checagem pode acrescentá-la posteriormente.
CREATE OR REPLACE FUNCTION public.anexar_foto_checagem_teste(
 p_item_id uuid, p_foto_caminho text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_user uuid:=auth.uid();
BEGIN
 IF v_user IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=v_user AND p.ativo=true AND p.perfil='enfermeira'
 ) THEN RAISE EXCEPTION 'Somente enfermagem autorizada pode anexar'; END IF;
 IF p_foto_caminho IS NULL OR length(p_foto_caminho)>300
  OR split_part(p_foto_caminho,'/',1)<>v_user::text
  OR split_part(p_foto_caminho,'/',2)<>p_item_id::text
  OR split_part(p_foto_caminho,'/',3)=''
  OR split_part(p_foto_caminho,'/',4)<>''
 THEN RAISE EXCEPTION 'Caminho de foto inválido'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM storage.objects o
  WHERE o.bucket_id='comprovantes-checagem-teste'
    AND o.name=p_foto_caminho
    AND (o.metadata->>'mimetype') IN ('image/jpeg','image/png','image/webp')
 ) THEN RAISE EXCEPTION 'Foto não encontrada ou formato não permitido'; END IF;

 UPDATE public.administracoes_teste a
 SET foto_caminho=p_foto_caminho,
     foto_anexada_em=now(),
     foto_anexada_por=v_user
 WHERE a.item_prescricao_id=p_item_id
   AND a.profissional_id=v_user
   AND a.foto_caminho IS NULL;
 IF NOT FOUND THEN
  RAISE EXCEPTION 'Checagem não encontrada, registrada por outro usuário ou já possui foto';
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.anexar_foto_checagem_teste(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.anexar_foto_checagem_teste(uuid,text) TO authenticated;

-- Também registra quem anexou a foto durante a checagem original (se esse fluxo for utilizado).
CREATE OR REPLACE FUNCTION public.marcar_metadados_foto_checagem_teste()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF NEW.foto_caminho IS NOT NULL AND OLD.foto_caminho IS NULL THEN
  NEW.foto_anexada_em:=coalesce(NEW.foto_anexada_em,now());
  NEW.foto_anexada_por:=coalesce(NEW.foto_anexada_por,auth.uid());
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS marcar_metadados_foto_checagem_teste ON public.administracoes_teste;
CREATE TRIGGER marcar_metadados_foto_checagem_teste
 BEFORE UPDATE ON public.administracoes_teste
 FOR EACH ROW EXECUTE FUNCTION public.marcar_metadados_foto_checagem_teste();

COMMIT;
