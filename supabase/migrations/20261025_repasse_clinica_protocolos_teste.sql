-- MAJESTIC SANTÉ | REPASSE À CLÍNICA E LEITURA DE PROTOCOLOS
-- Ambiente exclusivamente fictício. Executar após a migração 20261024.
BEGIN;
ALTER TABLE public.protocolos_teste
  ADD COLUMN IF NOT EXISTS repasse_clinica numeric(12,2) NOT NULL DEFAULT 0
  CHECK (repasse_clinica >= 0);
-- Repasse não pode ultrapassar o valor cobrado; evita margem artificial.
ALTER TABLE public.protocolos_teste
  DROP CONSTRAINT IF EXISTS protocolos_teste_repasse_valor_check;
ALTER TABLE public.protocolos_teste
  ADD CONSTRAINT protocolos_teste_repasse_valor_check
  CHECK (repasse_clinica <= preco_cobrado);

CREATE OR REPLACE FUNCTION public.definir_repasse_clinica_protocolo_teste(
 p_protocolo_id uuid,p_valor numeric
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Somente médico autorizado'; END IF;
 IF p_valor IS NULL OR p_valor<0 OR p_valor>9999999999.99
 OR p_valor <> round(p_valor,2)
 THEN RAISE EXCEPTION 'Valor de repasse inválido'; END IF;
 UPDATE public.protocolos_teste
 SET repasse_clinica=p_valor
 WHERE id=p_protocolo_id AND preco_cobrado>=p_valor;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado ou repasse maior que o preço'; END IF;
END;
$$;

-- Criação e repasse na mesma transação.
CREATE OR REPLACE FUNCTION public.criar_protocolo_com_repasse_teste(
 p_paciente_id uuid,p_nome text,p_inicio date,
 p_duracao_dias integer,p_preco_cobrado numeric,p_repasse_clinica numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF p_repasse_clinica IS NULL OR p_repasse_clinica<0
 OR p_repasse_clinica>p_preco_cobrado
 OR p_repasse_clinica<>round(p_repasse_clinica,2)
 THEN RAISE EXCEPTION 'Repasse inválido'; END IF;
 v_id:=public.criar_protocolo_teste(
 p_paciente_id,p_nome,p_inicio,p_duracao_dias,p_preco_cobrado);
 PERFORM public.definir_repasse_clinica_protocolo_teste(v_id,p_repasse_clinica);
 RETURN v_id;
END;
$$;

-- Adiciona informações sem alterar a assinatura da função de relatório existente.
CREATE OR REPLACE FUNCTION public.listar_protocolos_com_repasse_teste()
RETURNS TABLE(
 protocolo_id uuid,paciente_id uuid,paciente_nome text,nome text,inicio date,
 duracao_dias integer,preco_cobrado numeric,status text,criado_em timestamptz,
 prescricoes_vinculadas bigint,checagens_registradas bigint,custo_conhecido numeric,
 saidas_sem_custo bigint,quantidade_saida numeric,repasse_clinica numeric,
 itens_prescritos bigint,checagens_sem_baixa bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Somente médico autorizado'; END IF;
 RETURN QUERY
 SELECT l.protocolo_id,l.paciente_id,l.paciente_nome,l.nome,l.inicio,
 l.duracao_dias,l.preco_cobrado,l.status,l.criado_em,
 l.prescricoes_vinculadas,l.checagens_registradas,l.custo_conhecido,
 l.saidas_sem_custo,l.quantidade_saida,pr.repasse_clinica,
 (SELECT count(*) FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste i ON i.prescricao_id=rel.prescricao_id
 WHERE rel.protocolo_id=l.protocolo_id),
 (SELECT count(*) FROM public.protocolo_prescricoes_teste rel
 JOIN public.prescricao_itens_teste i ON i.prescricao_id=rel.prescricao_id
 JOIN public.administracoes_teste a ON a.item_prescricao_id=i.id
 WHERE rel.protocolo_id=l.protocolo_id
 AND NOT EXISTS(SELECT 1 FROM public.estoque_movimentos_teste m WHERE m.administracao_id=a.id))
 FROM public.listar_protocolos_teste() l
 JOIN public.protocolos_teste pr ON pr.id=l.protocolo_id;
END;
$$;

REVOKE ALL ON FUNCTION public.definir_repasse_clinica_protocolo_teste(uuid,numeric),
 public.criar_protocolo_com_repasse_teste(uuid,text,date,integer,numeric,numeric),
 public.listar_protocolos_com_repasse_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.definir_repasse_clinica_protocolo_teste(uuid,numeric),
 public.criar_protocolo_com_repasse_teste(uuid,text,date,integer,numeric,numeric),
 public.listar_protocolos_com_repasse_teste() TO authenticated;
COMMIT;
