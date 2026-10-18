# WhatsApp no Majestic Santé — preparação sem envio (testes)

Status atual: **NENHUMA mensagem é enviada**. Os agendamentos geram apenas registros locais `rascunho` na tabela `agenda_mensagens_rascunho_teste`. Não há chave de API, webhook público ou processador de fila.

## Fluxo previsto após integração oficial e homologação
1. Profissional cria agendamento; trigger gera rascunho ligado ao id e ao horário.
2. Processador servidor, desativado por padrão, consultará apenas agendamentos elegíveis (futuros, consentimento WhatsApp verificado, telefone válido). Confirmações fora da janela de atendimento exigirão template aprovado de utilidade pela Meta. Idempotência por agendamento, revisão e template; respeitar limites de envio.
3. Mensagem de confirmação incluirá horário e profissional, sem especialidade, procedimento ou detalhes clínicos: "Olá! Seu atendimento com {profissional} foi agendado para {data}, às {hora}. Responda 1 para confirmar ou 2 para solicitar reagendamento."
4. Webhook autenticado pela assinatura `X-Hub-Signature-256`, com verificação de `message_id`, destinatário, agendamento vigente, número e janela de resposta. Processamento 1/2 somente após correlacionar mensagem à confirmação enviada; deduplicar eventos e registrar consentimento e auditoria.
5. **1:** marcar confirmado e responder com texto breve, sem informação sensível. **2:** marcar solicitação de reagendamento, gerar pendência para Amanda/gerente e enviar aviso. Inviabilizar confirmações para agendamentos encerrados/remarcados.
6. Status de entrega/falhas devem voltar ao banco. Nunca colocar token Meta no React/Vite ou no repositório: usar Supabase Edge Functions + Secrets.
7. Precisará de mecanismo de opt-out, periodicidade moderada, LGPD, política WhatsApp Business e monitoramento de custos.

## Segurança
- Rascunhos não são filas aptas a envio. **Não converter em automático** só com acesso a tokens.
- Configurar número do WhatsApp Business, business portfolio e template aprovado quando houver decisão de integrar.
- A tabela usa RLS e revoga acesso direto de anon/authenticated. Trigger só produz e invalida rascunhos.
- Nenhuma API não oficial que automatiza o WhatsApp Web (risco de bloqueio e segurança para atendimento clínico).
- Evite incluir diagnóstico, exames ou prescrições em mensagens de calendário.
- Histórico atual `simular_resposta_agendamento_teste` é SOMENTE simulação administrativa, não webhook de pacientes.

## Estimativas de custo
Verifique tarifas diretamente em https://business.whatsapp.com/products/platform-pricing . Tarifas dependem de país, categoria de template e mudanças de preços; API oficial pode ter custo variável por mensagem entregue. Sem integração, custo adicional de WhatsApp é R$ 0.
