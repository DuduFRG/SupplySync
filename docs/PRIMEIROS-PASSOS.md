# Primeiros passos: o SupplySync no seu celular

Este guia leva você do zero até o app aberto no seu celular, mesmo que você nunca tenha feito isso.
Leva uns 20 minutos na primeira vez. Depois, são só 2 comandos.

## Como funciona (em 30 segundos)

Enquanto o app está em teste, ele não fica nas lojas. Ele roda assim:

- **Seu computador** faz duas coisas: guarda os dados (o banco de dados) e "serve" o app.
- **O Expo Go**, no seu celular, baixa o app do seu computador pelo Wi-Fi e abre ele.
- Por isso, **o computador e o celular precisam estar na mesma rede Wi-Fi**, e o computador precisa ficar ligado com o terminal aberto enquanto você testa.

## Parte 1: preparar o computador (só uma vez)

### 1. Instalar o Node.js

O Node.js é o programa que roda o SupplySync no seu computador.

1. Acesse **https://nodejs.org**.
2. Clique no botão verde que diz **LTS** (é a versão estável).
3. Abra o arquivo baixado e clique em "Avançar" até terminar, sem mudar nada.

### 2. Instalar o Git

O Git baixa o projeto do GitHub e, no futuro, as atualizações que eu fizer.

- **Windows:** acesse **https://git-scm.com/download/win**, baixe e instale clicando em "Next" até o fim, sem mudar nada.
- **Mac:** pule este passo. O Mac oferece a instalação sozinho no passo 4, se precisar.

### 3. Abrir o Terminal

O Terminal é uma janela onde você digita comandos. Você vai colar comandos nele.

- **Windows:** clique no menu Iniciar, digite **Terminal** (ou **PowerShell**) e abra.
- **Mac:** aperte **Cmd + Espaço**, digite **Terminal** e aperte Enter.

Para colar um comando: copie daqui, clique na janela do Terminal, cole (**Ctrl + V** no Windows, **Cmd + V** no Mac) e aperte **Enter**.

Para conferir se o Node.js foi instalado, cole:

```
node -v
```

Deve aparecer algo como `v24.11.0`. Se aparecer um número menor que 22, reinstale pelo passo 1.
Se aparecer "comando não encontrado", feche o Terminal, abra de novo e tente outra vez.

### 4. Baixar o projeto

Cole, um de cada vez:

```
cd Documents
git clone https://github.com/DuduFRG/SupplySync.git
cd SupplySync
```

Isso cria a pasta **SupplySync** dentro de **Documentos**.
No Mac, se aparecer uma janela pedindo para instalar as "ferramentas de linha de comando", clique em **Instalar**, espere terminar e cole o comando `git clone` de novo.

### 5. Instalar as peças do projeto

Ainda no Terminal, dentro da pasta SupplySync, cole:

```
npm install
```

Demora alguns minutos e mostra bastante texto. É normal aparecerem avisos em amarelo ("warn"). Só se preocupe se terminar com **ERR!** em vermelho.

## Parte 2: ligar tudo (toda vez que for testar)

1. Abra o Terminal e entre na pasta do projeto:

   ```
   cd Documents/SupplySync
   ```

2. Ligue tudo com um comando só:

   ```
   npm run dev
   ```

3. Na primeira vez, ele prepara o banco de dados e as configurações sozinho. Você vai ver:

   ```
   ✔ Banco de dados ligado
   ✔ API ligada
   ```

   e, logo depois, **um QR Code grande** feito de quadradinhos.

4. **Windows:** se aparecer um aviso do Firewall perguntando sobre o Node.js, marque **Redes privadas** e clique em **Permitir acesso**. Sem isso, o celular não consegue falar com o computador.

Deixe essa janela aberta enquanto testa. Para desligar tudo no final, clique nela e aperte **Ctrl + C**.

## Parte 3: abrir no celular

