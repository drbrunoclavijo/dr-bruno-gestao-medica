# CRM Majestic Santé — implantação da etapa inicial

## Estado
Código em branch de revisão. Não há envio automático por WhatsApp, uso de IA nem dados reais.

## Passos no ambiente de testes
1. Revisar a migração `supabase/migrations/20261201_crm_relacionamento_teste.sql`, inclusive as políticas de segurança.
2. Executar a migração no projeto Supabase **de testes**, por responsável autorizado. Não colar em produção sem revisão.
3. Validar login de cada perfil, incluindo a Amanda (`equipe`), Dra. Carol (`enfermeira`), Dr. Bruno (`medico`) e `administrativo`.
4. Conferir que usuários não autenticados não podem ler contatos nem tarefas; testar que não há acesso às informações clínicas.
5. Cadastrar apenas contatos fictícios, incluir e concluir lembrete, reagendar, filtrar, editar e abrir o WhatsApp manualmente.
6. Validar a exibição na página inicial no desktop e no iPhone.
7. Rodar `npm install`, `npm test` e `npm run build` no projeto e avaliar os resultados antes de mesclar.
8. Somente depois de aprovação e testes, mesclar o PR e publicar.

## Próxima etapa
- Vincular CRM e agenda por mecanismo autorizado, sem misturar fichas clínicas e dados comerciais.
- Criar histórico de interações com auditoria de alterações.
- Registrar consentimento com data, finalidade, canal e prova, inclusive revogação.
- Configurar WhatsApp Cloud API apenas depois de elegibilidade do número e aprovação Meta, com regras de janela, templates e revisão humana.
- IA somente em backend, nunca colocando segredos no navegador; escalonar dúvidas clínicas para humanos.
