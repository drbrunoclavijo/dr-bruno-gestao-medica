-- Majestic Santé Institute | estoque fictício compartilhado e custos de aquisição.
-- Execute após 20261015_estoque_integrado_teste.sql e 20261016_estoque_cadastro_e_vinculos_teste.sql.
-- Não usar dados de pacientes reais. "equipe" só vê produtos/lotes, nunca vínculos a prescrições.
BEGIN;

ALTER TABLE public.estoque_lotes_teste
 ADD COLUMN IF NOT EXISTS custo_total_aquisicao numeric(14,2);
ALTER TABLE public.estoque_lotes_teste
 DROP CONSTRAINT IF EXISTS estoque_lotes_teste_custo_total_aquisicao_check;
ALTER TABLE public.estoque_lotes_teste
 ADD CONSTRAINT estoque_lotes_teste_custo_total_aquisicao_check
 CHECK (custo_total_aquisicao IS NULL OR custo_total_aquisicao >= 0);

ALTER TABLE public.estoque_movimentos_teste
 ADD COLUMN IF NOT EXISTS custo_saida numeric(14,2);

-- Somente catálogo e lotes são acessíveis ao perfil equipe.
DROP POLICY IF EXISTS estoque_produtos_ler_teste ON public.estoque_produtos_teste;
CREATE POLICY estoque_produtos_ler_teste ON public.estoque_produtos_teste
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira','equipe'))
);
DROP POLICY IF EXISTS estoque_lotes_ler_teste ON public.estoque_lotes_teste;
CREATE POLICY estoque_lotes_ler_teste ON public.estoque_lotes_teste
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira','equipe'))
);
-- Equipe não precisa consultar a relação clínica entre prescrições e estoque.
DROP POLICY IF EXISTS estoque_vinculos_ler_teste ON public.estoque_vinculos_teste;
CREATE POLICY estoque_vinculos_ler_teste ON public.estoque_vinculos_teste
 FOR SELECT TO authenticated USING (
 EXISTS (SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira'))
);
-- Cadastro de produtos sem conceder INSERT direto à interface.
CREATE OR REPLACE FUNCTION public.criar_produto_estoque_teste(p_nome text,p_unidade text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.perfil IN ('medico','enfermeira','equipe') AND p.ativo=true)
 THEN RAISE EXCEPTION 'Usuário não autorizado a cadastrar estoque'; END IF;
 IF length(btrim(coalesce(p_nome,''))) NOT BETWEEN 1 AND 200
    OR length(btrim(coalesce(p_unidade,''))) NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION 'Nome ou unidade inválidos'; END IF;
 INSERT INTO public.estoque_produtos_teste(nome,unidade)
 VALUES(btrim(p_nome),btrim(p_unidade)) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

-- A função anterior (4 parâmetros) deixa de ser acessível ao aplicativo.
-- Lotes anteriores continuam preservados, com custo desconhecido até conferência.
REVOKE ALL ON FUNCTION public.adicionar_lote_estoque_teste(uuid,text,date,numeric) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.adicionar_lote_estoque_teste(
 p_produto_id uuid,p_lote text,p_validade date,p_quantidade numeric,p_custo_total numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.perfil IN ('medico','enfermeira','equipe') AND p.ativo=true)
 THEN RAISE EXCEPTION 'Usuário não autorizado a adicionar lote'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.estoque_produtos_teste
 WHERE id=p_produto_id AND ativo=true) THEN RAISE EXCEPTION 'Produto inexistente ou inativo'; END IF;
 IF length(btrim(coalesce(p_lote,''))) NOT BETWEEN 1 AND 100 OR p_validade IS NULL
    OR p_validade<current_date OR p_quantidade IS NULL
    OR p_quantidade<=0 OR p_quantidade>1000000
    OR p_custo_total IS NULL OR p_custo_total<0 OR p_custo_total>100000000
    OR p_custo_total<>round(p_custo_total,2)
 THEN RAISE EXCEPTION 'Lote, validade, quantidade ou custo inválidos'; END IF;
 INSERT INTO public.estoque_lotes_teste(produto_id,lote,validade,quantidade_inicial,saldo,custo_total_aquisicao)
 VALUES(p_produto_id,btrim(p_lote),p_validade,p_quantidade,p_quantidade,p_custo_total)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;

-- Congela o custo estimado da saída com base no custo de aquisição do lote.
-- Itens de lotes antigos sem custo permanecem sem valor, não assumem zero.
CREATE OR REPLACE FUNCTION public.calcular_custo_movimento_teste()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE v_total numeric(14,2); v_inicial numeric(12,3);
BEGIN
 SELECT custo_total_aquisicao,quantidade_inicial INTO v_total,v_inicial
 FROM public.estoque_lotes_teste WHERE id=NEW.lote_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote inexistente'; END IF;
 NEW.custo_saida:=CASE WHEN v_total IS NULL THEN NULL
 ELSE round((v_total/v_inicial)*NEW.quantidade,2) END;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS calcular_custo_movimento_teste ON public.estoque_movimentos_teste;
CREATE TRIGGER calcular_custo_movimento_teste
 BEFORE INSERT ON public.estoque_movimentos_teste
 FOR EACH ROW EXECUTE FUNCTION public.calcular_custo_movimento_teste();

REVOKE ALL ON FUNCTION public.criar_produto_estoque_teste(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_produto_estoque_teste(text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.adicionar_lote_estoque_teste(uuid,text,date,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.adicionar_lote_estoque_teste(uuid,text,date,numeric,numeric) TO authenticated;
COMMIT;
