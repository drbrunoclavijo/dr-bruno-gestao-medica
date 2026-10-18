# Assinatura Bird ID e receitas controladas — preparação técnica (homologação)

**Estado: NÃO CONECTADO, NÃO ASSINADO, NÃO HOMOLOGADO.** Nenhum endpoint deste projeto realiza assinatura real ou emissão controlada. Ambiente exclusivamente fictício.

## Bird ID
Documentação do provedor:
- https://docs.vaultid.com.br/workspace/cloud/api/autenticacao-de-usuarios/autenticacao-em-sistemas-web
- https://docs.vaultid.com.br/workspace/cloud/api/autenticacao-de-usuarios
- https://docs.vaultid.com.br/workspace/cloud/api/uso-de-certificado/assinatura-digital

Etapas necessárias:
1. Cadastrar o Majestic Santé como aplicação Bird ID, com **client_id, client_secret e redirect_uri** de homologação registrados junto ao provedor.
2. Implementar **OAuth2 Authorization Code + PKCE S256** no backend, com state aleatório, callback validado contra o usuário médico autenticado, sessão criptografada em repouso e expiração curta. Solicitar explicitamente `signature_session` se aprovado pelo Bird ID. Não usar o scope padrão `authentication_session` para assinar.
3. Nunca expor tokens/segredos no Vite/Vercel frontend, URL do browser, localStorage ou repositório. Não coletar senha, OTP ou chave privada.
4. Gerar um **PDF final imutável** com identidade médico/paciente, hash SHA-256, layout e carimbo cronológico. Rascunho "NÃO ASSINADO" NÃO deve ser promovido como se fosse documento emitido. O PDF de rascunho atual é apenas um protótipo.
5. Pedir assinatura do hash ao Bird ID a partir do servidor. O Bird ID oferece formatos RAW e CMS detached: isso **não é automaticamente um PDF PAdES**. Compor assinatura PDF/CMS/PAdES com biblioteca/backend especializado, vincular certificado, cadeia e conteúdo, validar resultado criptograficamente e verificar identidade do signatário autorizado.
6. Somente após verificação bem-sucedida, arquivar bytes originais assinados em bucket privado distinto (imutável, trilha de auditoria) e registrar tipo, hash, versão, assinante, validade, status de verificação, data/hora e ID de prescrição/consulta.
7. Permitir baixar **exatamente os bytes do PDF assinado**; não regenerar PDF a partir de campos após assinar. Entrega por WhatsApp oficial requer confirmação de destinatário, autorização adequada, controle de acesso, auditoria e integração servidor–servidor. Não habilitar envio para PDFs não assinados.
8. Testar fluxo real somente em homologação com credenciais de aplicativo e documentos fictícios. Incluir controles de revogação, expiração, autenticação por usuário, retry seguro, não duplicar assinaturas e política LGPD.

## Regras de receita controlada
- RDC 1000/2025, alterações e regras do SNCR (Anvisa): receitas eletrônicas de controle especial/notificações precisam de integração SNCR conforme a categoria, geração de numeração e utilização de modelos oficiais.
- Documentação: https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/sncr/receituario-eletronico
- https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/sncr/perguntas-e-respostas/
- Preencher CPF e endereço cadastral do paciente NÃO torna uma receita controlada válida. Validar necessidade e especificação de dados pelo modelo oficial da categoria; preservar elementos próprios do tipo de controle. Não usar o PDF genérico para notificação/receita de controle especial.
- Até autorização e homologação de assinatura Bird ID e integração SNCR, o aplicativo só gera rascunhos fictícios de receitas simples e prontuários, com status *não assinada*.

## Ponto de bloqueio atual
Faltam **credenciais de aplicativo Bird ID autorizadas pela prestadora**, informação do callback permitido, confirmação de contratação/escopo e um serviço seguro de backend para compor/verificar PAdES e arquivar os documentos. O certificado pessoal já disponível em sites externos não autoriza o Majestic Santé a usá-lo automaticamente. Nunca solicitar segredos pelo chat; configure-os diretamente em ambiente seguro quando homologados.
