-- MAJESTIC SANTÉ | INSUMOS DE TESTE INTEGRADOS À CHECAGEM E AO ESTOQUE
-- Somente dados fictícios. Uma checagem por item de prescrição nesta versão.
-- Roda depois das migrações de estoque/custo e protocolos.
BEGIN;

ALTER TABLE public.estoque_produtos_teste
 ADD COLUMN IF NOT EXISTS tipo_produto text NOT NULL DEFAULT 'medicamento';
ALTER TABLE public.estoque_produtos_teste
 DROP CONSTRAINT IF EXISTS estoque_produtos_tipo_produto_ck;
ALTER TABLE public.estoque_produtos_teste
 ADD CONSTRAINT estoque_produtos_tipo_produto_ck
 CHECK (tipo_produto IN ('medicamento','insumo'));

CREATE OR REPLACE FUNCTION public.criar_insumo_estoque_teste(p_nome text,p_unidade text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true
 AND p.perfil IN ('medico','enfermeira','equipe')
 ) THEN RAISE EXCEPTION 'Acesso negado ao estoque'; END IF;
 IF length(btrim(coalesce(p_nome,''))) NOT BETWEEN 1 AND 200
 OR length(btrim(coalesce(p_unidade,''))) NOT BETWEEN 1 AND 30
 THEN RAISE EXCEPTION 'Nome/unidade inválidos'; END IF;
 INSERT INTO public.estoque_produtos_teste(nome,unidade,tipo_produto)
 VALUES(btrim(p_nome),btrim(p_unidade),'insumo') RETURNING id INTO v_id;
 RETURN v_id;
END $$;

-- Materiais previstos/utilizados junto a UM item prescrito.
CREATE TABLE IF NOT EXISTS public.insumos_itens_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_prescricao_id uuid NOT NULL REFERENCES public.prescricao_itens_teste(id) ON DELETE RESTRICT,
 produto_id uuid NOT NULL REFERENCES public.estoque_produtos_teste(id) ON DELETE RESTRICT,
 quantidade numeric(12,3) NOT NULL CHECK(quantidade>0 AND quantidade<=100000),
 cadastrado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(item_prescricao_id,produto_id)
);
CREATE INDEX IF NOT EXISTS insumos_itens_produto_teste_idx ON public.insumos_itens_teste(produto_id);
ALTER TABLE public.insumos_itens_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.insumos_itens_teste FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.insumos_itens_teste TO authenticated;
DROP POLICY IF EXISTS insumos_itens_teste_select ON public.insumos_itens_teste;
CREATE POLICY insumos_itens_teste_select ON public.insumos_itens_teste
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true
 AND p.perfil IN ('medico','enfermeira'))
);

CREATE TABLE IF NOT EXISTS public.insumos_movimentos_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 administracao_id uuid NOT NULL REFERENCES public.administracoes_teste(id) ON DELETE RESTRICT,
 insumo_item_id uuid NOT NULL REFERENCES public.insumos_itens_teste(id) ON DELETE RESTRICT,
 lote_id uuid NOT NULL REFERENCES public.estoque_lotes_teste(id) ON DELETE RESTRICT,
 quantidade numeric(12,3) NOT NULL CHECK(quantidade>0),
 custo_saida numeric(14,2),
 profissional_id uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(administracao_id,insumo_item_id,lote_id)
);
CREATE INDEX IF NOT EXISTS insumos_movimentos_administracao_idx
 ON public.insumos_movimentos_teste(administracao_id);
ALTER TABLE public.insumos_movimentos_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.insumos_movimentos_teste FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.insumos_movimentos_teste TO authenticated;
DROP POLICY IF EXISTS insumos_movimentos_teste_select ON public.insumos_movimentos_teste;
CREATE POLICY insumos_movimentos_teste_select ON public.insumos_movimentos_teste
 FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true
 AND p.perfil IN ('medico','enfermeira'))
);

