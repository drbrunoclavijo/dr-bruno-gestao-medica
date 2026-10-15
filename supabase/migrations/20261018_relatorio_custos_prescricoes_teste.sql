-- Relatório financeiro do consumo de estoque por prescrição fictícia.
-- Visível exclusivamente ao perfil médico ativo. Não expõe dados ao perfil equipe.
-- Os movimentos anteriores à migração de custos podem ter custo_saida NULL.
BEGIN;
CREATE OR REPLACE FUNCTION public.relatorio_consumo_prescricoes_teste()
RETURNS TABLE(
 prescricao_id uuid,
 paciente_id uuid,
 paciente_nome text,
 prescrito_em timestamptz,
 medicamento text,
 produto_nome text,
 unidade text,
 lote text,
 quantidade numeric,
 custo_saida numeric,
 baixa_em timestamptz,
 responsavel_nome text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Apenas perfil médico autorizado pode ver custos por prescrição'; END IF;

 RETURN QUERY
 SELECT rx.id,rx.paciente_id,pa.nome,rx.criado_em,
  i.medicamento,prod.nome,prod.unidade,lot.lote,
  mov.quantidade,mov.custo_saida,mov.criado_em,coalesce(prof.nome,'Profissional não identificado')
 FROM public.estoque_movimentos_teste mov
 JOIN public.prescricao_itens_teste i ON i.id=mov.item_prescricao_id
 JOIN public.prescricoes_teste rx ON rx.id=i.prescricao_id
 JOIN public.pacientes pa ON pa.id=rx.paciente_id
 JOIN public.estoque_lotes_teste lot ON lot.id=mov.lote_id
 JOIN public.estoque_produtos_teste prod ON prod.id=lot.produto_id
 LEFT JOIN public.profissionais prof ON prof.id=mov.profissional_id
 ORDER BY mov.criado_em DESC,mov.id DESC
 LIMIT 1000;
END;
$$;
REVOKE ALL ON FUNCTION public.relatorio_consumo_prescricoes_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.relatorio_consumo_prescricoes_teste() TO authenticated;
COMMIT;
