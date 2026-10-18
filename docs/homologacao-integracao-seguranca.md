# Homologação de integração e segurança — Majestic Santé Institute

**Somente ambiente Supabase de homologação, com pacientes fictícios. Não usar credenciais de produção.**

## 1. O que já está automatizado

- `npm test`: simulação de taxas InfinitePay, comparação do líquido e contratos estáticos de permissão.
- `npm run build`: compilação do frontend Vite.
- GitHub Actions executa ambos a cada atualização.

Esses passos **não** criam pacientes, consultam banco remoto nem provam isolamento real de perfis.

## 2. Testes reais das permissões no Supabase de homologação

Criar três usuários específicos **somente na homologação**, um por perfil: `medico`, `enfermeira` e `equipe`.
Garantir que existam como profissionais ativos e que os dados do ambiente sejam fictícios.

Definir localmente (nunca no GitHub) as variáveis de ambiente:

```text
SUPABASE_TEST_URL
SUPABASE_TEST_ANON_KEY
TEST_MEDICO_EMAIL
TEST_MEDICO_PASSWORD
TEST_ENFERMEIRA_EMAIL
TEST_ENFERMEIRA_PASSWORD
TEST_EQUIPE_EMAIL
TEST_EQUIPE_PASSWORD
```

Executar `npm run test:integration` **em máquina de homologação**, sem publicar senhas ou resultados com dados pessoais. O teste faz apenas autenticação e leituras, sem inserir, pagar, aplicar, cancelar ou baixar estoque.

O teste confere: permissão de relatórios por profissional; negação de relatórios e auditoria à equipe; acesso ao caixa somente médico; exclusividade da lista de procedimentos da enfermagem.

Se as variáveis não estiverem configuradas, o teste será **ignorado**. Um teste ignorado não significa que o acesso está correto.

## 3. Roteiro manual com dados exclusivamente fictícios

1. **Acesso:** confirmar login individual; bloquear Financeiro/Auditoria do usuário de enfermagem e de equipe também por RPC, não somente ocultando botões.
2. **Paciente:** cadastrar um paciente fictício identificável como TESTE; verificar se o cadastro não aparece indevidamente em outra conta.
3. **Agenda:** criar agendamento para o médico, marcar realizado e verificar histórico. Confirmar que não surgiu cobrança antes de ação financeira explícita.
4. **Protocolo:** escolher Essential Reset, alterar valor, simular de 1 a 12 parcelas com e sem repasse, salvar. Conferir que a tabela de origem reflete o valor cobrado.
5. **Financeiro:** gerar uma única conta vinculada ao agendamento ou protocolo; impedir duplicação; lançar um pagamento fictício. Confirmar bruto, taxa e líquido no resumo; não lançar a mesma taxa novamente em Despesas.
6. **Prescrição e estoque:** prescrever medicamento e insumo fictícios, selecionar lotes de teste e conferir saldos. A simples prescrição ou vinculação não pode baixar estoque.
7. **Checagem:** no perfil enfermagem, confirmar uma única checagem de teste e verificar saídas de medicamento e insumos na mesma transação. Repetir checagem deve falhar. Em lote vencido ou sem saldo, toda a operação deve ser revertida.
8. **Procedimentos da Dra. Carol:** cadastrar um procedimento livre, com valor e repasse; verificar que não tem itens do catálogo do médico e que não expõe seu caixa geral.
9. **Relatórios e Auditoria:** filtrar período, comparar lançamentos de origem, pagamentos e taxas; conferir operador e horário. Evento operacional não é auditoria imutável.
10. **PDF e dispositivo:** exportar Relatórios para PDF usando impressão do navegador, verificar paginação e uso no iPhone.

Não executar testes destrutivos em banco compartilhado com dados importantes. Use instância isolada ou dados inteiramente descartáveis.

## 4. Limitações e critérios de liberação

Passar no GitHub Actions comprova somente testes locais e compilação. A homologação integral exige teste autenticado dos 3 papéis e o roteiro manual acima, com validação dos resultados. O aplicativo **não está liberado para dados reais de pacientes**: ainda faltam revisão LGPD, segurança, trilha completa de auditoria, autenticação e avaliação clínica/regulatória.