CREATE OR REPLACE FUNCTION public.configurar_insumo_item_teste(
 p_item_id uuid,p_produto_id uuid,p_quantidade numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true
 AND p.perfil IN('medico','enfermeira')
 ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 IF p_quantidade IS NULL OR p_quantidade<=0 OR p_quantidade>100000
 OR p_quantidade<>round(p_quantidade,3) THEN
 RAISE EXCEPTION 'Quantidade de insumo inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.estoque_produtos_teste p
 WHERE p.id=p_produto_id AND p.ativo AND p.tipo_produto='insumo')
 THEN RAISE EXCEPTION 'Selecione um insumo ativo'; END IF;
 -- Mesma trava utilizada na checagem para impedir alteração simultânea.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM public.prescricao_itens_teste WHERE id=p_item_id)
 THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
 IF EXISTS(SELECT 1 FROM public.administracoes_teste a WHERE a.item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Item já checado. Não é possível alterar insumos'; END IF;
 INSERT INTO public.insumos_itens_teste(item_prescricao_id,produto_id,quantidade,cadastrado_por)
 VALUES(p_item_id,p_produto_id,p_quantidade,auth.uid())
 ON CONFLICT(item_prescricao_id,produto_id)
 DO UPDATE SET quantidade=EXCLUDED.quantidade;
END $$;

CREATE OR REPLACE FUNCTION public.remover_insumo_item_teste(p_item_id uuid,p_produto_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true
 AND p.perfil IN('medico','enfermeira')
 ) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_item_id::text,0));
 IF EXISTS(SELECT 1 FROM public.administracoes_teste WHERE item_prescricao_id=p_item_id)
 THEN RAISE EXCEPTION 'Item já checado'; END IF;
 DELETE FROM public.insumos_itens_teste
 WHERE item_prescricao_id=p_item_id AND produto_id=p_produto_id;
END $$;

CREATE OR REPLACE FUNCTION public.custo_saida_insumo_teste()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
DECLARE v_total numeric;v_inicial numeric;
BEGIN
 SELECT custo_total_aquisicao,quantidade_inicial
 INTO v_total,v_inicial FROM public.estoque_lotes_teste WHERE id=NEW.lote_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado'; END IF;
 NEW.custo_saida:=CASE WHEN v_total IS NULL THEN NULL
 ELSE round(v_total*NEW.quantidade/v_inicial,2) END;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS custo_saida_insumo_teste ON public.insumos_movimentos_teste;
CREATE TRIGGER custo_saida_insumo_teste BEFORE INSERT ON public.insumos_movimentos_teste
 FOR EACH ROW EXECUTE FUNCTION public.custo_saida_insumo_teste();

-- Qualquer checagem registrada gera as saídas de insumos na mesma transação.
-- Se algum insumo faltar, a checagem e TODAS as saídas são revertidas.
CREATE OR REPLACE FUNCTION public.baixar_insumos_checagem_teste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_ins record;v_lote record;v_falta numeric(12,3);v_retirada numeric(12,3);v_saldo numeric(12,3);
BEGIN
 FOR v_ins IN
  SELECT x.id,x.produto_id,x.quantidade
  FROM public.insumos_itens_teste x
  WHERE x.item_prescricao_id=NEW.item_prescricao_id
  ORDER BY x.produto_id
 LOOP
  PERFORM 1 FROM public.estoque_produtos_teste p
  WHERE p.id=v_ins.produto_id AND p.ativo AND p.tipo_produto='insumo'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insumo não disponível'; END IF;
  SELECT coalesce(sum(l.saldo),0) INTO v_saldo FROM public.estoque_lotes_teste l
  WHERE l.produto_id=v_ins.produto_id AND l.validade>=current_date;
  IF v_saldo<v_ins.quantidade THEN
   RAISE EXCEPTION 'Saldo de insumo insuficiente, verifique lotes/validade';
  END IF;
  v_falta:=v_ins.quantidade;
  FOR v_lote IN
   SELECT l.id,l.saldo FROM public.estoque_lotes_teste l
   WHERE l.produto_id=v_ins.produto_id AND l.saldo>0 AND l.validade>=current_date
   ORDER BY l.validade,l.criado_em,l.id FOR UPDATE
  LOOP
   v_retirada:=least(v_falta,v_lote.saldo);
   UPDATE public.estoque_lotes_teste SET saldo=saldo-v_retirada WHERE id=v_lote.id;
   INSERT INTO public.insumos_movimentos_teste(
    administracao_id,insumo_item_id,lote_id,quantidade,profissional_id)
   VALUES(NEW.id,v_ins.id,v_lote.id,v_retirada,NEW.profissional_id);
   v_falta:=v_falta-v_retirada;
   EXIT WHEN v_falta=0;
  END LOOP;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS baixar_insumos_checagem_teste ON public.administracoes_teste;
CREATE TRIGGER baixar_insumos_checagem_teste AFTER INSERT ON public.administracoes_teste
 FOR EACH ROW EXECUTE FUNCTION public.baixar_insumos_checagem_teste();

-- Evitar usar insumo como medicamento na vinculação tradicional.
CREATE OR REPLACE FUNCTION public.bloquear_insumo_como_medicamento_teste()
RETURNS trigger LANGUAGE plpgsql SET search_path=''
AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.estoque_produtos_teste p
 WHERE p.id=NEW.produto_id AND p.tipo_produto='medicamento')
 THEN RAISE EXCEPTION 'Use um medicamento na vinculação; insumos são adicionados separadamente'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bloquear_insumo_como_medicamento_teste ON public.estoque_vinculos_teste;
