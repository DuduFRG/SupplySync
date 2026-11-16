# E-mail e login com Google/Apple: como configurar (de graça)

Este guia mostra como ligar três coisas: o envio de e-mails de verdade, o login com Google e o login com Apple.
Nada aqui tem custo, exceto a conta de desenvolvedor da Apple (US$ 99 por ano), que você já precisaria para publicar na App Store.

Todas as configurações vão em dois arquivos, criados pelo `npm run setup`:

- `apps/api/.env`: configurações do servidor (podem ter senhas, nunca vão para o GitHub).
- `apps/mobile/.env`: configurações do app (só valores públicos).

Para abrir esses arquivos: abra a pasta SupplySync no seu computador e use o Bloco de Notas (Windows) ou o TextEdit (Mac).
Depois de mudar algo, desligue o `npm run dev` (Ctrl + C) e ligue de novo.

## 1. E-mails de verdade (grátis, sem domínio próprio)

Hoje, em modo de teste, os e-mails aparecem no Terminal. Para que cheguem na caixa de entrada das pessoas,
escolha uma das duas opções. As duas são gratuitas.

### Opção A: Gmail (mais simples para começar)

Limite: cerca de 500 e-mails por dia. Recomendação: crie um Gmail só para o app, por exemplo `supplysync.app@gmail.com`.

1. Entre nesse Gmail e acesse **myaccount.google.com/security**.
2. Ative a **Verificação em duas etapas** (o Google pede o seu celular).
3. Acesse **myaccount.google.com/apppasswords**, digite o nome "SupplySync" e clique em **Criar**.
4. O Google mostra uma senha de 16 letras. Copie (sem os espaços). Ela só aparece uma vez.
5. No arquivo `apps/api/.env`, deixe assim:

   ```
   MAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=supplysync.app@gmail.com
   SMTP_PASS=asenhade16letras
   MAIL_FROM="SupplySync <supplysync.app@gmail.com>"
   ```

### Opção B: Brevo (para quando o app crescer)

Limite: 300 e-mails por dia no plano gratuito, com painel de envios.

1. Crie uma conta gratuita em **brevo.com**.
2. Em **Senders, Domains & Dedicated IPs > Senders**, adicione e confirme o e-mail que vai aparecer como remetente.
3. Em **SMTP & API > SMTP**, gere uma **SMTP key** e anote o **Login** que aparece na página.
4. No arquivo `apps/api/.env`:

   ```
   MAIL_PROVIDER=smtp
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=o-login-que-o-brevo-mostra
   SMTP_PASS=a-smtp-key
   MAIL_FROM="SupplySync <o-email-que-voce-confirmou>"
   ```

**Testar:** ligue o `npm run dev` e crie uma conta no app usando o seu e-mail real.
Devem chegar o código de confirmação e, depois de confirmar, o e-mail de boas-vindas.
Nas primeiras vezes eles podem cair no spam: marque como "não é spam".

## 2. Login com Apple

- **No Expo Go do iPhone:** já funciona para testes, sem configurar nada.
- **Na versão instalada e na App Store:** precisa da conta de desenvolvedor da Apple. O EAS Build ativa a permissão sozinho ao gerar o app.

Antes de publicar, no `apps/api/.env` do **servidor de produção**, deixe só o identificador do app:

```
APPLE_CLIENT_IDS=app.supplysync.mobile
```

O valor `host.exp.Exponent` (o Expo Go) é aceito só em testes. Em produção o servidor se recusa a ligar com ele,
por segurança: qualquer projeto no Expo Go recebe logins com esse identificador.

## 3. Login com Google

O botão do Google aparece só na **versão instalada** do app (não no Expo Go). Gerar essa versão é gratuito pelo EAS Build.

1. Acesse **console.cloud.google.com** com a sua conta Google e crie um projeto chamado "SupplySync". É gratuito.
2. Vá em **APIs e serviços > Tela de consentimento OAuth** (ou "Google Auth Platform"):
   - Tipo de usuário: **Externo**.
   - Nome do app: SupplySync. E-mail de suporte: o seu.
   - Escopos: `email`, `profile` e `openid` (os básicos, que não exigem revisão do Google).
3. Vá em **APIs e serviços > Credenciais > Criar credenciais > ID do cliente OAuth** e crie três:
   - **Aplicativo da Web**: só dê um nome. Copie o ID.
   - **iOS**: ID do pacote `app.supplysync.mobile`. Copie o ID.
   - **Android**: nome do pacote `app.supplysync.mobile` e a "impressão digital SHA-1".
     Para pegar a SHA-1: dentro de `apps/mobile`, rode `npx eas-cli credentials`, escolha Android e copie o valor "SHA1 Fingerprint".
4. No `apps/api/.env`, coloque os três IDs separados por vírgula:

   ```
   GOOGLE_CLIENT_IDS=id-web.apps.googleusercontent.com,id-ios.apps.googleusercontent.com,id-android.apps.googleusercontent.com
   ```

5. No `apps/mobile/.env`:

   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=id-web.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=id-ios.apps.googleusercontent.com
   ```

Esses IDs não são senhas: é seguro que fiquem dentro do app.

## Como funciona por dentro (para referência)

- O app faz o login direto com o Google ou a Apple e recebe um "token de identidade", assinado por eles.
- O servidor confere a assinatura com as chaves públicas do Google/Apple, quem emitiu, para qual app, a validade
  e, na Apple, um código aleatório (nonce) que impede reaproveitar um login.
- Se já existe uma conta com o mesmo e-mail, o login é ligado a ela. Se essa conta nunca confirmou o e-mail,
  a senha dela é invalidada: fica com a conta quem provou ser dono do e-mail.
- Contas criadas com Google/Apple não têm senha. Para excluir a conta, o app pede para entrar de novo pelo mesmo provedor.

## Pendente antes de publicar na App Store

- **Revogar o login da Apple ao excluir a conta.** A Apple pede que, quando alguém exclui a conta,
  o app avise a Apple. Isso exige uma chave da conta de desenvolvedor, que só existe depois de você assinar o programa.
  Quando você tiver a conta, eu implemento.
