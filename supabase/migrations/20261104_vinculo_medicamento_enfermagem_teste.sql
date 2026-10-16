-- Majestic Sante Institute: nurse can link a TEST prescription item to medication inventory.
-- This is an inventory association, not a new prescription or medication administration.
BEGIN;
CREATE TABLE IF NOT EXISTS public.auditoria_vinculos_estoque_enfermagem_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_prescricao_id uuid NOT NULL REFERENCES public.prescricao_itens_teste(id) ON DELETE RESTRICT,
 produto_id uuid NOT NULL REFERENCES public.estoque_produtos_teste(id) ON DELETE RESTRICT,
 quantidade numeric(12,3) NOT NULL CHECK(quantidade>0),
 profissional_id uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auditoria_vinculos_estoque_enfermagem_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_vinculos_estoque_enfermagem_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.vincular_medicamento_enfermagem_teste(
 p_item_id uuid,p_produto_id uuid,p_quantidade numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_tipo text;v_ativo boolean;v_medicamento text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais prof
  WHERE prof.id=auth.uid() AND prof.ativo=true AND prof.perfil='enfermeira'
 ) THEN RAISE EXCEPTION 'Somente enfermagem autorizada pode preparar estoque'; END IF;
 IF p_item_id IS NULL OR p_produto_id IS NULL OR p_quantidade IS NULL
    OR p_quantidade<=0 OR p_quantidade>100000
    OR p_quantidade<>round(p_quantidade,3)
 THEN RAISE EXCEPTION 'Produto ou quantidade invalida (ate 3 casas decimais)'; END IF;

 -- Serialize with existing check/stock routines for the same prescription item.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text,0));
 SELECT it.medicamento::text INTO v_medicamento
 FROM public.prescricao_itens_teste it
 JOIN public.prescricoes_teste rx ON rx.id=it.prescricao_id
 WHERE it.id=p_item_id FOR UPDATE OF it;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item de prescricao nao encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM public.administracoes_teste adm WHERE adm.item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Medicacao ja checada; vinculacao nao pode ser alterada'; END IF;
 IF EXISTS(SELECT 1 FROM public.estoque_vinculos_teste v WHERE v.item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Este item ja foi vinculado ao estoque'; END IF;
 SELECT p.tipo_produto::text,p.ativo INTO v_tipo,v_ativo
 FROM public.estoque_produtos_teste p WHERE p.id=p_produto_id;
 IF NOT FOUND OR v_tipo<>'medicamento' OR NOT v_ativo
 THEN RAISE EXCEPTION 'Escolha um medicamento ativo do estoque'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.estoque_lotes_teste l
  WHERE l.produto_id=p_produto_id AND l.validade>=current_date
    AND l.saldo>0)
 THEN RAISE EXCEPTION 'Medicamento sem lote valido com saldo'; END IF;
 -- Do not auto-match names: nurse must review product, strength, volume and quantity.
 INSERT INTO public.estoque_vinculos_teste(item_prescricao_id,produto_id,quantidade)
 VALUES(p_item_id,p_produto_id,p_quantidade);
 INSERT INTO public.auditoria_vinculos_estoque_enfermagem_teste(
  item_prescricao_id,produto_id,quantidade,profissional_id)
 VALUES(p_item_id,p_produto_id,p_quantidade,auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.vincular_medicamento_enfermagem_teste(uuid,uuid,numeric)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vincular_medicamento_enfermagem_teste(uuid,uuid,numeric)
 TO authenticated;
COMMIT;
