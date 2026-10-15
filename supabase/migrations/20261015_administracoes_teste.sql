-- Majestic Santé Institute | checagem de administração SIMULADA.
-- NÃO representa administração real ou baixa de estoque.
-- Revisar permissões, auditoria e LGPD antes de uso com pacientes reais.

CREATE TABLE IF NOT EXISTS public.administracoes_teste (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 item_prescricao_id uuid NOT NULL UNIQUE REFERENCES public.prescricao_itens_teste(id) ON DELETE RESTRICT,
 profissional_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
 checado_em timestamptz NOT NULL DEFAULT now(),
 observacao text CHECK (observacao IS NULL OR length(observacao)<=2000)
);

CREATE INDEX IF NOT EXISTS administracoes_teste_profissional_idx
ON public.administracoes_teste(profissional_id,checado_em DESC);

-- A enfermagem pode consultar a identidade cadastral dos pacientes e as prescrições de teste,
-- sem acesso ao prontuário da consulta.
DROP POLICY IF EXISTS pacientes_enfermeira_ler_teste ON public.pacientes;
CREATE POLICY pacientes_enfermeira_ler_teste ON public.pacientes
FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='enfermeira')
);

DROP POLICY IF EXISTS prescricoes_teste_enfermeira_select ON public.prescricoes_teste;
CREATE POLICY prescricoes_teste_enfermeira_select ON public.prescricoes_teste
FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='enfermeira')
);

DROP POLICY IF EXISTS itens_prescricao_teste_enfermeira_select ON public.prescricao_itens_teste;
CREATE POLICY itens_prescricao_teste_enfermeira_select ON public.prescricao_itens_teste
FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='enfermeira')
 AND EXISTS(SELECT 1 FROM public.prescricoes_teste rx WHERE rx.id=prescricao_id)
);

ALTER TABLE public.administracoes_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.administracoes_teste FROM anon,authenticated;
GRANT SELECT,INSERT ON public.administracoes_teste TO authenticated;

DROP POLICY IF EXISTS administracoes_teste_select ON public.administracoes_teste;
CREATE POLICY administracoes_teste_select ON public.administracoes_teste
FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil IN ('medico','enfermeira'))
);

DROP POLICY IF EXISTS administracoes_teste_insert ON public.administracoes_teste;
CREATE POLICY administracoes_teste_insert ON public.administracoes_teste
FOR INSERT TO authenticated WITH CHECK (
 profissional_id=auth.uid()
 AND EXISTS(SELECT 1 FROM public.profissionais p
 WHERE p.id=auth.uid() AND p.ativo=true AND p.perfil='enfermeira')
 AND EXISTS(
  SELECT 1 FROM public.prescricao_itens_teste i
  JOIN public.prescricoes_teste rx ON rx.id=i.prescricao_id
  WHERE i.id=item_prescricao_id
 )
);
-- A coluna checado_em é hora do servidor; bloquear horário arbitrário pela interface não
-- impede cliente malicioso: antes da prática, usar RPC servidor/trigger e auditoria imutável.
-- Apenas uma checagem por item nesta simulação, sem fracionamento ou múltiplas doses.
