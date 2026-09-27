# Segurança do SupplySync

Cada requisito foi implementado no código e, quando possível, coberto por teste automatizado
(`apps/api/test/*.test.ts`, contra PostgreSQL real).

| Requisito | Como está implementado | Onde | Teste |
| --- | --- | --- | --- |
| **Segredos fora do frontend** | Segredos só em variáveis de ambiente da API. O app só lê variáveis `EXPO_PUBLIC_*` (URL da API e chave pública do Turnstile). `.env` no `.gitignore`. | `apps/api/src/config.ts`, `apps/mobile/app.config.ts` | ✔ |
| **Configuração fail closed** | A API não sobe com segredo curto, repetido ou de baixa entropia, nem em produção sem antibot, e-mail real e `sslmode=require`. Mensagens de erro mostram só o nome da variável, nunca o valor. | `config.ts` | ✔ |
| **Nunca confiar na entrada** | Toda entrada (body, params, query) passa por schema Zod estrito: chaves extras são rejeitadas (anti mass assignment), tipos, tamanhos e formatos validados. Limite global de 64 KB por requisição. | `packages/shared/src/schemas.ts`, `lib/validate.ts` | ✔ |
| **Sanitização** | Texto livre é normalizado (NFC) e perde caracteres de controle, bidi (Trojan Source), zero-width, `<` `>` e prefixos de fórmula de planilha (CSV injection). | `packages/shared/src/sanitize.ts` | ✔ |
| **SQL Injection** | Prisma com consultas parametrizadas. Nenhum `$queryRawUnsafe` no código de produção. | todo o backend | ✔ |
| **XSS** | API responde apenas JSON e imagens, com `Content-Security-Policy: default-src 'none'` e `nosniff`. O app renderiza texto puro (sem WebView com HTML de usuário). E-mails são texto puro. | `app.ts`, `mailer.ts` | ✔ |
| **IDOR / BOLA** | Toda rota com `:householdId` exige membership; recursos são buscados com `id` **e** `householdId`. Casa alheia responde 404 (não revela existência). Pessoa preferida, participantes e fotos precisam pertencer à mesma casa. IDs são UUID v4. | `lib/access.ts`, módulos | ✔ |
| **SSRF** | Nenhuma rota aceita URL. Toda saída HTTP passa por `safeFetch`: allowlist fixa de hosts, só HTTPS na porta 443, sem redirects, sem credenciais na URL, timeout e limite de resposta. | `lib/safe-fetch.ts` | ✔ |
| **Senhas** | Argon2id (19 MiB, t=2), salt aleatório por hash, mais *pepper* secreto fora do banco. Política: 10+ caracteres, letras e números, bloqueio de senhas comuns. | `lib/password.ts` | ✔ |
| **Rate limiting** | Três camadas: (1) global por IP em todas as rotas; (2) limites mais rígidos por rota sensível; (3) por conta/e-mail (login, códigos, convites) e por usuário autenticado (240/min). Redis em produção para funcionar com várias instâncias. | `app.ts`, `services/throttle.ts` | ✔ |
| **Força bruta de códigos** | Códigos de 6 dígitos guardados como HMAC, expiram em 15 min, máximo de 5 tentativas, código novo invalida o anterior. | `modules/auth/routes.ts` | ✔ |
| **Sessões** | Access token JWT HS256 de 15 min (algoritmo, emissor e audiência fixados). Refresh token opaco de 256 bits, guardado como HMAC, rotacionado a cada uso com **detecção de reuso** (reuso derruba a família inteira). `tokenVersion` encerra todas as sessões ao trocar senha ou excluir conta. No app, refresh token no Keychain/Keystore (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), access token só em memória. | `services/sessions.ts`, `mobile/src/api/client.ts` | ✔ |
| **Antibot** | Cloudflare Turnstile no cadastro, login, reenvio de código e recuperação de senha. Validação no servidor com a chave secreta; falha de verificação bloqueia (fail closed). Obrigatório em produção. | `services/captcha.ts`, `mobile/src/components/HumanCheck.tsx` | ✔ (config) |
| **Enumeração de usuários** | Cadastro, reenvio e recuperação respondem sempre igual. Login usa a mesma mensagem e o mesmo custo de Argon2 para e-mail inexistente. E-mail já cadastrado recebe um aviso em vez de uma nova conta. | `modules/auth/routes.ts` | ✔ |
| **Erros sem vazamento** | Handler central: 4xx com mensagens genéricas por status, 5xx sempre "Algo deu errado", detalhes só no log. Logs com *redact* de senha, tokens, códigos e `Authorization`. | `app.ts` | ✔ |
| **Rotas administrativas** | Não existem. Qualquer rota desconhecida responde 404 genérico. Sem `x-powered-by`, sem documentação exposta. | `app.ts` | ✔ |
| **Uploads** | Multipart com 1 arquivo e 5 MB. Tipo detectado pelos bytes (JPEG, PNG, WEBP, HEIC), nunca pelo nome. Nome gerado pelo servidor (sem path traversal). Armazenamento privado servido só por rota autenticada da casa. O app remove EXIF (inclusive GPS) antes de enviar. | `modules/photos`, `services/storage.ts`, `useUploadPhoto` | ✔ |
| **Prompt injection** | O MVP não usa IA. Se for adicionada (ex.: sugestão de itens), a regra é: entrada do usuário sempre como dado delimitado, nunca concatenada às instruções; saída do modelo validada por schema Zod antes de qualquer efeito; o modelo não recebe ferramentas com escrita. | este documento | n/a |
| **WAF / CDN** | API publicada somente atrás da Cloudflare (proxy laranja), com WAF gerenciado, regras de rate limit na borda e origem aceitando tráfego só da Cloudflare. `TRUST_PROXY_HOPS` garante que o IP real venha do proxy, sem permitir `X-Forwarded-For` forjado. | `docs/DEPLOY.md` | config |
| **Transporte** | HSTS com preload; builds de produção do app recusam API sem HTTPS; banco com TLS obrigatório. | `app.ts`, `app.config.ts`, `config.ts` | ✔ |
| **Privacidade e lojas** | Exclusão de conta dentro do app (exigência Apple e Google): dados pessoais apagados e lançamentos financeiros anonimizados para não quebrar as contas de quem fica. Backup do Android desativado. Permissões mínimas, microfone e contatos bloqueados. | `modules/me`, `app.config.ts` | ✔ |

## Checklist antes de publicar

- [ ] Gerar segredos novos (48 bytes aleatórios cada) no provedor de segredos, nunca em arquivo versionado.
- [ ] `CAPTCHA_PROVIDER=turnstile`, `MAIL_PROVIDER=resend`, `REDIS_URL` configurados.
- [ ] Banco gerenciado com TLS, backups automáticos e usuário da aplicação sem permissão de DDL (migrações com usuário separado).
- [ ] Cloudflare na frente da API, com regras do `docs/DEPLOY.md`.
- [ ] Trocar `LocalPhotoStorage` por bucket privado S3/R2 com a mesma interface.
- [ ] `npm audit --omit=dev` sem vulnerabilidades altas; Dependabot ou Renovate ativo.
- [ ] Monitoramento de erros sem PII (ex.: Sentry com *scrubbing*).
