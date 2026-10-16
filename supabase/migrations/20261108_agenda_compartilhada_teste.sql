-- Majestic Sante: agenda administrativa DE TESTES, pacientes ficticios.
-- Nenhum disparo automatico de mensagens neste estagio.
BEGIN;
CREATE TABLE IF NOT EXISTS public.agendamentos_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(tipo IN ('consulta','retorno','procedimento','outro')),
 inicio timestamptz NOT NULL,
 fim timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'agendado'
   CHECK(status IN ('agendado','confirmado','realizado','cancelado','faltou')),
 observacao_administrativa text,
 criado_por uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(fim>inicio AND fim<=inicio+interval '4 hours'),
 CHECK(observacao_administrativa IS NULL OR length(observacao_administrativa)<=300)
);
CREATE INDEX IF NOT EXISTS agendamentos_teste_inicio_idx ON public.agendamentos_teste(inicio);
CREATE INDEX IF NOT EXISTS agendamentos_teste_profissional_inicio_idx ON public.agendamentos_teste(profissional_id,inicio);
CREATE TABLE IF NOT EXISTS public.agendamentos_auditoria_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agendamento_id uuid NOT NULL REFERENCES public.agendamentos_teste(id) ON DELETE RESTRICT,
 acao text NOT NULL,
 usuario_id uuid NOT NULL REFERENCES auth.users(id),
 registrado_em timestamptz NOT NULL DEFAULT now(),
 status_anterior text, status_novo text,
 inicio_anterior timestamptz,inicio_novo timestamptz
);
ALTER TABLE public.agendamentos_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendamentos_auditoria_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agendamentos_teste,public.agendamentos_auditoria_teste FROM PUBLIC,anon,authenticated;
-- Somente RPCs SECURITY DEFINER, com verificacao explicita de perfis.
CREATE OR REPLACE FUNCTION public.agenda_profissionais_teste()
RETURNS TABLE(id uuid,nome text,perfil text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
    AND u.ativo AND u.perfil IN ('medico','enfermeira','equipe')) THEN
  RAISE EXCEPTION 'Perfil nao autorizado';
 END IF;
 RETURN QUERY SELECT p.id,p.nome::text,p.perfil::text FROM public.profissionais p
 WHERE p.ativo AND p.perfil IN ('medico','enfermeira')
 ORDER BY p.nome LIMIT 100;
