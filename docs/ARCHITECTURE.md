# Arquitetura do SupplySync

## Visão geral

```
┌──────────────────────────┐        HTTPS         ┌────────────────────────────┐
│  App Expo (iOS/Android)  │ ───────────────────▶ │  Cloudflare (CDN + WAF +   │
│  React Native + Router   │                      │  rate limit de borda)      │
│  TanStack Query          │                      └─────────────┬──────────────┘
│  SecureStore (Keychain)  │                                    │
└──────────────────────────┘                                    ▼
                                                  ┌────────────────────────────┐
                                                  │  API Fastify (Node 22)     │
                                                  │  Zod · JWT · Argon2id      │
                                                  │  Rate limit (Redis)        │
                                                  └───┬──────────┬─────────┬───┘
                                                      │          │         │
                                              PostgreSQL     Redis    Storage privado
                                               (Prisma)   (limites)   (fotos, S3/R2)
                                                      │
                                   Saídas permitidas (allowlist): Expo Push · Turnstile · Resend
```

## Por que esta stack

| Decisão | Motivo |
| --- | --- |
| **Expo + React Native (SDK 57)** | Um código para iOS e Android, builds e envio às lojas via EAS, atualização de dependências nativas coordenada. |
| **expo-router** | Rotas por arquivo, deep links (notificações abrem o item certo) e rotas tipadas em tempo de compilação. |
| **TanStack Query** | Cache, sincronização e atualização otimista. Sinalizar "Acabou" responde na hora, mesmo com rede lenta. |
| **Fastify** | Rápido, com plugins oficiais maduros para helmet, CORS, JWT, multipart e rate limit. |
| **PostgreSQL + Prisma** | Integridade relacional para dinheiro e membros; consultas parametrizadas por padrão (sem SQL injection). |
| **Zod no pacote `shared`** | Os mesmos schemas validam o formulário no app e a requisição na API. Uma única fonte de verdade. |
| **Monorepo npm workspaces** | API, app e domínio evoluem juntos, sem publicar pacotes. |

## Estrutura

```
supplysync/
├── apps/
│   ├── api/                      API REST
│   │   ├── prisma/               schema + migrações
│   │   ├── src/
│   │   │   ├── app.ts            montagem: segurança, auth, erros, rotas
│   │   │   ├── config.ts         variáveis de ambiente validadas (fail closed)
│   │   │   ├── lib/              access (anti-IDOR), crypto, password, safe-fetch, validate
│   │   │   ├── services/         sessions, captcha, mailer, push, storage, throttle
│   │   │   └── modules/          auth · me · households · items · purchases · photos
│   │   ├── test/                 testes de integração (Postgres real)
│   │   └── Dockerfile
│   └── mobile/                   App Expo
│       ├── app/                  rotas (expo-router)
│       │   ├── onboarding.tsx    8 capítulos narrativos
│       │   ├── (auth)/           entrar, criar conta, confirmar e-mail, redefinir senha
│       │   ├── setup/            criar/entrar em casa, inventário inicial
│       │   ├── (tabs)/           Casa · Compras · Contas · Ajustes
│       │   ├── item/             detalhe (sinalizar + foto) e formulário
│       │   └── purchase/new.tsx  registrar compra e divisão
│       └── src/
│           ├── api/              cliente HTTP com refresh seguro + hooks de dados
│           ├── auth/             sessão
│           ├── components/       design system (ui/) e componentes de domínio
│           ├── onboarding/       ilustrações animadas
│           └── theme/            tokens de cor, tipografia, espaço
├── packages/shared/              schemas Zod, regras de domínio, DTOs, constantes
└── docs/                         arquitetura, segurança, publicação
```

## Modelo de dados (resumo)

- **User**: e-mail único, hash Argon2id, `tokenVersion` para derrubar sessões.
- **Household / Membership**: casa e papel (OWNER, MEMBER). Toda consulta de dados da casa exige membership.
- **Item**: estado (`OK`, `LOW`, `OUT`), essencial, modo de compra (`ROTATION`, `PREFERRED`, `FAIR`), último comprador.
- **StatusEvent**: histórico de sinalizações, com nota e foto opcionais.
- **Purchase / PurchaseShare**: valor em centavos inteiros e a parte de cada pessoa.
- **Settlement**: pagamentos de acerto entre moradores.
- **RefreshToken / EmailCode / Invite**: guardados apenas como HMAC.

## Regras de domínio (`packages/shared/src/domain`)

- `suggestBuyer`: rodízio pela ordem de entrada na casa, preferência com fallback, ou equilíbrio (quem gastou menos em 60 dias).
- `splitEvenly`: divisão em centavos, com sobra distribuída de forma determinística.
- `computeBalances` + `suggestTransfers`: saldo líquido por pessoa (soma sempre zero) e o menor conjunto prático de pagamentos.

Funções puras, testadas, usadas igualmente pela API e pelo app.

## Planos (freemium)

Limites aplicados **no servidor** (`PLAN_LIMITS`):

| | Gratuito | Família |
| --- | --- | --- |
| Casas por pessoa | 1 | 3 |
| Moradores | 4 | 8 |
| Itens | 20 | 300 |
| Histórico visível | 60 dias | 10 anos |

Os saldos consideram sempre todo o histórico: dívida não expira com o plano.
A cobrança da assinatura deve usar compra dentro do app (App Store e Google Play exigem IAP para assinaturas digitais); a recomendação é RevenueCat, com webhook atualizando `Household.plan`.
