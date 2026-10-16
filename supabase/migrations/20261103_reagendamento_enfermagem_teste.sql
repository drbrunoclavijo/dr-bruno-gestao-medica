-- Majestic Sante | reagendamento de sessao pela enfermagem, apenas TESTE.
-- Data prevista pode mudar; checado_em continua registrado na checagem real
-- (nunca substituido nem retrodatado por esta rotina).
BEGIN;
CREATE TABLE IF NOT EXISTS public.historico_datas_sessoes_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sessao_id uuid NOT NULL REFERENCES public.sessoes_protocolos_teste(id) ON DELETE RESTRICT,
 data_anterior date NOT NULL,
 data_nova date NOT NULL,
 motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 5 AND 500),
 alterado_por uuid NOT NULL REFERENCES auth.users(id),
 alterado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historico_datas_sessoes_teste_sessao_idx
 ON public.historico_datas_sessoes_teste(sessao_id,alterado_em DESC);
ALTER TABLE public.historico_datas_sessoes_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.historico_datas_sessoes_teste FROM PUBLIC,anon,authenticated;

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
 THEN RAISE EXCEPTION 'Informe a nova data e um motivo de 5 a 500 caracteres'; END IF;

 SELECT s.item_prescricao_id,s.data_prevista,s.status,
        pr.status,pr.inicio,pr.duracao_dias
 INTO v_item,v_old_date,v_status,v_proto_status,v_inicio,v_dias
 FROM public.sessoes_protocolos_teste s
 JOIN public.protocolos_teste pr ON pr.id=s.protocolo_id
 WHERE s.id=p_sessao_id FOR UPDATE OF s,pr;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sessao nao encontrada'; END IF;
 IF v_status<>'agendada' OR v_proto_status<>'ativo'
 THEN RAISE EXCEPTION 'Sessao ou protocolo nao esta ativo'; END IF;
 IF v_item IS NULL THEN
 RAISE EXCEPTION 'Vincule a sessao a uma prescricao antes do reagendamento pela enfermagem';
 END IF;
 IF EXISTS(SELECT 1 FROM public.administracoes_teste a WHERE a.item_prescricao_id=v_item)
 THEN RAISE EXCEPTION 'Sessao com checagem registrada nao pode ser reagendada'; END IF;
 -- Tolerancia administrativa para atraso: 60 dias apos a vigencia original.
 -- Não autoriza clinicamente o uso de medicacao fora do periodo prescrito.
 IF p_nova_data<v_inicio OR p_nova_data>v_inicio+v_dias+60
 THEN RAISE EXCEPTION 'Data fora do limite do protocolo (+60 dias). Solicite revisao do medico'; END IF;
 IF p_nova_data=v_old_date THEN RAISE EXCEPTION 'Selecione uma data diferente'; END IF;
 UPDATE public.sessoes_protocolos_teste
 SET data_prevista=p_nova_data WHERE id=p_sessao_id;
 INSERT INTO public.historico_datas_sessoes_teste(
 sessao_id,data_anterior,data_nova,motivo,alterado_por)
 VALUES(p_sessao_id,v_old_date,p_nova_data,btrim(p_motivo),auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.historico_reagendamentos_sessoes_teste(p_paciente_id uuid)
RETURNS TABLE(sessao_id uuid,data_anterior date,data_nova date,motivo text,alterado_em timestamptz,profissional_nome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profissionais p
   WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('enfermeira','medico')
 ) THEN RAISE EXCEPTION 'Acesso restrito a equipe clinica'; END IF;
 RETURN QUERY SELECT h.sessao_id,h.data_anterior,h.data_nova,h.motivo::text,h.alterado_em,
 coalesce(p.nome,'Profissional autorizado')::text
 FROM public.historico_datas_sessoes_teste h
 JOIN public.sessoes_protocolos_teste s ON s.id=h.sessao_id
 JOIN public.protocolos_teste pr ON pr.id=s.protocolo_id
 LEFT JOIN public.profissionais p ON p.id=h.alterado_por
 WHERE pr.paciente_id=p_paciente_id ORDER BY h.alterado_em DESC,h.id DESC LIMIT 500;
END $$;

REVOKE ALL ON FUNCTION public.reagendar_sessao_enfermagem_teste(uuid,date,text),
 public.historico_reagendamentos_sessoes_teste(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reagendar_sessao_enfermagem_teste(uuid,date,text),
 public.historico_reagendamentos_sessoes_teste(uuid) TO authenticated;
COMMIT;