END $agenda$;
CREATE OR REPLACE FUNCTION public.listar_agendamentos_teste(p_de date,p_ate date)
RETURNS TABLE(id uuid,paciente_id uuid,paciente_nome text,profissional_id uuid,
 profissional_nome text,tipo text,inicio_local text,fim_local text,status text,
 observacao_administrativa text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
 AND u.ativo AND u.perfil IN ('medico','enfermeira','equipe'))
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_de IS NULL OR p_ate IS NULL OR p_ate<p_de OR p_ate>p_de+120
 THEN RAISE EXCEPTION 'Intervalo de agenda invalido (maximo 121 dias)'; END IF;
 RETURN QUERY
 SELECT a.id,a.paciente_id,p.nome::text,a.profissional_id,
 pr.nome::text,a.tipo::text,
 to_char(a.inicio AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')::text,
 to_char(a.fim AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD"T"HH24:MI')::text,
 a.status::text,a.observacao_administrativa::text
 FROM public.agendamentos_teste a
 JOIN public.pacientes p ON p.id=a.paciente_id
 JOIN public.profissionais pr ON pr.id=a.profissional_id
 WHERE a.inicio >= (p_de::timestamp AT TIME ZONE 'America/Sao_Paulo')
 AND a.inicio < ((p_ate+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
 ORDER BY a.inicio,a.id LIMIT 1500;
END $agenda$;
CREATE OR REPLACE FUNCTION public.salvar_agendamento_teste(
 p_paciente_id uuid,p_profissional_id uuid,p_tipo text,
 p_inicio_local timestamp without time zone,p_duracao_min integer,
 p_observacao text DEFAULT NULL,p_agendamento_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_id uuid;v_inicio timestamptz;v_fim timestamptz;v_velho public.agendamentos_teste%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais u WHERE u.id=auth.uid()
 AND u.ativo AND u.perfil IN ('medico','enfermeira','equipe'))
 THEN RAISE EXCEPTION 'Perfil nao autorizado'; END IF;
 IF p_tipo IS NULL OR p_tipo NOT IN ('consulta','retorno','procedimento','outro')
 OR p_duracao_min IS NULL OR p_duracao_min NOT BETWEEN 10 AND 240
 OR p_inicio_local IS NULL OR p_inicio_local < timestamp '2020-01-01'
 OR p_inicio_local > (now() AT TIME ZONE 'America/Sao_Paulo')+interval '2 years'
 OR length(coalesce(p_observacao,''))>300
 THEN RAISE EXCEPTION 'Dados do agendamento invalidos'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente ficticio nao encontrado'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=p_profissional_id
 AND p.ativo AND p.perfil IN ('medico','enfermeira'))
 THEN RAISE EXCEPTION 'Profissional nao disponivel'; END IF;
 v_inicio:=p_inicio_local AT TIME ZONE 'America/Sao_Paulo';
 v_fim:=v_inicio+(p_duracao_min*interval '1 minute');
 -- Serializa verificacao de conflitos por profissional.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_profissional_id::text));
 IF p_agendamento_id IS NOT NULL THEN
  SELECT * INTO v_velho FROM public.agendamentos_teste a WHERE a.id=p_agendamento_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento nao encontrado'; END IF;
  IF v_velho.status IN ('realizado','cancelado','faltou')
  THEN RAISE EXCEPTION 'Agendamento encerrado nao pode ser remarcado'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.agendamentos_teste a WHERE a.profissional_id=p_profissional_id
 AND a.id IS DISTINCT FROM p_agendamento_id AND a.status NOT IN ('cancelado','faltou')
 AND a.inicio<v_fim AND a.fim>v_inicio)
 THEN RAISE EXCEPTION 'Horario ocupado para o profissional selecionado'; END IF;
 IF p_agendamento_id IS NULL THEN
  INSERT INTO public.agendamentos_teste(paciente_id,profissional_id,tipo,inicio,fim,observacao_administrativa)
  VALUES(p_paciente_id,p_profissional_id,p_tipo,v_inicio,v_fim,nullif(btrim(p_observacao),''))
  RETURNING id INTO v_id;
  INSERT INTO public.agendamentos_auditoria_teste(agendamento_id,acao,usuario_id,status_novo,inicio_novo)
  VALUES(v_id,'criado',auth.uid(),'agendado',v_inicio);
 ELSE
  UPDATE public.agendamentos_teste SET paciente_id=p_paciente_id,profissional_id=p_profissional_id,
   tipo=p_tipo,inicio=v_inicio,fim=v_fim,status='agendado',
   observacao_administrativa=nullif(btrim(p_observacao),''),atualizado_em=now()
  WHERE id=p_agendamento_id RETURNING id INTO v_id;
  INSERT INTO public.agendamentos_auditoria_teste(agendamento_id,acao,usuario_id,status_anterior,status_novo,inicio_anterior,inicio_novo)
  VALUES(v_id,'reagendado',auth.uid(),v_velho.status,'agendado',v_velho.inicio,v_inicio);
 END IF;
 RETURN v_id;
END $agenda$;
CREATE OR REPLACE FUNCTION public.atualizar_status_agendamento_teste(p_agendamento_id uuid,p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $agenda$
DECLARE v_old text;v_new text;
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
 UPDATE public.agendamentos_teste SET status=p_status,atualizado_em=now() WHERE id=p_agendamento_id;
 INSERT INTO public.agendamentos_auditoria_teste(agendamento_id,acao,usuario_id,status_anterior,status_novo)
 VALUES(p_agendamento_id,'status_alterado',auth.uid(),v_old,p_status);
END $agenda$;
REVOKE ALL ON FUNCTION public.agenda_profissionais_teste(),
 public.listar_agendamentos_teste(date,date),
 public.salvar_agendamento_teste(uuid,uuid,text,timestamp without time zone,integer,text,uuid),
 public.atualizar_status_agendamento_teste(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agenda_profissionais_teste(),
 public.listar_agendamentos_teste(date,date),
 public.salvar_agendamento_teste(uuid,uuid,text,timestamp without time zone,integer,text,uuid),
 public.atualizar_status_agendamento_teste(uuid,text) TO authenticated;
COMMIT;
