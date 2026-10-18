-- Majestic Sante | Painel consolidado de auditoria TESTE.
-- Acesso exclusivamente medico ativo. Somente consulta, com limites por periodo.
-- FONTES: registros de auditoria existentes + eventos operacionais (nao auditoria exaustiva).
BEGIN;
CREATE OR REPLACE FUNCTION public.listar_auditoria_geral_teste(
 p_inicio date,p_fim date,p_modulo text DEFAULT 'todos',
 p_usuario uuid DEFAULT NULL
) RETURNS TABLE(
 evento_id text, ocorrido_em timestamptz, modulo text, acao text,
 responsavel_nome text, responsavel_id uuid, referencia_id uuid,
 detalhe text, natureza text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $audit$
BEGIN
 IF NOT EXISTS(
  SELECT 1 FROM public.profissionais prof
  WHERE prof.id=auth.uid() AND prof.ativo=true AND prof.perfil='medico'
 ) THEN RAISE EXCEPTION 'Auditoria restrita ao medico ativo'; END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_fim<p_inicio OR p_fim-p_inicio>365
 THEN RAISE EXCEPTION 'Periodo deve ter no maximo 366 dias'; END IF;
 IF p_modulo IS NULL OR p_modulo NOT IN
 ('todos','agenda','financeiro','despesas','estoque','enfermagem','protocolos')
 THEN RAISE EXCEPTION 'Modulo invalido'; END IF;

 RETURN QUERY
 WITH eventos AS (
  SELECT 'agenda-'||a.id::text AS chave,a.registrado_em AS instante,
   'agenda'::text AS area,a.acao::text AS operacao,a.usuario_id AS autor,
   a.agendamento_id AS referencia,
   concat_ws(' → ',nullif(a.status_anterior,''),nullif(a.status_novo,''))::text AS complemento,
   'historico'::text AS fonte
  FROM public.agendamentos_auditoria_teste a
  WHERE p_modulo IN ('todos','agenda')
   AND a.registrado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND a.registrado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'financeiro-'||f.id::text,f.registrado_em,'financeiro',f.acao::text,
   f.usuario_id,f.conta_id,
   CASE WHEN f.pagamento_id IS NOT NULL THEN 'Pagamento vinculado' ELSE 'Conta a receber' END::text,
   'historico'
  FROM public.financeiro_auditoria_teste f
  WHERE p_modulo IN ('todos','financeiro')
   AND f.registrado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND f.registrado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'despesas-'||d.id::text,d.criado_em,'despesas',d.acao::text,
   d.usuario_id,d.despesa_id,
   coalesce(descricao_desp.descricao,'Despesa sem descricao')::text,
   'historico'
  FROM public.auditoria_despesas_financeiras_teste d
  JOIN public.despesas_financeiras_teste descricao_desp ON descricao_desp.id=d.despesa_id
  WHERE p_modulo IN ('todos','despesas')
   AND d.criado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND d.criado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'estoque-vinculo-'||e.id::text,e.criado_em,'estoque',
   'medicamento_vinculado'::text,e.profissional_id,e.item_prescricao_id,
   (coalesce(prod.nome,'Produto')||' · '||e.quantidade::text)::text,'historico'
  FROM public.auditoria_vinculos_estoque_enfermagem_teste e
  JOIN public.estoque_produtos_teste prod ON prod.id=e.produto_id
  WHERE p_modulo IN ('todos','estoque')
   AND e.criado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND e.criado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'estoque-saida-'||m.id::text,m.criado_em,'estoque',
   'saida_checagem'::text,m.profissional_id,m.administracao_id,
   (coalesce(prod.nome,'Produto')||' · lote '||l.lote||' · '||m.quantidade::text)::text,
   'registro_operacional'
  FROM public.estoque_movimentos_teste m
  JOIN public.estoque_lotes_teste l ON l.id=m.lote_id
  JOIN public.estoque_produtos_teste prod ON prod.id=l.produto_id
  WHERE p_modulo IN ('todos','estoque')
   AND m.criado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND m.criado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'enfermagem-'||ad.id::text,ad.checado_em,'enfermagem',
   'checagem_registrada'::text,ad.profissional_id,ad.id,
   'Checagem de administracao registrada'::text,'registro_operacional'
  FROM public.administracoes_teste ad
  WHERE p_modulo IN ('todos','enfermagem')
   AND ad.checado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND ad.checado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'reagendamento-'||hs.id::text,hs.alterado_em,'protocolos',
   'sessao_reagendada'::text,hs.alterado_por,hs.sessao_id,
   (hs.data_anterior::text||' → '||hs.data_nova::text)::text,'historico'
  FROM public.historico_datas_sessoes_teste hs
  WHERE p_modulo IN ('todos','protocolos')
   AND hs.alterado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND hs.alterado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'

  UNION ALL
  SELECT 'protocolo-'||pr.id::text,pr.criado_em,'protocolos',
   'protocolo_criado'::text,pr.criado_por,pr.id,pr.nome::text,'registro_operacional'
  FROM public.protocolos_teste pr
  WHERE p_modulo IN ('todos','protocolos')
   AND pr.criado_em >=p_inicio::timestamp AT TIME ZONE 'America/Sao_Paulo'
   AND pr.criado_em <(p_fim+1)::timestamp AT TIME ZONE 'America/Sao_Paulo'
 )
 SELECT e.chave,e.instante,e.area,e.operacao,
  coalesce(p.nome::text,'Usuario sem cadastro ativo') AS responsavel_nome,
  e.autor,e.referencia,e.complemento,e.fonte
 FROM eventos e
 LEFT JOIN public.profissionais p ON p.id=e.autor
 WHERE p_usuario IS NULL OR e.autor=p_usuario
 ORDER BY e.instante DESC,e.chave DESC
 LIMIT 1500;
END $audit$;

CREATE OR REPLACE FUNCTION public.listar_responsaveis_auditoria_teste()
RETURNS TABLE(id uuid,nome text,perfil text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $audit$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profissionais p
  WHERE p.id=auth.uid() AND p.ativo AND p.perfil='medico')
 THEN RAISE EXCEPTION 'Auditoria restrita ao medico ativo'; END IF;
 RETURN QUERY SELECT p.id,p.nome::text,p.perfil::text
 FROM public.profissionais p
 ORDER BY p.nome LIMIT 100;
END $audit$;
REVOKE ALL ON FUNCTION public.listar_auditoria_geral_teste(date,date,text,uuid),
 public.listar_responsaveis_auditoria_teste() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.listar_auditoria_geral_teste(date,date,text,uuid),
 public.listar_responsaveis_auditoria_teste() TO authenticated;
COMMIT;
