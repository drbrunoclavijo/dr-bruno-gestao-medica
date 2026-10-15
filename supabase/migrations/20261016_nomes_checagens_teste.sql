-- Retorna apenas os nomes dos profissionais que checaram itens fictícios do paciente.
-- A função não expõe e-mails, outros cadastros, nem o restante de profissionais.
CREATE OR REPLACE FUNCTION public.nomes_checagem_teste(p_paciente_id uuid)
RETURNS TABLE (profissional_id uuid, nome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira')
 ) THEN
  RAISE EXCEPTION 'Acesso não autorizado';
 END IF;
 RETURN QUERY
 SELECT DISTINCT p.id, p.nome
 FROM public.administracoes_teste a
 JOIN public.prescricao_itens_teste i ON i.id=a.item_prescricao_id
 JOIN public.prescricoes_teste r ON r.id=i.prescricao_id
 JOIN public.profissionais p ON p.id=a.profissional_id
 WHERE r.paciente_id=p_paciente_id;
END;
$$;
REVOKE ALL ON FUNCTION public.nomes_checagem_teste(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nomes_checagem_teste(uuid) TO authenticated;
