-- Agenda operacional de testes: exposicao minima por perfil.
-- Medico e enfermeira enxergam seus proprios agendamentos; equipe enxerga todos.
-- Equipe so recebe dados de agenda, nunca medicamento, prescricao ou valores.
BEGIN;
CREATE OR REPLACE FUNCTION public.listar_agendamentos_teste(p_de date,p_ate date)
RETURNS TABLE(id uuid,paciente_id uuid,paciente_nome text,profissional_id uuid,
 profissional_nome text,tipo text,inicio_local text,fim_local text,status text,
 observacao_administrativa text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_perfil text;
BEGIN
 SELECT p.perfil::text INTO v_perfil
 FROM public.profissionais p WHERE p.id=auth.uid() AND p.ativo=true;
 IF v_perfil IS NULL OR v_perfil NOT IN ('medico','enfermeira','equipe')
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_de IS NULL OR p_ate IS NULL OR p_ate<p_de OR p_ate>p_de+120
 THEN RAISE EXCEPTION 'Intervalo de agenda invalido'; END IF;
 RETURN QUERY
 SELECT a.id,a.paciente_id,pa.nome::text,a.profissional_id,
 pr.nome::text,a.tipo::text,
 to_char(a.inicio AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')::text,
 to_char(a.fim AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')::text,
 a.status::text,a.observacao_administrativa::text
 FROM public.agendamentos_teste a
 JOIN public.pacientes pa ON pa.id=a.paciente_id
 JOIN public.profissionais pr ON pr.id=a.profissional_id
 WHERE a.inicio >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
 AND a.inicio < ((p_ate+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
 AND (v_perfil='equipe' OR a.profissional_id=auth.uid())
 ORDER BY a.inicio,a.id LIMIT 1500;
END $agenda$;

-- Agenda operacional compartilhada de aplicacoes sem informacoes de medicacao.
CREATE OR REPLACE FUNCTION public.agenda_aplicacoes_administrativa_teste(
 p_de date,p_ate date
) RETURNS TABLE(sessao_id uuid,paciente_nome text,profissional_nome text,
 data_prevista date,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_perfil text;
BEGIN
 SELECT p.perfil::text INTO v_perfil FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true;
 IF v_perfil IS NULL OR v_perfil NOT IN ('medico','enfermeira','equipe')
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_de IS NULL OR p_ate IS NULL OR p_ate<p_de OR p_ate>p_de+120
 THEN RAISE EXCEPTION 'Periodo invalido'; END IF;
 RETURN QUERY
 SELECT s.id,pa.nome::text,'Equipe de enfermagem'::text,s.data_prevista,
 CASE WHEN a.id IS NOT NULL THEN 'checada'::text ELSE 'pendente'::text END
 FROM public.sessoes_protocolos_teste s
 JOIN public.protocolos_teste pr ON pr.id=s.protocolo_id
 JOIN public.pacientes pa ON pa.id=pr.paciente_id
 LEFT JOIN public.administracoes_teste a ON a.item_prescricao_id=s.item_prescricao_id
 WHERE pr.status='ativo' AND s.status='agendada'
 AND s.data_prevista BETWEEN p_de AND p_ate
 ORDER BY s.data_prevista,s.id LIMIT 1500;
END $agenda$;
REVOKE ALL ON FUNCTION public.listar_agendamentos_teste(date,date),
 public.agenda_aplicacoes_administrativa_teste(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_agendamentos_teste(date,date),
 public.agenda_aplicacoes_administrativa_teste(date,date) TO authenticated;
COMMIT;
