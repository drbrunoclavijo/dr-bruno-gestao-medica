-- Majestic Santé | relatório individual de consumo em sessões de TESTE
-- Somente leitura, sem alterar prescrição, administração ou estoque.
BEGIN;
CREATE OR REPLACE FUNCTION public.custos_sessoes_protocolos_teste()
RETURNS TABLE (
 sessao_id uuid,
 custo_medicamentos numeric,
 custo_insumos numeric,
 saidas_sem_custo bigint,
 movimentos_medicamentos bigint,
 movimentos_insumos bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 RETURN QUERY
 SELECT s.id,
  coalesce(m.custo,0)::numeric,
  coalesce(ins.custo,0)::numeric,
  (coalesce(m.sem_custo,0)+coalesce(ins.sem_custo,0))::bigint,
  coalesce(m.movimentos,0)::bigint,
  coalesce(ins.movimentos,0)::bigint
 FROM public.sessoes_protocolos_teste s
 LEFT JOIN LATERAL (
  SELECT sum(mov.custo_saida) AS custo,
    count(*) FILTER (WHERE mov.custo_saida IS NULL) AS sem_custo,
    count(*) AS movimentos
  FROM public.estoque_movimentos_teste mov
  JOIN public.administracoes_teste a ON a.id=mov.administracao_id
  WHERE s.item_prescricao_id=a.item_prescricao_id
 ) m ON true
 LEFT JOIN LATERAL (
  SELECT sum(mov.custo_saida) AS custo,
    count(*) FILTER (WHERE mov.custo_saida IS NULL) AS sem_custo,
    count(*) AS movimentos
  FROM public.insumos_movimentos_teste mov
  JOIN public.administracoes_teste a ON a.id=mov.administracao_id
  WHERE s.item_prescricao_id=a.item_prescricao_id
 ) ins ON true
 WHERE s.status='agendada'
 ORDER BY s.id
 LIMIT 2000;
END $$;
REVOKE ALL ON FUNCTION public.custos_sessoes_protocolos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.custos_sessoes_protocolos_teste() TO authenticated;
COMMIT;
