-- MIGRACAO PROPOSTA: NAO EXECUTAR AINDA. Requer homologacao e revisão das dependências.
-- Separação entre leitura de saldos e custo de aquisição (papel 'equipe' não recebe custo).
BEGIN;
-- A leitura direta da tabela passa a ser apenas das colunas operacionais.
REVOKE SELECT ON TABLE public.estoque_lotes_teste FROM authenticated;
-- Remove grants por coluna antigos, se existirem, e impede acesso via PUBLIC/anon.
REVOKE SELECT ON TABLE public.estoque_lotes_teste FROM PUBLIC,anon;
-- IMPORTANTE: auditar grants adicionais e funcoes SECURITY DEFINER antes de executar.
GRANT SELECT (id,produto_id,lote,validade,saldo,quantidade_inicial,cadastrado_por,criado_em)
 ON public.estoque_lotes_teste TO authenticated;
-- Acesso separado e autenticado ao custo, com verificação do perfil NO SERVIDOR.
CREATE OR REPLACE FUNCTION public.consultar_custos_lotes_teste()
RETURNS TABLE (id uuid,custo_total_aquisicao numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
    AND p.ativo AND p.perfil IN ('medico','enfermeira','administrativo')
 ) THEN RAISE EXCEPTION 'Perfil sem acesso aos custos'; END IF;
 RETURN QUERY SELECT l.id,l.custo_total_aquisicao FROM public.estoque_lotes_teste l;
END;
$$;
REVOKE ALL ON FUNCTION public.consultar_custos_lotes_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consultar_custos_lotes_teste() TO authenticated;
COMMIT;
-- A interface ja utiliza a RPC proposta na branch, mas exige testes autenticados
-- de medico/enfermeira/administrativo/equipe antes de executar no banco.
-- REVISAO PENDENTE: conferir outros grants, views e relatorios financeiros.
-- Triggers custo_saida_insumo_teste e calcular_custo_movimento_teste retornam trigger,
-- portanto nao constituem endpoints RPC de leitura direta.
