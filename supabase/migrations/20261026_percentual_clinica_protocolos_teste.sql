-- Majestic Santé | repasse configurado pelo percentual (somente testes).
-- Executar após 20261025_repasse_clinica_protocolos_teste.sql.
BEGIN;
ALTER TABLE public.protocolos_teste
 ADD COLUMN IF NOT EXISTS percentual_clinica numeric(5,2) NOT NULL DEFAULT 0
 CHECK (percentual_clinica BETWEEN 0 AND 100);
-- Preserva repasses existentes ao converter o valor previamente registrado para percentual.
UPDATE public.protocolos_teste
 SET percentual_clinica=CASE WHEN preco_cobrado>0
 THEN least(100,round(repasse_clinica*100/preco_cobrado,2)) ELSE 0 END;

CREATE OR REPLACE FUNCTION public.definir_percentual_clinica_protocolo_teste(
 p_protocolo_id uuid,p_percentual numeric
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 IF p_percentual IS NULL OR p_percentual<0 OR p_percentual>100
 OR p_percentual<>round(p_percentual,2)
 THEN RAISE EXCEPTION 'Percentual inválido. Use 0 a 100 com até duas casas'; END IF;
 UPDATE public.protocolos_teste
 SET percentual_clinica=p_percentual,
     repasse_clinica=round(preco_cobrado*p_percentual/100,2)
 WHERE id=p_protocolo_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.criar_protocolo_com_percentual_teste(
 p_paciente_id uuid,p_nome text,p_inicio date,p_duracao_dias integer,
 p_preco_cobrado numeric,p_percentual_clinica numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_id uuid;
BEGIN
 IF p_percentual_clinica IS NULL OR p_percentual_clinica<0 OR p_percentual_clinica>100
 OR p_percentual_clinica<>round(p_percentual_clinica,2)
 THEN RAISE EXCEPTION 'Percentual inválido'; END IF;
 v_id:=public.criar_protocolo_teste(
 p_paciente_id,p_nome,p_inicio,p_duracao_dias,p_preco_cobrado);
 PERFORM public.definir_percentual_clinica_protocolo_teste(v_id,p_percentual_clinica);
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.listar_protocolos_com_percentual_teste()
RETURNS TABLE(
 protocolo_id uuid,paciente_id uuid,paciente_nome text,nome text,inicio date,
 duracao_dias integer,preco_cobrado numeric,status text,criado_em timestamptz,
 prescricoes_vinculadas bigint,checagens_registradas bigint,custo_conhecido numeric,
 saidas_sem_custo bigint,quantidade_saida numeric,repasse_clinica numeric,
 itens_prescritos bigint,checagens_sem_baixa bigint,percentual_clinica numeric
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso restrito ao médico'; END IF;
 RETURN QUERY
 SELECT l.protocolo_id,l.paciente_id,l.paciente_nome,l.nome,l.inicio,
 l.duracao_dias,l.preco_cobrado,l.status,l.criado_em,
 l.prescricoes_vinculadas,l.checagens_registradas,l.custo_conhecido,
 l.saidas_sem_custo,l.quantidade_saida,l.repasse_clinica,
 l.itens_prescritos,l.checagens_sem_baixa,p.percentual_clinica
 FROM public.listar_protocolos_com_repasse_teste() l
 JOIN public.protocolos_teste p ON p.id=l.protocolo_id;
END $$;

REVOKE ALL ON FUNCTION public.definir_percentual_clinica_protocolo_teste(uuid,numeric),
 public.criar_protocolo_com_percentual_teste(uuid,text,date,integer,numeric,numeric),
 public.listar_protocolos_com_percentual_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.definir_percentual_clinica_protocolo_teste(uuid,numeric),
 public.criar_protocolo_com_percentual_teste(uuid,text,date,integer,numeric,numeric),
 public.listar_protocolos_com_percentual_teste() TO authenticated;
COMMIT;
