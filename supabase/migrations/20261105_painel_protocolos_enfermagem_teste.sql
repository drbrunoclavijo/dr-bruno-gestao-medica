-- Majestic Sante | nurse access to operational protocols and planned sessions (TEST ONLY).
-- Financial fields are intentionally excluded.
BEGIN;
CREATE OR REPLACE FUNCTION public.protocolos_operacionais_enfermagem_teste()
RETURNS TABLE(
 protocolo_id uuid,paciente_id uuid,paciente_nome text,nome text,
 inicio date,duracao_dias integer,status text,
 total_sessoes bigint,sessoes_checadas bigint,sessoes_pendentes bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo AND p.perfil IN ('enfermeira','medico')
 ) THEN RAISE EXCEPTION 'Acesso exclusivo a equipe clinica'; END IF;
 RETURN QUERY
 SELECT pr.id,pr.paciente_id,pa.nome::text,pr.nome::text,
 pr.inicio,pr.duracao_dias,pr.status::text,
 count(s.id) FILTER(WHERE s.status='agendada')::bigint,
 count(s.id) FILTER(WHERE s.status='agendada' AND a.id IS NOT NULL)::bigint,
 count(s.id) FILTER(WHERE s.status='agendada' AND a.id IS NULL)::bigint
 FROM public.protocolos_teste pr
 JOIN public.pacientes pa ON pa.id=pr.paciente_id
 LEFT JOIN public.sessoes_protocolos_teste s ON s.protocolo_id=pr.id
 LEFT JOIN public.administracoes_teste a ON a.item_prescricao_id=s.item_prescricao_id
 GROUP BY pr.id,pr.paciente_id,pa.nome,pr.nome,pr.inicio,pr.duracao_dias,pr.status
 ORDER BY (pr.status='ativo') DESC,pr.inicio DESC,pr.id
 LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.sessoes_operacionais_enfermagem_teste()
RETURNS TABLE(
 sessao_id uuid,protocolo_id uuid,paciente_id uuid,
 data_prevista date,descricao text,status text,
 item_prescricao_id uuid,medicamento text,dose text,via text,
 checado_em timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo AND p.perfil IN ('enfermeira','medico')
 ) THEN RAISE EXCEPTION 'Acesso exclusivo a equipe clinica'; END IF;
 RETURN QUERY
 SELECT s.id,s.protocolo_id,pr.paciente_id,
 s.data_prevista,s.descricao::text,s.status::text,
 s.item_prescricao_id,it.medicamento::text,it.dose::text,it.via::text,
 a.checado_em
 FROM public.sessoes_protocolos_teste s
 JOIN public.protocolos_teste pr ON pr.id=s.protocolo_id
 LEFT JOIN public.prescricao_itens_teste it ON it.id=s.item_prescricao_id
 LEFT JOIN public.administracoes_teste a ON a.item_prescricao_id=s.item_prescricao_id
 ORDER BY s.data_prevista,s.id LIMIT 2500;
END $$;

-- Replaces previous restriction so nurse can change the PLANNED date
-- even before the physician links an item to that session.
-- A checked session's date and actual administration timestamp remain immutable.
CREATE OR REPLACE FUNCTION public.reagendar_sessao_enfermagem_teste(
 p_sessao_id uuid,p_nova_data date,p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_item uuid;v_old_date date;v_status text;v_proto_status text;
 v_inicio date;v_dias integer;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('enfermeira','medico')
 ) THEN RAISE EXCEPTION 'Somente profissionais clinicos autorizados'; END IF;
 IF p_sessao_id IS NULL OR p_nova_data IS NULL
 OR length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 5 AND 500
 THEN RAISE EXCEPTION 'Informe nova data e motivo entre 5 e 500 caracteres'; END IF;
 SELECT s.item_prescricao_id,s.data_prevista,s.status,pr.status,pr.inicio,pr.duracao_dias
 INTO v_item,v_old_date,v_status,v_proto_status,v_inicio,v_dias
 FROM public.sessoes_protocolos_teste s
 JOIN public.protocolos_teste pr ON pr.id=s.protocolo_id
 WHERE s.id=p_sessao_id FOR UPDATE OF s,pr;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessao nao encontrada'; END IF;
 IF v_status<>'agendada' OR v_proto_status<>'ativo'
 THEN RAISE EXCEPTION 'Apenas sessao agendada de protocolo ativo pode ser reagendada'; END IF;
 IF v_item IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.administracoes_teste a WHERE a.item_prescricao_id=v_item
 ) THEN RAISE EXCEPTION 'Sessao com checagem registrada nao pode ser reagendada'; END IF;
 IF p_nova_data<v_inicio OR p_nova_data>v_inicio+v_dias+60
 THEN RAISE EXCEPTION 'Data fora do limite administrativo. Solicite avaliacao medica'; END IF;
 IF p_nova_data=v_old_date THEN RAISE EXCEPTION 'Selecione uma data diferente'; END IF;
 UPDATE public.sessoes_protocolos_teste SET data_prevista=p_nova_data WHERE id=p_sessao_id;
 INSERT INTO public.historico_datas_sessoes_teste(
 sessao_id,data_anterior,data_nova,motivo,alterado_por)
 VALUES(p_sessao_id,v_old_date,p_nova_data,btrim(p_motivo),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.protocolos_operacionais_enfermagem_teste(),
 public.sessoes_operacionais_enfermagem_teste(),
 public.reagendar_sessao_enfermagem_teste(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.protocolos_operacionais_enfermagem_teste(),
 public.sessoes_operacionais_enfermagem_teste(),
 public.reagendar_sessao_enfermagem_teste(uuid,date,text) TO authenticated;
COMMIT;
