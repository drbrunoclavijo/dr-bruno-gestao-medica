-- Majestic Sante | Financeiro ficticio — contas a receber e pagamentos.
-- Sem cobranca, emissao fiscal, conciliacao bancaria ou uso real.
BEGIN;
CREATE TABLE IF NOT EXISTS public.contas_receber_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE RESTRICT,
 protocolo_id uuid REFERENCES public.protocolos_teste(id) ON DELETE RESTRICT,
 descricao text NOT NULL CHECK(length(btrim(descricao)) BETWEEN 3 AND 200),
 valor_total numeric(12,2) NOT NULL CHECK(valor_total>0 AND valor_total<=10000000),
 vencimento date NOT NULL,
 status text NOT NULL DEFAULT 'aberta' CHECK(status IN ('aberta','cancelada')),
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 cancelado_em timestamptz,
 motivo_cancelamento text,
 CHECK(motivo_cancelamento IS NULL OR length(motivo_cancelamento)<=500)
);
CREATE INDEX IF NOT EXISTS contas_receber_paciente_vencimento_teste ON public.contas_receber_teste(paciente_id,vencimento);
CREATE TABLE IF NOT EXISTS public.pagamentos_receber_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas_receber_teste(id) ON DELETE RESTRICT,
 valor numeric(12,2) NOT NULL CHECK(valor>0 AND valor<=10000000),
 forma text NOT NULL CHECK(forma IN ('pix','cartao_credito','cartao_debito','dinheiro','transferencia','outro')),
 pago_em timestamptz NOT NULL DEFAULT now(),
 parcelas integer NOT NULL DEFAULT 1 CHECK(parcelas BETWEEN 1 AND 36),
 referencia text,
 criado_por uuid NOT NULL REFERENCES auth.users(id),
 criado_em timestamptz NOT NULL DEFAULT now(),
 CHECK(referencia IS NULL OR length(referencia)<=200)
);
CREATE INDEX IF NOT EXISTS pagamentos_conta_teste ON public.pagamentos_receber_teste(conta_id);
CREATE TABLE IF NOT EXISTS public.financeiro_auditoria_teste(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conta_id uuid NOT NULL REFERENCES public.contas_receber_teste(id) ON DELETE RESTRICT,
 pagamento_id uuid REFERENCES public.pagamentos_receber_teste(id) ON DELETE RESTRICT,
 acao text NOT NULL,
 usuario_id uuid NOT NULL REFERENCES auth.users(id),
 registrado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contas_receber_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_receber_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_auditoria_teste ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contas_receber_teste,public.pagamentos_receber_teste,public.financeiro_auditoria_teste FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.listar_contas_receber_teste()
RETURNS TABLE(conta_id uuid,paciente_id uuid,paciente_nome text,protocolo_id uuid,
 protocolo_nome text,descricao text,valor_total numeric,vencimento date,
 status text,total_pago numeric,saldo_pendente numeric,criado_em timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true) THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 RETURN QUERY
 SELECT c.id,c.paciente_id,pa.nome::text,c.protocolo_id,pr.nome::text,c.descricao::text,
 c.valor_total,c.vencimento,c.status::text,coalesce(pg.soma,0)::numeric,
 (c.valor_total-coalesce(pg.soma,0))::numeric,c.criado_em
 FROM public.contas_receber_teste c
 JOIN public.pacientes pa ON pa.id=c.paciente_id
 LEFT JOIN public.protocolos_teste pr ON pr.id=c.protocolo_id
 LEFT JOIN LATERAL(SELECT sum(p.valor) AS soma FROM public.pagamentos_receber_teste p WHERE p.conta_id=c.id) pg ON true
 ORDER BY c.vencimento DESC,c.criado_em DESC LIMIT 2000;
END $financeiro$;
CREATE OR REPLACE FUNCTION public.listar_pagamentos_receber_teste(p_conta_id uuid)
RETURNS TABLE(id uuid,valor numeric,forma text,pago_em timestamptz,parcelas integer,referencia text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true) THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 RETURN QUERY SELECT pg.id,pg.valor,pg.forma::text,pg.pago_em,pg.parcelas,pg.referencia::text
 FROM public.pagamentos_receber_teste pg WHERE pg.conta_id=p_conta_id
 ORDER BY pg.pago_em DESC LIMIT 300;
END $financeiro$;
CREATE OR REPLACE FUNCTION public.criar_conta_receber_teste(
 p_paciente_id uuid,p_protocolo_id uuid,p_descricao text,p_valor numeric,p_vencimento date
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
DECLARE v_id uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true) THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.pacientes p WHERE p.id=p_paciente_id)
 THEN RAISE EXCEPTION 'Paciente nao encontrado'; END IF;
 IF p_protocolo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.protocolos_teste pr
 WHERE pr.id=p_protocolo_id AND pr.paciente_id=p_paciente_id)
 THEN RAISE EXCEPTION 'Protocolo nao corresponde ao paciente'; END IF;
 IF length(btrim(coalesce(p_descricao,''))) NOT BETWEEN 3 AND 200 OR p_valor IS NULL
 OR p_valor<=0 OR p_valor>10000000 OR p_valor<>round(p_valor,2) OR p_vencimento IS NULL
 THEN RAISE EXCEPTION 'Descricao, valor ou vencimento invalidos'; END IF;
 INSERT INTO public.contas_receber_teste(paciente_id,protocolo_id,descricao,valor_total,vencimento,criado_por)
 VALUES(p_paciente_id,p_protocolo_id,btrim(p_descricao),p_valor,p_vencimento,auth.uid())
 RETURNING id INTO v_id;
 INSERT INTO public.financeiro_auditoria_teste(conta_id,acao,usuario_id) VALUES(v_id,'conta_criada',auth.uid());
 RETURN v_id;
