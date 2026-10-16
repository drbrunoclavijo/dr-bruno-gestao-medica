-- Fluxo SIMULADO de respostas WhatsApp. Nenhuma mensagem e enviada aqui.
-- Integracao oficial futura devera validar assinatura webhook, telefone,
-- identificador de mensagem, consentimento, idempotencia e vinculacao segura.
BEGIN;
ALTER TABLE public.agendamentos_teste DROP CONSTRAINT IF EXISTS agendamentos_teste_status_check;
ALTER TABLE public.agendamentos_teste ADD CONSTRAINT agendamentos_teste_status_check
 CHECK(status IN ('agendado','confirmado','reagendamento_solicitado','realizado','cancelado','faltou'));
CREATE TABLE IF NOT EXISTS public.pendencias_agenda_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agendamento_id uuid NOT NULL REFERENCES public.agendamentos_teste(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(tipo IN ('reagendamento')),
 status text NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','resolvida')),
 aberta_em timestamptz NOT NULL DEFAULT now(),
 aberta_por uuid NOT NULL REFERENCES auth.users(id),
 resolvida_em timestamptz,
 resolvida_por uuid REFERENCES auth.users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pendencias_agenda_uma_aberta_teste
 ON public.pendencias_agenda_teste(agendamento_id,tipo) WHERE status='aberta';
ALTER TABLE public.pendencias_agenda_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pendencias_agenda_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.simular_resposta_agendamento_teste(
 p_agendamento_id uuid,p_resposta text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_status text;v_novo text;v_inicio timestamptz;v_profissional text;v_nome text;
BEGIN
 -- Simulador OPERACIONAL usado por profissional autenticado (nao webhook de paciente).
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
  AND p.ativo AND p.perfil IN ('medico','enfermeira','equipe'))
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_resposta IS NULL OR p_resposta NOT IN ('1','2')
 THEN RAISE EXCEPTION 'Resposta invalida'; END IF;
 SELECT a.status,a.inicio,p.nome::text,pa.nome::text
 INTO v_status,v_inicio,v_profissional,v_nome
 FROM public.agendamentos_teste a
 JOIN public.profissionais p ON p.id=a.profissional_id
 JOIN public.pacientes pa ON pa.id=a.paciente_id
 WHERE a.id=p_agendamento_id FOR UPDATE OF a;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento inexistente'; END IF;
 IF v_status NOT IN ('agendado','confirmado','reagendamento_solicitado')
 THEN RAISE EXCEPTION 'Nao pode processar resposta de agendamento encerrado'; END IF;
 -- O fluxo real validara que a resposta se refere ao horario ainda vigente.
 v_novo:=CASE WHEN p_resposta='1' THEN 'confirmado' ELSE 'reagendamento_solicitado' END;
 UPDATE public.agendamentos_teste SET status=v_novo,atualizado_em=now()
 WHERE id=p_agendamento_id;
 IF p_resposta='2' THEN
  INSERT INTO public.pendencias_agenda_teste(agendamento_id,tipo,aberta_por)
  VALUES(p_agendamento_id,'reagendamento',auth.uid())
  ON CONFLICT DO NOTHING;
 ELSE
  UPDATE public.pendencias_agenda_teste
   SET status='resolvida',resolvida_em=now(),resolvida_por=auth.uid()
   WHERE agendamento_id=p_agendamento_id AND tipo='reagendamento' AND status='aberta';
 END IF;
 IF v_status IS DISTINCT FROM v_novo THEN
  INSERT INTO public.agendamentos_auditoria_teste(agendamento_id,acao,usuario_id,status_anterior,status_novo)
  VALUES(p_agendamento_id,'resposta_simulada_'||p_resposta,auth.uid(),v_status,v_novo);
 END IF;
 RETURN v_novo;
END $agenda$;

CREATE OR REPLACE FUNCTION public.listar_pendencias_agenda_teste()
RETURNS TABLE(pendencia_id uuid,agendamento_id uuid,paciente_nome text,
 profissional_nome text,inicio_local text,aberta_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
  AND p.ativo AND p.perfil='equipe')
 THEN RAISE EXCEPTION 'Painel exclusivo da equipe administrativa'; END IF;
 RETURN QUERY SELECT pe.id,a.id,pa.nome::text,pr.nome::text,
  to_char(a.inicio AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')::text,
  pe.aberta_em
 FROM public.pendencias_agenda_teste pe
 JOIN public.agendamentos_teste a ON a.id=pe.agendamento_id
 JOIN public.pacientes pa ON pa.id=a.paciente_id
 JOIN public.profissionais pr ON pr.id=a.profissional_id
 WHERE pe.status='aberta' ORDER BY pe.aberta_em DESC LIMIT 300;
END $agenda$;

CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento_teste(p_agendamento_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_old text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.ativo AND p.perfil IN ('medico','enfermeira','equipe'))
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_status NOT IN ('confirmado','realizado','cancelado','faltou','agendado')
 THEN RAISE EXCEPTION 'Status invalido'; END IF;
 SELECT a.status INTO v_old FROM public.agendamentos_teste a WHERE a.id=p_agendamento_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento nao encontrado'; END IF;
 IF v_old IN ('realizado','cancelado','faltou')
 THEN RAISE EXCEPTION 'Agendamento encerrado nao pode ser alterado'; END IF;
 IF v_old='confirmado' AND p_status='agendado'
 THEN RAISE EXCEPTION 'Nao reverter confirmacao sem reagendamento'; END IF;
 IF v_old='reagendamento_solicitado' AND p_status='agendado'
 THEN RAISE EXCEPTION 'Para reagendar, selecione nova data e horario'; END IF;
 UPDATE public.agendamentos_teste SET status=p_status,atualizado_em=now() WHERE id=p_agendamento_id;
 IF p_status IN ('confirmado','realizado','cancelado','faltou') THEN
  UPDATE public.pendencias_agenda_teste SET status='resolvida',resolvida_em=now(),resolvida_por=auth.uid()
   WHERE agendamento_id=p_agendamento_id AND status='aberta';
 END IF;
 INSERT INTO public.agendamentos_auditoria_teste(agendamento_id,acao,usuario_id,status_anterior,status_novo)
 VALUES(p_agendamento_id,'status_alterado',auth.uid(),v_old,p_status);
END $agenda$;

-- Trigger evita pendencia ficar aberta apos reagendamento confirmado via RPC existente.
CREATE OR REPLACE FUNCTION public.resolver_pendencia_ao_reagendar_teste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='reagendamento_solicitado'
   AND NEW.status='agendado' AND NEW.inicio IS DISTINCT FROM OLD.inicio THEN
   UPDATE public.pendencias_agenda_teste
   SET status='resolvida',resolvida_em=now(),resolvida_por=auth.uid()
   WHERE agendamento_id=NEW.id AND status='aberta';
 END IF;
 RETURN NEW;
END $agenda$;
DROP TRIGGER IF EXISTS resolver_pendencia_reagendamento_teste ON public.agendamentos_teste;
CREATE TRIGGER resolver_pendencia_reagendamento_teste AFTER UPDATE ON public.agendamentos_teste
 FOR EACH ROW EXECUTE FUNCTION public.resolver_pendencia_ao_reagendar_teste();

REVOKE ALL ON FUNCTION public.simular_resposta_agendamento_teste(uuid,text),
 public.listar_pendencias_agenda_teste(),
 public.atualizar_status_agendamento_teste(uuid,text),
 public.resolver_pendencia_ao_reagendar_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.simular_resposta_agendamento_teste(uuid,text),
 public.listar_pendencias_agenda_teste(),
 public.atualizar_status_agendamento_teste(uuid,text) TO authenticated;
COMMIT;
