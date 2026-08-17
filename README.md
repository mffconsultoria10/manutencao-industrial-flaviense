# Manutenção Industrial Flaviense

Sistema de cadastro de equipamentos, plano de manutenções preventivas,
monitoramento (inspeções) e registro de falhas/intervenções corretivas.
Front-end em HTML/CSS/JS puro (sem build) e banco de dados em uma
planilha do Google Sheets, acessada por uma API feita em Google Apps
Script.

## Estrutura do projeto

```
index.html          Tela de login
equipamentos.html    Lista/busca de equipamentos
cadastro.html        Ficha de cadastro do equipamento (preventivas,
                      monitoramento, histórico de falhas, impressão em PDF)
falhas.html           Formulário de registro de falha/corretiva
config.html           E-mails de alerta e usuários do sistema
css/styles.css         Estilo visual
js/api.js               Configuração da API + funções de acesso
js/auth.js, equipamentos.js, cadastro.js, falhas.js, config.js
apps-script/Code.gs     Backend (cola no editor do Apps Script)
```

## Passo 1 — Criar a planilha (banco de dados)

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma
   planilha em branco. Dê um nome, por exemplo **"BD - Manutenção
   Industrial"**.
2. No menu, vá em **Extensões > Apps Script**.
3. Apague o conteúdo padrão do arquivo `Code.gs` do editor e cole todo
   o conteúdo do arquivo [`apps-script/Code.gs`](apps-script/Code.gs)
   deste projeto.
4. Salve (ícone de disquete ou Ctrl+S).

As abas da planilha (Equipamentos, Preventivas, Monitoramento, Falhas,
Usuarios, AlertaEmails, Sessoes) são criadas automaticamente na
primeira execução — não é preciso criá-las manualmente.

## Passo 2 — Publicar como Aplicativo da Web

1. No editor do Apps Script, clique em **Implantar > Nova implantação**.
2. Em "Tipo", escolha **Aplicativo da Web**.
3. Configure:
   - **Executar como:** Eu (sua conta)
   - **Quem pode acessar:** Qualquer pessoa
4. Clique em **Implantar**. Na primeira vez, o Google vai pedir para
   autorizar o script (é o seu próprio script, pode autorizar).
5. Copie a **URL do aplicativo da web** gerada (algo como
   `https://script.google.com/macros/s/AKfycb.../exec`).

> Sempre que você alterar o `Code.gs`, use **Implantar > Gerenciar
> implantações > editar (ícone de lápis) > Nova versão** para que as
> mudanças entrem em vigor na mesma URL.

## Passo 3 — Ativar o alerta diário por e-mail

1. Ainda no editor do Apps Script, no seletor de função (barra
   superior, ao lado de "Depurar"), escolha **criarGatilhoDiario**.
2. Clique em **Executar** uma única vez. Isso instala um gatilho que
   roda todos os dias às 7h e envia e-mail para os endereços
   cadastrados em Configurações quando algum equipamento tiver
   intervenção programada para o dia seguinte.

## Passo 4 — Configurar o front-end

1. Abra o arquivo [`js/api.js`](js/api.js) deste projeto.
2. Substitua o valor de `API_URL` pela URL copiada no Passo 2:

```js
const API_URL = 'https://script.google.com/macros/s/SEU_ID_AQUI/exec';
```

3. Salve o arquivo.

## Passo 5 — Testar localmente

Abra `index.html` diretamente no navegador (duplo clique) não é
recomendado, pois o navegador bloqueia algumas chamadas quando a
página é aberta como arquivo local. Sirva a pasta com um servidor
local simples. Se tiver Node.js instalado:

```bash
npx serve .
```

Se não tiver Node.js (ambiente Windows sem Node), use PowerShell:

```powershell
python -m http.server 8080
```

ou, na ausência de Python também, qualquer servidor estático simples
(por exemplo a extensão "Live Server" do VS Code) resolve.

Login inicial criado automaticamente:

- **Usuário:** `admin`
- **Senha:** `admin123`

Troque essa senha (ou crie outro usuário e desative o admin) na página
**Configurações** assim que possível — veja a seção Segurança abaixo.

## Passo 6 — Publicar o site

Como é um site 100% estático (HTML/CSS/JS), pode ser publicado em
qualquer hospedagem de arquivos estáticos, por exemplo:

- **GitHub Pages** (gratuito): suba este repositório para o GitHub e
  ative o Pages nas configurações do repositório.
- **Netlify / Vercel**: arraste a pasta do projeto ou conecte o
  repositório Git.
- **Google Sites / Drive**: também é possível, mas GitHub Pages/Netlify
  dão uma URL mais limpa e HTTPS por padrão.

Não é necessário nenhum backend próprio: toda a lógica de dados roda
no Google Apps Script.

## Como usar

- **Equipamentos**: lista todos os equipamentos, com busca por nome ou
  ID e indicação visual (verde/amarelo/vermelho) da proximidade da
  próxima intervenção.
- **+ Novo equipamento**: cria o cadastro (ID gerado automaticamente
  no formato `EQ-0001`). Depois de salvo, ficam disponíveis as tabelas
  de preventivas e monitoramento e o botão de impressão.
- **Ficha do equipamento**: mostra nome, descrição, local, tabela de
  preventivas (o que + periodicidade), tabela de monitoramento (data,
  responsável, horímetro, observações) e histórico de falhas. O botão
  **"Gerar PDF / Imprimir ficha"** abre a caixa de impressão do
  navegador já formatada — escolha "Salvar como PDF" no destino da
  impressora para exportar o arquivo.
- **Registrar Falha**: busca o equipamento por nome ou ID, depois
  registra data, descrição e quem registrou. O registro aparece
  automaticamente no histórico da ficha do equipamento.
- **Configurações**: cadastro dos e-mails que recebem o alerta
  automático na véspera da manutenção programada, e cadastro/gestão
  dos usuários (nome + senha) que podem acessar o sistema.

## Segurança — leia com atenção

Este é um sistema interno simples, adequado para uma equipe pequena
que já confia entre si. Pontos a ter em mente:

- As senhas são transformadas em hash SHA-256 no navegador antes de
  serem enviadas e armazenadas na aba `Usuarios` — a senha em texto
  puro nunca é salva. Ainda assim, não é uma proteção de nível
  bancário (sem "salt"); não reutilize senhas importantes aqui.
- A URL do Apps Script (`API_URL`) fica visível no código-fonte do
  site (é inevitável em um site estático). Qualquer pessoa com essa
  URL só consegue fazer login se souber usuário e senha válidos — as
  demais ações exigem um token de sessão obtido no login.
- Troque a senha do usuário `admin` padrão assim que possível.
- Para revogar o acesso de alguém, desative o usuário em
  Configurações (o histórico de registros feitos por ele é mantido).

## Personalizações comuns

- **Horário do e-mail de alerta**: altere `.atHour(7)` em
  `criarGatilhoDiario()` no `Code.gs` e rode a função novamente.
- **Prazo do alerta** (hoje é "véspera"): ajuste a lógica em
  `verificarAlertasDiarios()`.
- **Cores/identidade visual**: edite as variáveis no topo de
  `css/styles.css`.
