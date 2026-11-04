# OrçaPro — Como Rodar o Projeto

## Pré-requisitos

Instale uma vez só:

```bash
# Node.js (para o app)
# Baixe em: https://nodejs.org  (versão LTS)

# Expo CLI
npm install -g expo-cli eas-cli

# PHP (para o backend — você já deve ter)
# Composer (gerenciador de pacotes PHP)
# Baixe em: https://getcomposer.org
```

---

## App (React Native / Expo)

```bash
cd orcapro/

# Instala as dependências (primeira vez)
npm install

# Roda no celular Android via cabo ou Wi-Fi
npm run android

# Ou abre o QR Code para escanear com o app Expo Go
npm start
```

**Testando no celular sem cabo:**
1. Instale o app **Expo Go** no Android (Play Store)
2. Rode `npm start` no PC
3. Escaneie o QR Code com o Expo Go

---

## Backend PHP (opcional para MVP)

```bash
cd orcapro/backend-php/

# Instala DOMPDF e biblioteca de QR Code
composer install

# Testa a geração do payload Pix no terminal
php pix.php

# Roda um servidor local de teste
php -S localhost:8080
```

---

## Estrutura do Projeto

```
orcapro/
├── app/                        ← Telas do app (Expo Router)
│   ├── _layout.js              ← Layout base (navegação + tema)
│   ├── index.js                ← Lista de orçamentos (home)
│   ├── novo-orcamento.js       ← Formulário de novo orçamento
│   ├── configuracoes.js        ← Logo, nome, chave Pix
│   ├── estatisticas.js         ← (TODO) estatísticas do mês
│   └── calculadora-maquininha.js ← (TODO) calculadora isolada
│
├── src/                        ← Lógica de negócio (sem tela)
│   ├── banco-de-dados.js       ← SQLite — todo o acesso ao banco
│   ├── calculos.js             ← Matemática de custo/lucro/maquininha
│   ├── pix.js                  ← Geração do payload Pix BR Code
│   └── pdf.js                  ← Geração de PDF + compartilhamento
│
├── backend-php/                ← Backend PHP (opcional)
│   ├── pix.php                 ← Mesma lógica Pix em PHP
│   ├── pdf.php                 ← PDF server-side com DOMPDF
│   └── composer.json           ← Dependências PHP
│
├── assets/                     ← Ícones e splash screen
├── package.json                ← Dependências JavaScript
└── app.json                    ← Configuração do Expo/Android
```

---

## Analogia PHP → JavaScript (para você não se perder)

| PHP                                      | JavaScript (aqui)                          |
|------------------------------------------|--------------------------------------------|
| `echo`                                   | `console.log()`                           |
| `$variavel = valor`                      | `const variavel = valor`                  |
| `$array[] = item`                        | `array.push(item)`                        |
| `foreach ($arr as $item)`               | `for (const item of arr)` ou `.map()`     |
| `function nome($a, $b) {}`              | `function nome(a, b) {}`                  |
| `$pdo->query($sql)`                      | `db.getAllAsync(sql)`                      |
| `json_decode($str, true)`               | `JSON.parse(str)`                         |
| `json_encode($arr)`                     | `JSON.stringify(arr)`                     |
| `number_format($v, 2, ',', '.')`        | `v.toLocaleString('pt-BR', {minimumFractionDigits:2})` |
| `htmlspecialchars($str)`                | função `escapar()` em pdf.js              |
| `header('Location: pagina.php')`        | `router.push('/pagina')`                  |
| `$_POST['campo']`                       | `useState` + `onChangeText`               |
| `require 'arquivo.php'`                 | `import { funcao } from './arquivo'`      |

---

## Próximos passos

- [ ] Tela `estatisticas.js` — copiar padrão do index.js
- [ ] Tela `detalhe-orcamento.js` — ver + atualizar status + reenviar PDF
- [ ] Adicionar `react-native-qrcode-svg` para gerar QR Code Pix **offline** no app
- [ ] Configurar EAS Build para gerar o APK para o Google Play
- [ ] Adicionar 20 usuários de teste para passar pela política do Google Play
