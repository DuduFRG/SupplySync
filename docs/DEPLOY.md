# Publicação: API, Google Play e App Store

## 1. API em produção

### Infraestrutura recomendada

| Peça | Opção sugerida | Observação |
| --- | --- | --- |
| API | Fly.io, Render ou Railway (container do `apps/api/Dockerfile`) | 2+ instâncias |
| Banco | Neon, Supabase ou RDS PostgreSQL 16 | TLS obrigatório, backups diários |
| Redis | Upstash ou Redis gerenciado | rate limit compartilhado entre instâncias |
| Fotos | Cloudflare R2 ou S3 privado | implementar `PhotoStorage` com a mesma interface |
| Borda | Cloudflare (proxy ativo) | WAF, DDoS, rate limit de borda |
| E-mail | Resend | domínio com SPF, DKIM e DMARC |

### Variáveis de ambiente

Veja `apps/api/.env.example`. Em produção, cadastre-as no gerenciador de segredos do provedor.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # gere um para cada segredo
```

Obrigatórias em produção: `NODE_ENV=production`, `DATABASE_URL` com `sslmode=require`, `JWT_ACCESS_SECRET`,
`TOKEN_HASH_SECRET`, `PASSWORD_PEPPER`, `CAPTCHA_PROVIDER=turnstile`, `TURNSTILE_SECRET_KEY`,
`MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `REDIS_URL`, `TRUST_PROXY_HOPS` (1 com Cloudflare direto na API).

### Deploy

```bash
docker build -f apps/api/Dockerfile -t supplysync-api .
# Etapa de release (uma vez por deploy, com usuário de banco que pode alterar schema):
DATABASE_URL=... npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
# Depois, suba as réplicas com a nova imagem.
```

### Cloudflare (WAF e borda)

1. DNS `api.seudominio.com` com proxy ativo (nuvem laranja). SSL/TLS em **Full (strict)**.
2. **WAF > Managed rules**: Cloudflare Managed Ruleset e OWASP Core Ruleset ativos.
3. **Rate limiting rules** (borda, antes da API):
   - `/v1/auth/*`: 20 requisições por minuto por IP, ação *Managed Challenge*.
   - Demais rotas: 600 requisições por minuto por IP, ação *Block*.
4. **Bots**: Bot Fight Mode ativo.
5. Origem aceita apenas IPs da Cloudflare (firewall do provedor) ou Cloudflare Tunnel.
6. Turnstile: crie um widget para o domínio do app e use a chave de site no app e a secreta na API.

## 2. App: preparação

```bash
cd apps/mobile
npm i -g eas-cli
eas login
eas init                   # cria o projeto e informa o EAS_PROJECT_ID
```

Cadastre as variáveis de build no EAS (públicas, entram no app):

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://api.seudominio.com --environment production
eas env:create --name EXPO_PUBLIC_TURNSTILE_SITE_KEY --value <chave-de-site> --environment production
eas env:create --name EXPO_PUBLIC_TURNSTILE_BASE_URL --value https://seudominio.com --environment production
eas env:create --name EAS_PROJECT_ID --value <id> --environment production
```

O build de produção falha se a URL da API não for HTTPS.

Notificações:
- **iOS**: `eas credentials` gera a chave APNs automaticamente.
- **Android**: crie um projeto Firebase, envie a chave de conta de serviço FCM v1 com `eas credentials`.

## 3. Google Play

```bash
eas build --platform android --profile production   # gera .aab assinado (chave gerenciada pelo EAS)
eas submit --platform android --profile production  # envia para a faixa interna
```

No Play Console:
- **Segurança dos dados**: coleta de e-mail, nome e fotos (opcional), finalidade "funcionalidade do app", dados criptografados em trânsito, exclusão de conta disponível no app.
- **Exclusão de conta**: informe também uma URL pública com instruções (exigência do Google).
- Classificação de conteúdo, público-alvo (18+ recomendado por envolver valores entre adultos) e política de privacidade.
- Assinatura Família: produto de assinatura no Play Billing (via RevenueCat).

## 4. App Store

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production      # envia para o TestFlight
```

No App Store Connect:
- **Privacy Nutrition Labels**: e-mail, nome, fotos (opcional), identificador do dispositivo para push; nenhum rastreamento.
- Exclusão de conta dentro do app: já implementada em Ajustes > Excluir conta (diretriz 5.1.1(v)).
- `ITSAppUsesNonExemptEncryption = false` já configurado (apenas HTTPS padrão).
- Assinatura Família via StoreKit (RevenueCat); a Apple não permite cobrança externa para bens digitais.
- Forneça uma conta de teste com casa e itens para o time de revisão.

## 5. Checklist final

- [ ] Política de privacidade e termos publicados e linkados no app e nas lojas.
- [ ] Ícone, screenshots (6.7" e 6.5" para iOS; telefone para Android) e textos das lojas.
- [ ] Testes em aparelho físico: push, câmera, galeria, teclado, VoiceOver/TalkBack, fonte grande.
- [ ] `npm test` e `npm run typecheck` verdes no CI.
