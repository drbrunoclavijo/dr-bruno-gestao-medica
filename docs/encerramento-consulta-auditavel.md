# Encerramento auditável de consulta (proposta para homologação)

## Estado atual verificado em 19/10/2026
`src/VisitFinalization.jsx` apenas confere registros existentes, guarda checkboxes em memória e **não encerra** consultas ou agendamentos. `src/ClinicalRecord.jsx` grava consultas em `consultas_teste`, mas a gravação observada não associa explicitamente `appointmentId` ao registro. Por isso, **não** é seguro interpretar uma consulta na mesma data como sendo o atendimento específico agendado.

Esta documentação não executa migrações nem libera uso clínico real.

## Contrato do encerramento

1. Exigir uma sessão Supabase autenticada, profissional médico ativo e autorização conferida pelo banco (nunca apenas pelo perfil selecionado na interface).
2. Receber o ID do agendamento e o ID da consulta clínica; validar que pertencem ao **mesmo paciente** e ao profissional autorizado. A simples igualdade de data não basta.
3. Exigir evolução salva e não vazia na consulta especificada, além da confirmação explícita dos quatro itens da revisão.
4. Não exigir prescrição quando não houver indicação; o profissional confirma que avaliou a necessidade, inclusive quando não emitiu receita. Não confundir documento anexado com documento assinado ou consentimento.
5. Registrar o encerramento por **uma transação atômica** no Supabase/Postgres. Persistir IDs do paciente, consulta e agendamento, profissional obtido de `auth.uid()`, instante do servidor, estado anterior e novo, e evento de auditoria.
6. Tornar a operação idempotente para o mesmo agendamento e consulta. Em caso de repetição, devolver o encerramento existente em vez de duplicar eventos.
7. Após encerrar, tornar o registro fechado somente leitura na interface de testes; uma retificação deve produzir histórico/versionamento, preservar o original e exigir identificação do autor e justificativa. Não apagar nem sobrescrever evolução anterior.
8. Caso qualquer validação falhe, **não** alterar status da agenda ou dados clínicos. Mostrar erro específico e permitir rever os registros.
9. Retorno agendado é uma ação **separada**, explicitamente iniciada e confirmada pelo usuário; não criar automaticamente.
10. No cliente, atualizar dados do servidor depois do sucesso; não apresentar mensagem de conclusão apenas por mudança de estado React.

## Ordem de implementação

### Etapa A: vínculo da consulta ao agendamento
Criar migração aditiva e retrocompatível para `consultas_teste.agendamento_id` (FK conforme o esquema efetivo de agendamentos). Não preencher retroativamente por coincidência de data; dados legados ficam sem vínculo, exigindo associação manual e validada. Ajustar `ClinicalRecord.jsx` para salvar o agendamento selecionado, sujeito a validação no banco.

### Etapa B: função transacional no Postgres
Implementar RPC `encerrar_consulta_teste(p_agendamento_id uuid, p_consulta_id uuid, p_checks jsonb)`, com `search_path` fixo, privilégios mínimos e checagens RLS/autorização dentro da função. Só aceitar IDs vinculados, evolução presente, checkboxes exigidos e status atual elegível. Proteger contra concorrência com bloqueio de linha. Criar tabela de encerramentos e eventos de auditoria com políticas de acesso restritas. Não aceitar `profissional_id`, `paciente_id` ou hora do cliente como fonte de verdade.

### Etapa C: interface
Depois de testar a RPC isoladamente, trocar o botão de conferência visual por `Encerrar atendimento de teste` **apenas quando houver agendamento e consulta vinculados**. Solicitar confirmação final, chamar a RPC, buscar novamente o atendimento e mostrar ID/data/hora do fechamento e responsável. A revisão visual continua disponível sem agendamento.

### Etapa D: testes obrigatórios
- Consulta sem evolução: bloqueada sem mutação.
- Consulta de outro paciente ou outro agendamento: bloqueada.
- Usuário da secretaria/enfermagem tentando encerrar consulta médica: bloqueado no servidor.
- Sessão expirada: bloqueada.
- Duplo clique/repetição de requisição: um único encerramento e um único evento.
- Falha ao salvar evento de auditoria: transação inteira revertida.
- Registros legados sem agendamento: não são fechados automaticamente.
- Consulta fechada não é alterada silenciosamente.
- Documentos sem assinatura não são marcados como assinados.
- Agenda reflete o novo status somente após confirmação do banco.
- Verificar no iPhone e computador, com identidades fictícias separadas.

## Bloqueadores antes de produção
Inspecionar migrações e nomes reais das tabelas, testar políticas RLS com cada papel, revisar autenticação, logs, backup, LGPD, retenção e responsabilidades clínicas. Nenhum teste deve utilizar dados reais de pacientes.
