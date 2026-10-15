-- MAJESTIC SANTÉ | ESTOQUE DE TESTES -- SOMENTE DADOS FICTÍCIOS.
-- Não executar em operação clínica real. Revisar LGPD, auditoria, configurações de perfis e concorrência.
-- Cada item de prescrição deve ser vinculado a um produto e quantidade antes da checagem.
CREATE TABLE IF NOT EXISTS public.estoque_produtos_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 nome text NOT NULL CHECK (length(btrim(nome)) BETWEEN 1 AND 200),
 unidade text NOT NULL CHECK (length(btrim(unidade)) BETWEEN 1 AND 30),
 ativo boolean NOT NULL DEFAULT true,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.estoque_lotes_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 produto_id uuid NOT NULL REFERENCES public.estoque_produtos_teste(id) ON DELETE RESTRICT,
 lote text NOT NULL CHECK (length(btrim(lote)) BETWEEN 1 AND 100),
 validade date NOT NULL,
 quantidade_inicial numeric(12,3) NOT NULL CHECK (quantidade_inicial > 0),
 saldo numeric(12,3) NOT NULL CHECK (saldo >= 0),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(produto_id,lote),
 CHECK (saldo <= quantidade_inicial)
);
CREATE TABLE IF NOT EXISTS public.estoque_vinculos_teste (
 item_prescricao_id uuid PRIMARY KEY REFERENCES public.prescricao_itens_teste(id) ON DELETE RESTRICT,
 produto_id uuid NOT NULL REFERENCES public.estoque_produtos_teste(id) ON DELETE RESTRICT,
 quantidade numeric(12,3) NOT NULL CHECK (quantidade > 0),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.estoque_movimentos_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lote_id uuid NOT NULL REFERENCES public.estoque_lotes_teste(id) ON DELETE RESTRICT,
 item_prescricao_id uuid NOT NULL REFERENCES public.prescricao_itens_teste(id) ON DELETE RESTRICT,
 administracao_id uuid NOT NULL REFERENCES public.administracoes_teste(id) ON DELETE RESTRICT,
 quantidade numeric(12,3) NOT NULL CHECK (quantidade > 0),
 tipo text NOT NULL DEFAULT 'saida_checagem' CHECK (tipo = 'saida_checagem'),
 profissional_id uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(administracao_id,lote_id)
);
CREATE INDEX IF NOT EXISTS estoque_lotes_produto_validade_idx ON public.estoque_lotes_teste(produto_id,validade);
CREATE INDEX IF NOT EXISTS estoque_movimentos_item_idx ON public.estoque_movimentos_teste(item_prescricao_id);

ALTER TABLE public.estoque_produtos_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_lotes_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_vinculos_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_movimentos_teste ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.estoque_produtos_teste,public.estoque_lotes_teste,public.estoque_vinculos_teste,public.estoque_movimentos_teste FROM anon,authenticated;
GRANT SELECT ON public.estoque_produtos_teste,public.estoque_lotes_teste,public.estoque_vinculos_teste,public.estoque_movimentos_teste TO authenticated;
-- Dados e saldos serão cadastrados apenas por funções controladas, criadas na próxima etapa.
DROP POLICY IF EXISTS estoque_produtos_ler_teste ON public.estoque_produtos_teste;
CREATE POLICY estoque_produtos_ler_teste ON public.estoque_produtos_teste FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira'))
);
DROP POLICY IF EXISTS estoque_lotes_ler_teste ON public.estoque_lotes_teste;
CREATE POLICY estoque_lotes_ler_teste ON public.estoque_lotes_teste FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira'))
);
DROP POLICY IF EXISTS estoque_vinculos_ler_teste ON public.estoque_vinculos_teste;
CREATE POLICY estoque_vinculos_ler_teste ON public.estoque_vinculos_teste FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira'))
);
DROP POLICY IF EXISTS estoque_movimentos_ler_teste ON public.estoque_movimentos_teste;
CREATE POLICY estoque_movimentos_ler_teste ON public.estoque_movimentos_teste FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira'))
);

-- IMPORTANTE: impedir novas checagens sem operação atômica com estoque.
REVOKE INSERT ON public.administracoes_teste FROM authenticated;

-- Checagem + saída por validade mais próxima (FEFO), tudo na MESMA transação.
CREATE OR REPLACE FUNCTION public.checar_e_baixar_estoque_teste(
 p_item_id uuid, p_observacao text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 v_user uuid := auth.uid();
 v_vinculo record;
 v_lote record;
 v_falta numeric(12,3);
 v_retirada numeric(12,3);
 v_adm uuid;
BEGIN
 IF v_user IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=v_user AND p.ativo=true AND p.perfil='enfermeira'
 ) THEN RAISE EXCEPTION 'Somente enfermagem autorizada pode confirmar'; END IF;
 IF length(coalesce(p_observacao,''))>2000 THEN RAISE EXCEPTION 'Observação muito longa'; END IF;
 -- Bloqueia dupla checagem simultânea do mesmo item.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text,0));
 IF EXISTS(SELECT 1 FROM public.administracoes_teste WHERE item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Item já checado'; END IF;
 SELECT v.produto_id,v.quantidade,p.ativo INTO v_vinculo
 FROM public.estoque_vinculos_teste v
 JOIN public.estoque_produtos_teste p ON p.id=v.produto_id
 WHERE v.item_prescricao_id=p_item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Prescrição sem produto e quantidade vinculados ao estoque'; END IF;
 IF NOT v_vinculo.ativo THEN RAISE EXCEPTION 'Produto inativo'; END IF;
 -- Serializa todos os descontos de um mesmo produto.
 PERFORM 1 FROM public.estoque_produtos_teste WHERE id=v_vinculo.produto_id FOR UPDATE;
 SELECT coalesce(sum(saldo),0) INTO v_falta FROM public.estoque_lotes_teste
 WHERE produto_id=v_vinculo.produto_id AND validade >= current_date;
 IF v_falta < v_vinculo.quantidade THEN
   RAISE EXCEPTION 'Estoque insuficiente ou lotes vencidos; checagem não realizada';
 END IF;
 INSERT INTO public.administracoes_teste(item_prescricao_id,profissional_id,checado_em,observacao)
 VALUES(p_item_id,v_user,now(),nullif(btrim(p_observacao),'')) RETURNING id INTO v_adm;
 v_falta:=v_vinculo.quantidade;
 FOR v_lote IN SELECT id,saldo FROM public.estoque_lotes_teste
   WHERE produto_id=v_vinculo.produto_id AND saldo>0 AND validade >= current_date
   ORDER BY validade,criado_em,id FOR UPDATE
 LOOP
  v_retirada:=least(v_lote.saldo,v_falta);
  UPDATE public.estoque_lotes_teste SET saldo=saldo-v_retirada WHERE id=v_lote.id;
  INSERT INTO public.estoque_movimentos_teste(lote_id,item_prescricao_id,administracao_id,quantidade,profissional_id)
  VALUES(v_lote.id,p_item_id,v_adm,v_retirada,v_user);
  v_falta:=v_falta-v_retirada;
  EXIT WHEN v_falta=0;
 END LOOP;
 RETURN v_adm;
END;
$$;
REVOKE ALL ON FUNCTION public.checar_e_baixar_estoque_teste(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.checar_e_baixar_estoque_teste(uuid,text) TO authenticated;
-- Falhas provocam rollback de checagem e de todas as saídas.
-- Não há ainda cadastro de produtos, lotes e vínculos por interface: próximas etapas.
