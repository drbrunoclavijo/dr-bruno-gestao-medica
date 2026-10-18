-- Majestic Sante | Preparacao de mensagens WhatsApp (SEM API, SEM ENVIOS).
-- Executar somente em ambiente de testes. Mantem consentimento e limites para integracao futura.
BEGIN;
CREATE TABLE IF NOT EXISTS public.agenda_mensagens_rascunho_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 agendamento_id uuid NOT NULL REFERENCES public.agendamentos_teste(id) ON DELETE RESTRICT,
 tipo text NOT NULL DEFAULT 'confirmacao' CHECK(tipo='confirmacao'),
 inicio_referencia timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho','substituido','cancelado')),
 criado_em timestamptz NOT NULL DEFAULT now(),
 UNIQUE(agendamento_id,inicio_referencia,tipo)
);
CREATE INDEX IF NOT EXISTS agenda_mensagens_rascunho_teste_agendamento_idx
 ON public.agenda_mensagens_rascunho_teste(agendamento_id,status);
ALTER TABLE public.agenda_mensagens_rascunho_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agenda_mensagens_rascunho_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.preparar_confirmacao_agenda_teste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $wa$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status='agendado' THEN
   INSERT INTO public.agenda_mensagens_rascunho_teste(agendamento_id,inicio_referencia)
   VALUES(NEW.id,NEW.inicio) ON CONFLICT DO NOTHING;
  END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.status NOT IN ('agendado','reagendamento_solicitado') THEN
   UPDATE public.agenda_mensagens_rascunho_teste m
    SET status='cancelado'
   WHERE m.agendamento_id=NEW.id AND m.status='rascunho';
  ELSIF NEW.inicio IS DISTINCT FROM OLD.inicio
   OR NEW.profissional_id IS DISTINCT FROM OLD.profissional_id
   OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id THEN
   UPDATE public.agenda_mensagens_rascunho_teste m
    SET status='substituido'
   WHERE m.agendamento_id=NEW.id AND m.status='rascunho';
   IF NEW.status='agendado' THEN
    INSERT INTO public.agenda_mensagens_rascunho_teste(agendamento_id,inicio_referencia)
    VALUES(NEW.id,NEW.inicio) ON CONFLICT DO NOTHING;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $wa$;
DROP TRIGGER IF EXISTS preparar_confirmacao_agenda_teste
 ON public.agendamentos_teste;
CREATE TRIGGER preparar_confirmacao_agenda_teste
 AFTER INSERT OR UPDATE OF inicio,profissional_id,paciente_id,status
 ON public.agendamentos_teste
 FOR EACH ROW EXECUTE FUNCTION public.preparar_confirmacao_agenda_teste();
REVOKE ALL ON FUNCTION public.preparar_confirmacao_agenda_teste()
 FROM PUBLIC,anon,authenticated;
COMMIT;
