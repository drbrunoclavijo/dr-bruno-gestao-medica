# Dr. Bruno Clavijo | Gestão Médica

Protótipo visual responsivo para navegação pelo iPhone. **Não é um prontuário funcional**: não há login real, persistência de dados, prescrição, administração ou movimentação de estoque.

## Executar

Requer Node.js 20 ou superior.

```bash
npm install
npm run dev
```

## Publicar

Após testes, configurar hospedagem estática com comando `npm run build` e pasta `dist`. Não publicar dados reais de pacientes.

## Próximas etapas

1. Autenticação individual e autorização validada no servidor.
2. Banco de dados e regras de acesso por função, com segregação entre profissionais.
3. Pacientes e prontuários, com trilha de auditoria e controles LGPD.
4. Prescrição vinculada a paciente, medicamento, quantidade e unidade.
5. Administração confirmada por profissional autorizado, com data/hora, lote e checagem.
6. Estoque com movimentações transacionais, baixa por prescrição ou por administração configurável por medicamento, validade e custo por protocolo.
7. Testes automatizados, backup, política de retenção, logs e revisão de segurança antes de uso clínico.

**Importante:** A seleção de perfil nesta versão é somente visual e não restringe acesso real.
