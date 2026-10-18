# Perfil Gerente Comercial — aguardando contratação (teste)

## O que foi preparado
- Identificador de perfil: `administrativo`.
- Abas: Visão geral, Agenda, Pacientes (somente cadastro), Estoque (consulta), Financeiro completo, Auditoria geral.
- O Financeiro inclui contas a receber, pagamentos, taxas e despesas. O gerente pode registrar e cancelar lançamentos fictícios; todas as operações seguem as validações existentes.
- Auditoria apenas de leitura, incluindo ações financeiras e administrativas.
- Sem permissão para prontuário médico, prescrições, checagens de enfermagem ou conteúdos de protocolos clínicos.
- **Nenhum usuário criado, senha definida ou acesso ativado.**

## Ativação futura
1. **Somente depois da contratação**, criar uma identidade única no Supabase Auth em ambiente homologado e exigir MFA.
2. Vincular o UUID da identidade a `public.profissionais`, com perfil `administrativo`, após revisão das regras e aprovação do médico responsável.
3. Executar testes de acesso e negativas em ambiente de homologação, com usuários fictícios.
4. Somente depois de revisões técnicas, LGPD e conformidade clínica, planejar produção com dados reais.
5. Para desligar, definir `ativo=false`, revogar sessões no provedor de autenticação e verificar a trilha de ações.

## Proteção por camadas
- Menu não é controle suficiente; as funções SQL de Financeiro/Auditoria são preparadas para validar `auth.uid()`, `perfil` e `ativo` no servidor.
- O painel de Financeiro utiliza uma função de metadados de protocolos para gerente, evitando mostrar dados de prescrição/medicamento.
- O gerente não deve receber a função `medico` nem acesso a `service_role` ou ao painel administrativo do Supabase.
- A nova migração atualiza funções atuais com `pg_get_functiondef` e verificações para evitar abrir outras áreas; antes de executar, **faça backup e revise em homologação**.
- A aplicação da migração requer teste real autenticado, não comprovado pelo GitHub Actions.
