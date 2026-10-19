-- Encerramento de consulta SIMULADA. Executar somente em banco isolado de homologacao.
BEGIN;
ALTER TABLE public.consultas_teste
 ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES public.agendamentos_teste(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS consultas_teste_agendamento_unico
 ON public.consultas_teste(agendamento_id) WHERE agendamento_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.encerramentos_consulta_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consulta_id uuid NOT NULL UNIQUE REFERENCES public.consultas_teste(id) ON DELETE RESTRICT,
 agendamento_id uuid NOT NULL UNIQUE REFERENCES public.agendamentos_teste(id) ON DELETE RESTRICT,
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 medico_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 conferencias jsonb NOT NULL,
 encerrado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.encerramentos_consulta_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.encerramentos_consulta_teste FROM PUBLIC, anon, authenticated;

-- A operacao e atomica: qualquer falha no registro de auditoria cancela o encerramento.
CREATE OR REPLACE FUNCTION public.encerrar_consulta_teste(
 p_agendamento_id uuid, p_consulta_id uuid, p_checks jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
 v_ag public.agendamentos_teste%ROWTYPE;
 v_cons public.consultas_teste%ROWTYPE;
 v_id uuid;
 v_required text;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
   AND p.ativo=true AND p.perfil='medico'
 ) THEN RAISE EXCEPTION 'Somente medico autenticado pode encerrar consulta'; END IF;
 IF p_agendamento_id IS NULL OR p_consulta_id IS NULL
 THEN RAISE EXCEPTION 'Informe consulta e agendamento'; END IF;
 FOREACH v_required IN ARRAY ARRAY['evolucao','tratamento','retorno','documentos'] LOOP
  IF coalesce(p_checks->>v_required,'') <> 'true'
  THEN RAISE EXCEPTION 'Conferencia obrigatoria ausente: %', v_required; END IF;
 END LOOP;
 SELECT * INTO v_ag FROM public.agendamentos_teste a
 WHERE a.id=p_agendamento_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento nao encontrado'; END IF;
 IF v_ag.profissional_id<>auth.uid() OR v_ag.tipo NOT IN ('consulta','retorno')
 THEN RAISE EXCEPTION 'Agendamento nao pertence ao medico ou nao e consulta'; END IF;
 SELECT * INTO v_cons FROM public.consultas_teste c
 WHERE c.id=p_consulta_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Consulta nao encontrada'; END IF;
 IF v_cons.agendamento_id IS DISTINCT FROM v_ag.id
  OR v_cons.paciente_id<>v_ag.paciente_id OR v_cons.profissional_id<>auth.uid()
 THEN RAISE EXCEPTION 'Consulta e agendamento nao estao corretamente vinculados'; END IF;
 IF nullif(btrim(coalesce(v_cons.evolucao,'')),'') IS NULL
 THEN RAISE EXCEPTION 'Evolucao clinica obrigatoria'; END IF;
 SELECT e.id INTO v_id FROM public.encerramentos_consulta_teste e
 WHERE e.agendamento_id=v_ag.id AND e.consulta_id=v_cons.id;
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 IF v_ag.status NOT IN ('agendado','confirmado')
 THEN RAISE EXCEPTION 'Status do agendamento impede encerramento'; END IF;
 INSERT INTO public.encerramentos_consulta_teste
 (consulta_id,agendamento_id,paciente_id,medico_id,conferencias)
 VALUES(v_cons.id,v_ag.id,v_ag.paciente_id,auth.uid(),p_checks)
 RETURNING id INTO v_id;
 UPDATE public.agendamentos_teste
 SET status='realizado',atualizado_em=now() WHERE id=v_ag.id;
 INSERT INTO public.agendamentos_auditoria_teste
 (agendamento_id,acao,usuario_id,status_anterior,status_novo)
 VALUES(v_ag.id,'consulta_encerrada',auth.uid(),v_ag.status,'realizado');
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.encerrar_consulta_teste(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.encerrar_consulta_teste(uuid,uuid,jsonb) TO authenticated;
COMMIT;