CREATE TRIGGER bloquear_insumo_como_medicamento_teste
 BEFORE INSERT OR UPDATE ON public.estoque_vinculos_teste
 FOR EACH ROW EXECUTE FUNCTION public.bloquear_insumo_como_medicamento_teste();

REVOKE ALL ON FUNCTION public.criar_insumo_estoque_teste(text,text),
 public.configurar_insumo_item_teste(uuid,uuid,numeric),
 public.remover_insumo_item_teste(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.criar_insumo_estoque_teste(text,text),
 public.configurar_insumo_item_teste(uuid,uuid,numeric),
 public.remover_insumo_item_teste(uuid,uuid) TO authenticated;

-- Custos de insumos por protocolo, sem modificar RPCs já instaladas.
CREATE OR REPLACE FUNCTION public.listar_protocolos_com_insumos_teste()
RETURNS TABLE (
 protocolo_id uuid,paciente_id uuid,paciente_nome text,nome text,inicio date,
 duracao_dias integer,preco_cobrado numeric,status text,criado_em timestamptz,
 prescricoes_vinculadas bigint,checagens_registradas bigint,custo_conhecido numeric,
 saidas_sem_custo bigint,quantidade_saida numeric,repasse_clinica numeric,
 itens_prescritos bigint,checagens_sem_baixa bigint,percentual_clinica numeric,
 custo_insumos numeric,saidas_insumos_sem_custo bigint,quantidade_insumos numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
 SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 RETURN QUERY
 SELECT r.protocolo_id,r.paciente_id,r.paciente_nome,r.nome,r.inicio,
 r.duracao_dias,r.preco_cobrado,r.status,r.criado_em,
 r.prescricoes_vinculadas,r.checagens_registradas,r.custo_conhecido,
 r.saidas_sem_custo,r.quantidade_saida,r.repasse_clinica,
 r.itens_prescritos,r.checagens_sem_baixa,r.percentual_clinica,
 (SELECT coalesce(sum(sm.custo_saida),0)
  FROM public.protocolo_prescricoes_teste rel
  JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
  JOIN public.insumos_itens_teste si ON si.item_prescricao_id=it.id
  JOIN public.insumos_movimentos_teste sm ON sm.insumo_item_id=si.id
  WHERE rel.protocolo_id=r.protocolo_id),
 (SELECT count(*)
  FROM public.protocolo_prescricoes_teste rel
  JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
  JOIN public.insumos_itens_teste si ON si.item_prescricao_id=it.id
  JOIN public.insumos_movimentos_teste sm ON sm.insumo_item_id=si.id
  WHERE rel.protocolo_id=r.protocolo_id AND sm.custo_saida IS NULL),
 (SELECT coalesce(sum(sm.quantidade),0)
  FROM public.protocolo_prescricoes_teste rel
  JOIN public.prescricao_itens_teste it ON it.prescricao_id=rel.prescricao_id
  JOIN public.insumos_itens_teste si ON si.item_prescricao_id=it.id
  JOIN public.insumos_movimentos_teste sm ON sm.insumo_item_id=si.id
  WHERE rel.protocolo_id=r.protocolo_id)
 FROM public.listar_protocolos_com_percentual_teste() r;
END $$;
-- Relatório médico de consumo de insumos, agrupável por prescrição.
CREATE OR REPLACE FUNCTION public.relatorio_consumo_insumos_teste()
RETURNS TABLE(
 prescricao_id uuid,paciente_nome text,medicamento text,insumo_nome text,
 unidade text,lote text,quantidade numeric,custo_saida numeric,baixa_em timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Somente médico autorizado'; END IF;
 RETURN QUERY
 SELECT rx.id,pa.nome::text,it.medicamento::text,prod.nome::text,
 prod.unidade::text,l.lote::text,m.quantidade,m.custo_saida,m.criado_em
 FROM public.insumos_movimentos_teste m
 JOIN public.insumos_itens_teste si ON si.id=m.insumo_item_id
 JOIN public.prescricao_itens_teste it ON it.id=si.item_prescricao_id
 JOIN public.prescricoes_teste rx ON rx.id=it.prescricao_id
 JOIN public.pacientes pa ON pa.id=rx.paciente_id
 JOIN public.estoque_lotes_teste l ON l.id=m.lote_id
 JOIN public.estoque_produtos_teste prod ON prod.id=l.produto_id
 ORDER BY m.criado_em DESC,m.id DESC
 LIMIT 1000;
END $$;
REVOKE ALL ON FUNCTION public.relatorio_consumo_insumos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.relatorio_consumo_insumos_teste() TO authenticated;

REVOKE ALL ON FUNCTION public.listar_protocolos_com_insumos_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_protocolos_com_insumos_teste() TO authenticated;
COMMIT;
