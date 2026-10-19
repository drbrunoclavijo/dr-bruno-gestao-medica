-- Garante que consultas medicas nao sejam marcadas como realizadas pela RPC generica de agenda.
-- Homologacao somente; demais agendamentos mantem fluxo original.
BEGIN;
CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento_teste(p_agendamento_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_old text; v_tipo text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.ativo AND p.perfil IN ('medico','enfermeira','equipe'))
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_status NOT IN ('confirmado','realizado','cancelado','faltou','agendado')
 THEN RAISE EXCEPTION 'Status invalido'; END IF;
 SELECT a.status,a.tipo INTO v_old,v_tipo FROM public.agendamentos_teste a
 WHERE a.id=p_agendamento_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento nao encontrado'; END IF;
 IF v_old IN ('realizado','cancelado','faltou')
 THEN RAISE EXCEPTION 'Agendamento encerrado nao pode ser alterado'; END IF;
 IF p_status='realizado' AND v_tipo IN ('consulta','retorno')
 THEN RAISE EXCEPTION 'Consultas devem ser encerradas pelo prontuario medico'; END IF;
 IF v_old='confirmado' AND p_status='agendado'
 THEN RAISE EXCEPTION 'Nao reverter confirmacao sem reagendamento'; END IF;
 IF v_old='reagendamento_solicitado' AND p_status='agendado'
 THEN RAISE EXCEPTION 'Para reagendar, selecione nova data e horario'; END IF;
 UPDATE public.agendamentos_teste SET status=p_status,atualizado_em=now()
 WHERE id=p_agendamento_id;
 IF p_status IN ('confirmado','realizado','cancelado','faltou') THEN
  UPDATE public.pendencias_agenda_teste
  SET status='resolvida',resolvida_em=now(),resolvida_por=auth.uid()
  WHERE agendamento_id=p_agendamento_id AND status='aberta';
 END IF;
 INSERT INTO public.agendamentos_auditoria_teste(agendamento_id,acao,usuario_id,status_anterior,status_novo)
 VALUES(p_agendamento_id,'status_alterado',auth.uid(),v_old,p_status);
END $agenda$;
REVOKE ALL ON FUNCTION public.atualizar_status_agendamento_teste(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.atualizar_status_agendamento_teste(uuid,text) TO authenticated;
COMMIT;
