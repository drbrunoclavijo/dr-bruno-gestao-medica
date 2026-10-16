-- Majestic Sante | Alertas operacionais de estoque ficticio.
-- Nao retorna custo, prescricoes, pacientes nem movimentacoes.
BEGIN;
ALTER TABLE public.estoque_produtos_teste
 ADD COLUMN IF NOT EXISTS estoque_minimo numeric(12,3) NOT NULL DEFAULT 5;
ALTER TABLE public.estoque_produtos_teste
 DROP CONSTRAINT IF EXISTS estoque_produtos_teste_estoque_minimo_check;
ALTER TABLE public.estoque_produtos_teste
 ADD CONSTRAINT estoque_produtos_teste_estoque_minimo_check
 CHECK(estoque_minimo>=0 AND estoque_minimo<=1000000);

CREATE OR REPLACE FUNCTION public.definir_estoque_minimo_teste(
 p_produto_id uuid,p_minimo numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $estoque$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Somente medico autorizado pode definir minimo'; END IF;
 IF p_minimo IS NULL OR p_minimo<0 OR p_minimo>1000000 OR p_minimo<>round(p_minimo,3)
 THEN RAISE EXCEPTION 'Informe minimo valido com ate 3 casas decimais'; END IF;
 UPDATE public.estoque_produtos_teste SET estoque_minimo=p_minimo WHERE id=p_produto_id AND ativo;
 IF NOT FOUND THEN RAISE EXCEPTION 'Produto inexistente ou inativo'; END IF;
END $estoque$;

CREATE OR REPLACE FUNCTION public.alertas_estoque_teste()
RETURNS TABLE(
 produto_id uuid,produto_nome text,unidade text,tipo_produto text,
 estoque_minimo numeric,saldo_util numeric,
 tipo_alerta text,lote text,validade date,saldo_lote numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $estoque$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
  AND p.ativo AND p.perfil IN ('medico','enfermeira','equipe'))
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 RETURN QUERY
 WITH totals AS (
  SELECT p.id,p.nome,p.unidade,p.tipo_produto,p.estoque_minimo,
   coalesce(sum(l.saldo) FILTER(WHERE l.validade>=current_date),0)::numeric AS saldo_util
  FROM public.estoque_produtos_teste p
  LEFT JOIN public.estoque_lotes_teste l ON l.produto_id=p.id
  WHERE p.ativo=true
  GROUP BY p.id,p.nome,p.unidade,p.tipo_produto,p.estoque_minimo
 ),
 low AS (
  SELECT t.id,t.nome,t.unidade,t.tipo_produto,t.estoque_minimo,t.saldo_util,
   CASE WHEN t.saldo_util<=0 THEN 'sem_estoque'
        ELSE 'estoque_baixo' END AS tipo_alerta,
   NULL::text AS lote,NULL::date AS validade,NULL::numeric AS saldo_lote
  FROM totals t WHERE t.saldo_util<=t.estoque_minimo
 ),
 exp AS (
  SELECT p.id,p.nome,p.unidade,p.tipo_produto,p.estoque_minimo,t.saldo_util,
   CASE WHEN l.validade<current_date THEN 'vencido' ELSE 'proximo_vencimento' END AS tipo_alerta,
   l.lote::text,l.validade,l.saldo::numeric
  FROM public.estoque_lotes_teste l
  JOIN public.estoque_produtos_teste p ON p.id=l.produto_id AND p.ativo
  JOIN totals t ON t.id=p.id
  WHERE l.saldo>0 AND l.validade<=current_date+30
 )
 SELECT a.id,a.nome::text,a.unidade::text,a.tipo_produto::text,
  a.estoque_minimo,a.saldo_util,a.tipo_alerta,a.lote,a.validade,a.saldo_lote
 FROM (SELECT * FROM low UNION ALL SELECT * FROM exp) a
 ORDER BY CASE a.tipo_alerta WHEN 'sem_estoque' THEN 0 WHEN 'vencido' THEN 1
  WHEN 'estoque_baixo' THEN 2 ELSE 3 END,a.validade NULLS LAST,a.nome
 LIMIT 500;
END $estoque$;
REVOKE ALL ON FUNCTION public.alertas_estoque_teste(),
 public.definir_estoque_minimo_teste(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.alertas_estoque_teste(),
 public.definir_estoque_minimo_teste(uuid,numeric) TO authenticated;
COMMIT;
