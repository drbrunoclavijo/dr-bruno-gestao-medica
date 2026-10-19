-- Valida o vínculo de uma consulta com a agenda no momento de salvar.
-- Dados fictícios exclusivamente; aplicar somente em homologação após a migração de vínculo.
-- A agenda é apenas referência: início real da consulta pode diferir do horário ou da data prevista.
BEGIN;
CREATE OR REPLACE FUNCTION public.validar_vinculo_consulta_agenda_teste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v_ag public.agendamentos_teste%ROWTYPE;
BEGIN
 IF NEW.agendamento_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.profissional_id IS DISTINCT FROM auth.uid() THEN
  RAISE EXCEPTION 'A consulta deve pertencer ao medico autenticado';
 END IF;
 SELECT * INTO v_ag FROM public.agendamentos_teste a
 WHERE a.id=NEW.agendamento_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento nao encontrado'; END IF;
 IF v_ag.paciente_id IS DISTINCT FROM NEW.paciente_id
    OR v_ag.profissional_id IS DISTINCT FROM NEW.profissional_id
    OR v_ag.tipo NOT IN ('consulta','retorno')
    OR v_ag.status NOT IN ('agendado','confirmado')
 THEN RAISE EXCEPTION 'Agendamento nao e elegivel para esta consulta'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS validar_vinculo_consulta_agenda_teste ON public.consultas_teste;
CREATE TRIGGER validar_vinculo_consulta_agenda_teste
BEFORE INSERT ON public.consultas_teste
FOR EACH ROW EXECUTE FUNCTION public.validar_vinculo_consulta_agenda_teste();
REVOKE ALL ON FUNCTION public.validar_vinculo_consulta_agenda_teste() FROM PUBLIC,anon,authenticated;
COMMIT;
