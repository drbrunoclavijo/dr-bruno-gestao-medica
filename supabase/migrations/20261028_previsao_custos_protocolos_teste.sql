-- MAJESTIC SANTÉ | PREVISÃO DE CUSTOS POR PROTOCOLO FICTÍCIO
-- Complementa os custos efetivamente baixados. Não reserva saldo e não representa
-- custo de ciclos futuros ainda não cadastrados como itens de prescrição.
BEGIN;

CREATE OR REPLACE FUNCTION public.previsao_custos_protocolos_teste()
RETURNS TABLE(
 protocolo_id uuid,
 previsto_medicamentos_pendentes numeric,
 previsto_insumos_pendentes numeric,
 itens_pendentes bigint,
 linhas_sem_preco bigint,
 linhas_sem_saldo_suficiente bigint,
 itens_sem_vinculo_estoque bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao perfil médico'; END IF;

 RETURN QUERY
 WITH rx_itens AS (
   SELECT rel.protocolo_id,it.id AS item_id
   FROM public.protocolo_prescricoes_teste rel
   JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
   WHERE NOT EXISTS(
     SELECT 1 FROM public.administracoes_teste a WHERE a.item_prescricao_id=it.id
   )
 ),
 linhas AS (
   SELECT i.protocolo_id,i.item_id,'medicamento'::text AS tipo,
     v.produto_id,v.quantidade
   FROM rx_itens i
   JOIN public.estoque_vinculos_teste v ON v.item_prescricao_id=i.item_id
   UNION ALL
   SELECT i.protocolo_id,i.item_id,'insumo'::text AS tipo,
     v.produto_id,v.quantidade
   FROM rx_itens i
   JOIN public.insumos_itens_teste v ON v.item_prescricao_id=i.item_id
 ),
 precos AS (
  SELECT p.id AS produto_id,
   SUM(l.saldo) AS saldo_disponivel,
   COUNT(*) FILTER(WHERE l.custo_total_aquisicao IS NULL) AS lotes_sem_preco,
   SUM(l.saldo*l.custo_total_aquisicao/NULLIF(l.quantidade_inicial,0))
      /NULLIF(SUM(l.saldo),0) AS custo_medio_unitario
  FROM public.estoque_produtos_teste p
  JOIN public.estoque_lotes_teste l ON l.produto_id=p.id
  WHERE p.ativo=true AND l.validade>=current_date AND l.saldo>0
  GROUP BY p.id
 ),
 avaliadas AS (
  SELECT ln.protocolo_id,ln.item_id,ln.tipo,ln.quantidade,
   (pr.produto_id IS NOT NULL AND pr.lotes_sem_preco=0
      AND ln.quantidade<=pr.saldo_disponivel) AS com_preco_e_saldo,
   (pr.produto_id IS NULL OR pr.lotes_sem_preco>0) AS sem_preco,
   (pr.produto_id IS NULL OR ln.quantidade>pr.saldo_disponivel) AS sem_saldo,
   CASE WHEN pr.produto_id IS NOT NULL AND pr.lotes_sem_preco=0
      AND ln.quantidade<=pr.saldo_disponivel
     THEN round(ln.quantidade*pr.custo_medio_unitario,2)
     ELSE NULL END AS custo_estimado
  FROM linhas ln LEFT JOIN precos pr ON pr.produto_id=ln.produto_id
 ),
 totals AS (
  SELECT a.protocolo_id,
   COALESCE(SUM(a.custo_estimado) FILTER(WHERE a.tipo='medicamento'),0) AS med,
   COALESCE(SUM(a.custo_estimado) FILTER(WHERE a.tipo='insumo'),0) AS ins,
   COUNT(*) FILTER(WHERE a.sem_preco) AS missing,
   COUNT(*) FILTER(WHERE a.sem_saldo) AS shortage
  FROM avaliadas a GROUP BY a.protocolo_id
 )
 SELECT pr.id,
   COALESCE(t.med,0)::numeric,
   COALESCE(t.ins,0)::numeric,
   (SELECT count(*) FROM rx_itens r WHERE r.protocolo_id=pr.id)::bigint,
   COALESCE(t.missing,0)::bigint,
   COALESCE(t.shortage,0)::bigint,
   (SELECT count(*)
    FROM rx_itens i
    WHERE i.protocolo_id=pr.id
      AND NOT EXISTS(SELECT 1 FROM public.estoque_vinculos_teste v
                     WHERE v.item_prescricao_id=i.item_id))::bigint
 FROM public.protocolos_teste pr
 LEFT JOIN totals t ON t.protocolo_id=pr.id
 ORDER BY pr.criado_em DESC LIMIT 300;
END;
$$;

REVOKE ALL ON FUNCTION public.previsao_custos_protocolos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.previsao_custos_protocolos_teste() TO authenticated;
COMMIT;