1. Confirme que o celular está **no mesmo Wi-Fi** que o computador.
2. Escaneie o QR Code do Terminal:
   - **iPhone:** abra o app **Câmera** e aponte para o QR Code. Toque no aviso que aparece ("Abrir no Expo Go").
   - **Android:** abra o **Expo Go** e toque em **Scan QR code**.
3. **iPhone:** se o Expo Go pedir permissão para "encontrar dispositivos na rede local", toque em **Permitir**.
4. Na primeira vez, o app demora até 1 minuto para carregar (aparece uma barra de progresso). Nas próximas, é bem mais rápido.

## Parte 4: usando o app

### Criar sua conta
1. Passe pelos 8 capítulos de apresentação. Alguns pedem que você toque em algo para continuar: é de propósito.
2. Crie sua conta com nome, e-mail e senha.
3. O app pede um **código de 6 dígitos**. No modo de teste nenhum e-mail é enviado: o código aparece **no Terminal do computador**, dentro de uma caixa assim:

   ```
   >>> CÓDIGO: 123456 <<<
   ```

   Digite esse código no celular.

### Criar sua casa
4. Toque em **Criar uma casa**, dê um nome e escolha os itens. A estrela marca os itens **essenciais**.

### As 4 abas
- **Casa:** o estado de cada item. Toque no botão colorido à direita para avisar que um item está **acabando** ou que **acabou**. Toque no nome do item para ver detalhes, tirar foto ou ver o histórico. O **+** lá em cima adiciona itens.
- **Compras:** a lista do que precisa ser comprado, separada entre o que é **sua vez** e o que é dos outros. Toque em **Comprei**, informe o valor e o app divide a conta.
- **Contas:** quanto cada pessoa pagou, quem deve para quem e o histórico. Quando alguém pagar, toque em **Pago**.
- **Ajustes:** seu nome, o nome da casa, os **convites**, os documentos e a saída da conta.

### Testar com outra pessoa
5. Em **Ajustes**, toque em **Convidar alguém da casa**. Aparece um código como `ABCD-EFGH`.
6. A outra pessoa instala o Expo Go, entra no **mesmo Wi-Fi**, escaneia o **mesmo QR Code**, cria a conta dela e escolhe **Tenho um código de convite**.
7. Agora, quando uma pessoa marcar que algo acabou, a outra vê na hora (puxe a tela para baixo para atualizar).

## Quando algo dá errado

| O que aparece | O que fazer |
| --- | --- |
| "Não foi possível falar com a API em http://..." | O Terminal com `npm run dev` precisa estar aberto. Confira se o celular e o computador estão no mesmo Wi-Fi. No Windows, libere o Node.js no Firewall (Painel de Controle > Firewall > Permitir um aplicativo). |
| O QR Code abre, mas fica carregando para sempre | Redes de empresa, faculdade ou "Wi-Fi de visitante" bloqueiam aparelhos de se verem. Use a internet do celular como roteador (hotspot), conecte o computador nele e tente de novo. |
| "comando não encontrado" ou "not recognized" | Feche e abra o Terminal de novo. Se continuar, reinstale o Node.js (passo 1). |
| "Port 3333 is already in use" ou "Port 8081" | Já tem uma cópia rodando. Feche todas as janelas do Terminal, abra uma nova e rode `npm run dev` de novo. |
| Erro ao ligar o banco de dados no Windows | Instale o "Microsoft Visual C++ Redistributable" (pesquise esse nome no site da Microsoft, versão x64) e tente de novo. |
| Quero começar do zero, apagando os dados de teste | Desligue com Ctrl + C e apague a pasta `.data` dentro de SupplySync. O próximo `npm run dev` cria tudo de novo. |
| Os avisos (notificações) não funcionam | É esperado: o Expo Go não recebe avisos. Eles funcionam na versão instalada do app, que vamos gerar mais para frente. |

## Para pegar atualizações

Quando eu fizer melhorias, rode na pasta do projeto:

```
git pull
npm install
npm run dev
```
