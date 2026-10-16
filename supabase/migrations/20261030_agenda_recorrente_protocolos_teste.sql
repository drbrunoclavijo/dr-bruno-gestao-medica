-- Majestic Santé | geração de agenda recorrente para protocolos de TESTE.
-- Não cria prescrições, administrações, baixa de estoque ou custos.
BEGIN;
CREATE OR REPLACE FUNCTION public.gerar_sessoes_recorrentes_teste(
 p_protocolo_id uuid,
 p_primeira_data date,
 p_intervalo_dias integer,
 p_quantidade integer,
 p_descricao_base text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE
 v_inicio date;
 v_duracao integer;
 v_status text;
 v_data date;
 v_desc text;
 v_i integer;
 v_inseridas integer := 0;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profissionais prof
   WHERE prof.id=auth.uid() AND prof.ativo=true AND prof.perfil='medico'
 ) THEN RAISE EXCEPTION 'Acesso exclusivo ao médico'; END IF;
 IF p_primeira_data IS NULL OR p_intervalo_dias IS NULL OR
    p_intervalo_dias NOT BETWEEN 1 AND 90 OR
    p_quantidade IS NULL OR p_quantidade NOT BETWEEN 1 AND 52 OR
    length(btrim(coalesce(p_descricao_base,''))) NOT BETWEEN 1 AND 125
 THEN RAISE EXCEPTION 'Informe primeira data, intervalo de 1 a 90 dias, de 1 a 52 sessões e descrição válida'; END IF;

 -- Serializa edições concorrentes do mesmo protocolo.
 SELECT inicio,duracao_dias,status INTO v_inicio,v_duracao,v_status
 FROM public.protocolos_teste
 WHERE id=p_protocolo_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado'; END IF;
 IF v_status<>'ativo' THEN RAISE EXCEPTION 'Protocolo não está ativo'; END IF;
 IF p_primeira_data<v_inicio OR
    p_primeira_data+(p_quantidade-1)*p_intervalo_dias>=v_inicio+v_duracao
 THEN RAISE EXCEPTION 'Uma ou mais datas estão fora do período do protocolo'; END IF;

 FOR v_i IN 1..p_quantidade LOOP
   v_data := p_primeira_data+(v_i-1)*p_intervalo_dias;
   v_desc := btrim(p_descricao_base)||' - sessão '||v_i::text;
   IF NOT EXISTS(
      SELECT 1 FROM public.sessoes_protocolos_teste sess
      WHERE sess.protocolo_id=p_protocolo_id
        AND sess.data_prevista=v_data
        AND sess.descricao=v_desc
        AND sess.status='agendada'
   ) THEN
      INSERT INTO public.sessoes_protocolos_teste(
        protocolo_id,data_prevista,descricao,item_prescricao_id,observacao,criado_por
      ) VALUES(
        p_protocolo_id,v_data,v_desc,NULL,
        'Planejamento automático fictício — sem prescrição vinculada',auth.uid()
      );
      v_inseridas := v_inseridas+1;
   END IF;
 END LOOP;
 RETURN v_inseridas;
END $$;

REVOKE ALL ON FUNCTION public.gerar_sessoes_recorrentes_teste(uuid,date,integer,integer,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gerar_sessoes_recorrentes_teste(uuid,date,integer,integer,text)
 TO authenticated;
COMMIT;