END $financeiro$;
CREATE OR REPLACE FUNCTION public.registrar_pagamento_receber_teste(
 p_conta_id uuid,p_valor numeric,p_forma text,p_pago_em timestamptz,
 p_parcelas integer DEFAULT 1,p_referencia text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
DECLARE v_id uuid;v_total numeric;v_saldo numeric;v_status text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true) THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF p_valor IS NULL OR p_valor<=0 OR p_valor>10000000 OR p_valor<>round(p_valor,2)
 OR p_forma NOT IN ('pix','cartao_credito','cartao_debito','dinheiro','transferencia','outro')
 OR p_pago_em IS NULL OR p_pago_em>now()+interval '1 day'
 OR p_parcelas IS NULL OR p_parcelas NOT BETWEEN 1 AND 36
 OR length(coalesce(p_referencia,''))>200 THEN RAISE EXCEPTION 'Dados do pagamento invalidos'; END IF;
 SELECT c.valor_total,c.status INTO v_total,v_status FROM public.contas_receber_teste c
 WHERE c.id=p_conta_id FOR UPDATE;
 IF NOT FOUND OR v_status<>'aberta' THEN RAISE EXCEPTION 'Conta inexistente ou cancelada'; END IF;
 SELECT v_total-coalesce(sum(p.valor),0) INTO v_saldo FROM public.pagamentos_receber_teste p WHERE p.conta_id=p_conta_id;
 IF p_valor>v_saldo THEN RAISE EXCEPTION 'Pagamento supera saldo pendente'; END IF;
 INSERT INTO public.pagamentos_receber_teste(conta_id,valor,forma,pago_em,parcelas,referencia,criado_por)
 VALUES(p_conta_id,p_valor,p_forma,p_pago_em,p_parcelas,nullif(btrim(p_referencia),''),auth.uid())
 RETURNING id INTO v_id;
 INSERT INTO public.financeiro_auditoria_teste(conta_id,pagamento_id,acao,usuario_id)
 VALUES(p_conta_id,v_id,'pagamento_registrado',auth.uid());
 RETURN v_id;
END $financeiro$;
CREATE OR REPLACE FUNCTION public.cancelar_conta_receber_teste(
 p_conta_id uuid,p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $financeiro$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p WHERE p.id=auth.uid()
 AND p.perfil='medico' AND p.ativo=true) THEN RAISE EXCEPTION 'Financeiro restrito ao perfil medico'; END IF;
 IF length(btrim(coalesce(p_motivo,''))) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Informe motivo de 5 a 500 caracteres'; END IF;
 UPDATE public.contas_receber_teste c SET status='cancelada',
 cancelado_em=now(),motivo_cancelamento=btrim(p_motivo)
 WHERE c.id=p_conta_id AND c.status='aberta' AND NOT EXISTS
 (SELECT 1 FROM public.pagamentos_receber_teste p WHERE p.conta_id=c.id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Somente conta aberta sem pagamentos pode ser cancelada'; END IF;
 INSERT INTO public.financeiro_auditoria_teste(conta_id,acao,usuario_id)
 VALUES(p_conta_id,'conta_cancelada',auth.uid());
END $financeiro$;
REVOKE ALL ON FUNCTION public.listar_contas_receber_teste(),
 public.listar_pagamentos_receber_teste(uuid),
 public.criar_conta_receber_teste(uuid,uuid,text,numeric,date),
 public.registrar_pagamento_receber_teste(uuid,numeric,text,timestamptz,integer,text),
 public.cancelar_conta_receber_teste(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_contas_receber_teste(),
 public.listar_pagamentos_receber_teste(uuid),
 public.criar_conta_receber_teste(uuid,uuid,text,numeric,date),
 public.registrar_pagamento_receber_teste(uuid,numeric,text,timestamptz,integer,text),
 public.cancelar_conta_receber_teste(uuid,text) TO authenticated;
COMMIT;
