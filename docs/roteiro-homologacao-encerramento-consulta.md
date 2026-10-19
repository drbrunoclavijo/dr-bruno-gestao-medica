# Homologação do encerramento médico | Majestic Santé

**Somente ambiente Supabase isolado, com dados totalmente fictícios.** Não executar estas instruções no projeto de produção. Não colocar senhas ou chaves de serviço em commits, mensagens ou capturas.

## Pré-requisitos
- Banco isolado com as migrações anteriores do projeto já aplicadas, principalmente as tabelas `profissionais`, `pacientes`, `consultas_teste`, `agendamentos_teste`, `agendamentos_auditoria_teste` e `pendencias_agenda_teste`.
- Contas de teste distintas para médico, enfermeira e secretaria, autenticadas via Supabase Auth e associadas a profissionais ativos com perfis adequados.
- Faça backup verificável do banco **de homologação** antes de executar os scripts.
- Revise possíveis alterações posteriores que redefinam a RPC `atualizar_status_agendamento_teste`; a restrição de encerramento precisa ser a definição efetiva aplicada por último.

## Ordem dos arquivos nesta branch
Executar na ordem abaixo no projeto de homologação:
1. `supabase/migrations/20261019_encerramento_consulta_teste.sql`
2. `supabase/migrations/20261019_validar_vinculo_consulta_agenda_teste.sql`
3. `supabase/migrations/20261019_bloquear_finalizacao_direta_agenda_teste.sql`
4. `supabase/migrations/20261019_consultar_encerramento_consulta_teste.sql`

Antes de executar, conferir o esquema real em homologação, a tipagem das colunas e os efeitos de triggers já existentes. Parar se houver conflito de versões. Os scripts estão no repositório, **não foram aplicados automaticamente**.

## Teste manual de ponta a ponta (apenas dados fictícios)
1. Entrar com o médico de teste e criar um agendamento de consulta para seu próprio usuário e paciente fictício.
2. Abrir o atendimento pela agenda, salvar evolução preenchida e conferir que `consultas_teste.agendamento_id` é o UUID do agendamento.
3. Atualizar a etapa de revisão; confirmar os quatro itens.
4. Encerrar o atendimento e verificar: `agendamentos_teste.status='realizado'`, uma linha em `encerramentos_consulta_teste` e uma linha de auditoria com ação `consulta_encerrada`. O instante de fechamento vem do servidor.
5. Repetir a chamada com os mesmos UUIDs e confirmar que retorna o encerramento anterior sem duplicar registros.
6. Tentar fechar com evolução em branco, UUID inexistente, paciente diferente, agendamento errado, status cancelado, checklist incompleto e sessão anônima. Todas as tentativas devem falhar sem atualizar a agenda.
7. Tentar como enfermeira, secretaria e gerente administrativo, todos fictícios. Todos devem ser rejeitados pelo servidor.
8. Tentar marcar consulta como `realizado` pela RPC genérica de agenda: deve falhar. Confirmar que os fluxos de aplicações seguem separados.
9. Verificar no iPhone e no desktop que a conclusão aparece somente após confirmação do banco e que nenhuma receita ou termo é marcado como assinado.

## Testes automatizados
O comando `npm test` valida contratos do código, mas **não substitui integração com banco real**. O comando `npm run test:integration` usa somente dados de teste, exige variáveis de ambiente locais `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `TEST_MEDICO_EMAIL`, `TEST_MEDICO_PASSWORD`, `TEST_ENFERMEIRA_EMAIL`, `TEST_ENFERMEIRA_PASSWORD`, `TEST_EQUIPE_EMAIL`, `TEST_EQUIPE_PASSWORD`. Caso configure gerente, usar `TEST_ADMINISTRATIVO_EMAIL` e `TEST_ADMINISTRATIVO_PASSWORD`. O teste existente é não destrutivo; usa UUID inexistente nas chamadas de encerramento. **Não usar credenciais da produção.**

## Aprovação
Somente considerar homologado após testes de permissões, rollback em falha de auditoria, tentativas repetidas, inspeção do banco, revisão de privacidade/LGPD e evidência de funcionamento em iPhone. Nenhum resultado de GitHub Actions sozinho autoriza usar dados clínicos reais.
