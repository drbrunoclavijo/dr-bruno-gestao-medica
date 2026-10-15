-- Majestic Santé Institute: estrutura inicial de prescrições FICTÍCIAS.
-- Somente testes, sem liberação para uso clínico real.
-- Revisar migração, RLS, trilha de auditoria e LGPD antes de qualquer dado real.

CREATE TABLE IF NOT EXISTS public.prescricoes_teste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
  consulta_id uuid NOT NULL REFERENCES public.consultas_teste(id) ON DELETE RESTRICT,
  medico_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prescricao_itens_teste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id uuid NOT NULL REFERENCES public.prescricoes_teste(id) ON DELETE RESTRICT,
  medicamento text NOT NULL CHECK (length(btrim(medicamento)) > 0),
  dose text NOT NULL CHECK (length(btrim(dose)) > 0),
  via text NOT NULL CHECK (length(btrim(via)) > 0),
  frequencia text NOT NULL CHECK (length(btrim(frequencia)) > 0),
  duracao text,
  orientacoes text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prescricoes_teste_paciente_idx
  ON public.prescricoes_teste(paciente_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS prescricoes_teste_consulta_idx
  ON public.prescricoes_teste(consulta_id);
CREATE INDEX IF NOT EXISTS prescricoes_teste_medico_idx
  ON public.prescricoes_teste(medico_id);
CREATE INDEX IF NOT EXISTS prescricao_itens_teste_prescricao_idx
  ON public.prescricao_itens_teste(prescricao_id);

-- Impede vínculo entre uma prescrição e consulta de outro paciente.
CREATE OR REPLACE FUNCTION public.verificar_consulta_da_prescricao_teste()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.consultas_teste c
    WHERE c.id = NEW.consulta_id
      AND c.paciente_id = NEW.paciente_id
  ) THEN
    RAISE EXCEPTION 'Consulta não corresponde ao paciente da prescrição';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_consulta_prescricao_teste ON public.prescricoes_teste;
CREATE TRIGGER validar_consulta_prescricao_teste
  BEFORE INSERT OR UPDATE ON public.prescricoes_teste
  FOR EACH ROW EXECUTE FUNCTION public.verificar_consulta_da_prescricao_teste();

ALTER TABLE public.prescricoes_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescricao_itens_teste ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.prescricoes_teste FROM anon;
REVOKE ALL ON TABLE public.prescricao_itens_teste FROM anon;
REVOKE ALL ON TABLE public.prescricoes_teste FROM authenticated;
REVOKE ALL ON TABLE public.prescricao_itens_teste FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.prescricoes_teste TO authenticated;
GRANT SELECT, INSERT ON TABLE public.prescricao_itens_teste TO authenticated;

DROP POLICY IF EXISTS prescricoes_teste_medico_select ON public.prescricoes_teste;
CREATE POLICY prescricoes_teste_medico_select ON public.prescricoes_teste
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = auth.uid() AND p.perfil = 'medico' AND p.ativo = true
    )
  );

DROP POLICY IF EXISTS prescricoes_teste_medico_insert ON public.prescricoes_teste;
CREATE POLICY prescricoes_teste_medico_insert ON public.prescricoes_teste
  FOR INSERT TO authenticated WITH CHECK (
    medico_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = auth.uid() AND p.perfil = 'medico' AND p.ativo = true
    )
    AND EXISTS (
      SELECT 1 FROM public.consultas_teste c
      WHERE c.id = consulta_id AND c.paciente_id = paciente_id
    )
  );

DROP POLICY IF EXISTS itens_prescricao_teste_medico_select ON public.prescricao_itens_teste;
CREATE POLICY itens_prescricao_teste_medico_select ON public.prescricao_itens_teste
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.prescricoes_teste r
      JOIN public.profissionais p ON p.id = auth.uid()
      WHERE r.id = prescricao_id AND p.perfil = 'medico' AND p.ativo = true
    )
  );

DROP POLICY IF EXISTS itens_prescricao_teste_medico_insert ON public.prescricao_itens_teste;
CREATE POLICY itens_prescricao_teste_medico_insert ON public.prescricao_itens_teste
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescricoes_teste r
      JOIN public.profissionais p ON p.id = auth.uid()
      WHERE r.id = prescricao_id
        AND r.medico_id = auth.uid()
        AND p.perfil = 'medico' AND p.ativo = true
    )
  );

-- Sem UPDATE/DELETE no acesso de aplicativo nesta fase.
-- Antes de prescrever ou administrar na prática: incluir transação atômica,
-- assinatura médica, retificações, auditoria, regras de estoque e revisão regulatória.
