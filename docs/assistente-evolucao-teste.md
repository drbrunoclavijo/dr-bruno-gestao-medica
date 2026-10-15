# Assistente de evolução — implantação no ambiente de testes

Esta funcionalidade **não é adequada para dados reais de pacientes** até que privacidade,
segurança, bases legais e contratos com os provedores, retenção, auditoria, incidentes e
fluxos clínicos tenham sido avaliados e validados.

## O que foi criado

- Componente na tela **Pacientes → Abrir ficha → Nova consulta**, com anotações livres à
  esquerda e uma evolução organizada/editável à direita.
- Botão **Organizar evolução com IA** faz uma chamada à função Supabase Edge
  `organizar-evolucao-teste` somente mediante ação do médico.
- O médico revisa e pode clicar em **Usar texto revisado no campo Evolução**;
  **Salvar consulta** continua sendo uma ação explícita e separada.
- A função verifica a sessão Supabase e o perfil `medico` ativo.
- Chave `OPENAI_API_KEY` utilizada apenas no servidor. Jamais colocar chaves
  `OPENAI_API_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` nas variáveis `VITE_*` da Vercel.
- As anotações de trabalho **não são armazenadas em tabela própria** pelo novo módulo;
  contudo, são enviadas à API do fornecedor de IA e devem ser apenas fictícias nesta fase.
- O texto revisado fica no campo `evolucao` da consulta existente.

## Ativar a função no Supabase

1. Acesse o painel do projeto Supabase e abra **Edge Functions**.
2. Crie ou publique uma função chamada **organizar-evolucao-teste**, com o conteúdo
   de `supabase/functions/organizar-evolucao-teste/index.ts`. Alternativamente,
   publique pelo CLI do Supabase com o projeto correto:

   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy organizar-evolucao-teste
   ```

3. Em **Edge Functions → Secrets**, configure **OPENAI_API_KEY** com uma chave
   própria da API da OpenAI (a API tem cobrança e disponibilidade separadas de
   assinaturas do ChatGPT). Não envie essa chave ao chat ou ao GitHub.
4. Confirme que **Verify JWT** está **ativado** para a função.
5. Confira que `SUPABASE_URL` e `SUPABASE_ANON_KEY` estão presentes como
   variáveis de ambiente da função; em projetos Supabase normalmente são
   fornecidas pela plataforma.
6. Opcionalmente, configure `OPENAI_MODEL=gpt-4.1-mini`, se essa opção estiver
   disponível na sua conta de API.
7. A versão do front-end é publicada normalmente na Vercel após o commit.

## Teste

1. Entre com o médico no app publicado em
   `https://dr-bruno-gestao-medica.vercel.app`.
2. Abra um **paciente fictício** → **Nova consulta**.
3. Escreva anotações fictícias, sem nomes ou dados identificáveis, clique
   **Organizar evolução com IA**.
4. Revise texto, edite se preciso, clique **Usar texto revisado no campo Evolução**.
5. Salve a consulta fictícia e confira a evolução no histórico.

Se aparecer erro de função indisponível, confira implantação, nome e segredos;
se aparecer `401`/`403`, confira autenticação, perfil e origem permitida.
O endpoint permite por padrão a origem oficial da Vercel e
`http://localhost:5173`; outros domínios precisam ser explicitamente aprovados
em `allowedOrigins`.

**Limitações conhecidas:** não há ditado/gravação/transcrição automática,
envio contínuo a cada nova fala, versionamento dos rascunhos, controles adicionais
de rate-limit/custo por usuário nem revisão de produção/LGPD.
