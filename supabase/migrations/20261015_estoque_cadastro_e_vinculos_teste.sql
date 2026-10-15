-- Cadastramento controlado de produtos e lotes FICTÍCIOS por médico.
CREATE OR REPLACE FUNCTION public.criar_produto_estoque_teste(p_nome text,p_unidade text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais WHERE id=auth.uid() AND perfil='medico' AND ativo=true)
 THEN RAISE EXCEPTION 'Perfil médico não autorizado'; END IF;
 IF length(btrim(coalesce(p_nome,''))) NOT BETWEEN 1 AND 200 OR length(btrim(coalesce(p_unidade,''))) NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION 'Nome/unidade inválidos'; END IF;
 INSERT INTO public.estoque_produtos_teste(nome,unidade)
 VALUES(btrim(p_nome),btrim(p_unidade)) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.adicionar_lote_estoque_teste(
 p_produto_id uuid,p_lote text,p_validade date,p_quantidade numeric
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais WHERE id=auth.uid() AND perfil='medico' AND ativo=true)
 THEN RAISE EXCEPTION 'Perfil médico não autorizado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.estoque_produtos_teste WHERE id=p_produto_id AND ativo)
 THEN RAISE EXCEPTION 'Produto inexistente ou inativo'; END IF;
 IF length(btrim(coalesce(p_lote,''))) NOT BETWEEN 1 AND 100 OR p_validade IS NULL OR p_validade<current_date
 OR p_quantidade IS NULL OR p_quantidade<=0 OR p_quantidade>1000000
 THEN RAISE EXCEPTION 'Lote, validade ou quantidade inválidos'; END IF;
 INSERT INTO public.estoque_lotes_teste(produto_id,lote,validade,quantidade_inicial,saldo)
 VALUES(p_produto_id,btrim(p_lote),p_validade,p_quantidade,p_quantidade) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.vincular_item_estoque_teste(
 p_item_id uuid,p_produto_id uuid,p_quantidade numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais WHERE id=auth.uid() AND perfil='medico' AND ativo=true)
 THEN RAISE EXCEPTION 'Perfil médico não autorizado'; END IF;
 IF p_quantidade IS NULL OR p_quantidade<=0 OR p_quantidade>1000000
 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.estoque_produtos_teste WHERE id=p_produto_id AND ativo)
 THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.prescricao_itens_teste i
  JOIN public.prescricoes_teste p ON p.id=i.prescricao_id
  WHERE i.id=p_item_id AND p.medico_id=auth.uid()
 ) THEN RAISE EXCEPTION 'Item de prescrição não autorizado'; END IF;
 IF EXISTS(SELECT 1 FROM public.administracoes_teste WHERE item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Item já checado'; END IF;
 INSERT INTO public.estoque_vinculos_teste(item_prescricao_id,produto_id,quantidade)
 VALUES(p_item_id,p_produto_id,p_quantidade);
END;
$$;
REVOKE ALL ON FUNCTION public.criar_produto_estoque_teste(text,text),
 public.adicionar_lote_estoque_teste(uuid,text,date,numeric),
 public.vincular_item_estoque_teste(uuid,uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_produto_estoque_teste(text,text),
 public.adicionar_lote_estoque_teste(uuid,text,date,numeric),
 public.vincular_item_estoque_teste(uuid,uuid,numeric) TO authenticated;
