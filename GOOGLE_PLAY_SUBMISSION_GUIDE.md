# Guia de Publicação e Homologação — Google Play Store (2026)
> **Projeto:** OrçaPro (v1.0.0)  
> **Package ID:** `com.orcapro.myapp`  
> **Status:** Pronto para Build e Submissão ao Teste Fechado (20 Usuários × 14 Dias)

---

## 1. Dados da Ficha da Loja (Store Listing) — Português (Brasil)

### Nome do Aplicativo (Máx. 30 caracteres)
```
OrçaPro: Orçamento & PDF Pix
```

### Breve Descrição (Máx. 80 caracteres)
```
Crie orçamentos profissionais em PDF com Pix e envie no WhatsApp em 1 minuto.
```

### Descrição Completa (Store Description)
```text
Cansado de mandar orçamento digitado no WhatsApp e perder clientes?

O OrçaPro foi feito sob medida para técnicos de ar condicionado, eletricistas, encanadores, pintores, marceneiros e prestadores de serviços autônomos que querem fechar mais trabalhos e nunca mais tomar prejuízo.

Com o OrçaPro, você calcula custos de materiais, mão de obra, deslocamento e a sua margem de lucro real. Em segundos, o app gera uma proposta comercial em PDF com o seu logotipo e o QR Code do Pix para pagamento imediato!

🔧 RECURSOS PRINCIPAIS:
• Cálculo Automático de Lucro: Garanta que você nunca vai pagar para trabalhar.
• Calculadora Reversa de Maquininha: O cliente quer parcelar no cartão? O OrçaPro calcula na hora quanto cobrar para você receber o valor líquido integral na sua conta.
• PDF Profissional Pronto para WhatsApp: Envie uma proposta visual limpa com termo de garantia legal de 90 dias (conforme art. 26 do CDC).
• Pagamento com Pix: Chave Pix em texto para copiar e QR Code gerado para o cliente escanear e pagar.
• Histórico e Status: Acompanhe seus orçamentos em aberto, fechados ou recusados.
• Funciona 100% Offline: Sem necessidade de internet para calcular ou criar orçamentos.

🔒 PRIVACIDADE TOTAL (LOCAL-FIRST):
Seus dados de orçamento ficam na memória do seu telefone (SQLite). Não vendemos dados seus ou dos seus clientes. Pagamentos Pro são processados pelo Google Play.

Experimente gratuitamente e profissionalize o seu negócio hoje mesmo!
```

---

## 2. Configuração de Categoria e Declarações Críticas (Anti-Rejeição)

| Configuração no Console | Valor Recomendado | Motivo Crucial |
|---|---|---|
| **Categoria do App** | **Empresas (Business)** ou **Ferramentas (Tools)** | ⚠️ **NUNCA selecione "Finanças"**. Aplicativos de finanças exigem licenças bancárias e passam por filtros anti-fraude severos. |
| **Declaração de Empréstimos (Personal Loans)** | **"O app não fornece serviços financeiros nem empréstimos"** | O Google Play bloqueia sumariamente apps que calculam juros sem licença. Nosso app é de orçamento operacional. |
| **Público-Alvo** | **18 anos ou mais** | Evita exigências rigorosas da política infantil (Família/COPPA). |
| **Anúncios** | **"Não, meu app não contém anúncios"** | Evita auditoria de redes de ad. |

---

## 3. Seguranca dos Dados (Data Safety Form)

Arquitetura local-first, mas o formulario Data Safety deve refletir o codigo real:

* **Coleta dados?** Sim — de forma limitada e local / via Google Play.
* **Device or other IDs:** Android ID lido no aparelho para namespacing da cota free (nao enviado a servidor nosso). Finalidade: App functionality. Nao compartilhado com terceiros (exceto Google Play Billing).
* **Purchase history:** Google Play Billing (assinatura / IAP). Processado pela Google LLC.
* **Dados de orcamento/clientes:** ficam so no SQLite local — nao declare como coletados por nos se nao saem do device.
* Nao marque "Nao coleta nem compartilha" de forma absoluta: isso conflita com Device ID + Billing.

---

## 4. Cadastro de Produtos (ver MONETIZACAO.md)

Apos o primeiro `.aab` no teste fechado:

### A) In-app products
| SKU | Tipo | Preco | Entrega |
|-----|------|-------|---------|
| `orcapro_pro_lifetime` | Nao consumivel | R$ 29,90 | PDF/orcamentos ilimitados |
| `orcapro_ia_pack_15` | Consumivel | R$ 9,90 | +15 creditos voz/foto IA |

### B) Assinaturas Pro IA
| SKU | Ciclo | Preco | Entrega |
|-----|-------|-------|----------|
| `orcapro_pro_ia_mensal` | Mensal | R$ 19,90 | Ilimitado + 20 creditos IA/mes |
| `orcapro_pro_ia_anual` | Anual | R$ 149,90 | Idem (~R$ 12,49/mes) |

Free: 3 orcamentos/mes. **Nao cobre IA sem o feature pronto** — se AI ainda nao existe no app, venda so o lifetime no launch.

---

## 5. Estratégia dos 20 Usuários de Teste por 14 Dias (Regra 2026)

Desde 2023/2024, contas individuais no Google Play Console só podem liberar o botão **"Produção (Publicar Aberto)"** se cumprirem:
* **Mínimo de 20 pessoas** inscritas no Teste Fechado (Closed Testing).
* Todos os 20 instalarem o app e **permanecerem opt-in por 14 dias ininterruptos**.

### Como você vai contratar o serviço pago de testes:
Existem serviços especializados confiáveis para desenvolvedores solo:
1. **20testers.com** (aprox. $15–$25 USD)
2. **Fiverr** (Pesquise por: *"20 testers 14 days Google Play closed test"*, escolha profissionais com mais de 100 avaliações 5 estrelas).

### Como configurar no Console:
1. No menu lateral, clique em **Versão** ➔ **Teste** ➔ **Teste Fechado (Closed Testing)**.
2. Crie uma faixa chamada `Teste Fechado Alpha`.
3. Na aba **Testadores**, selecione **Grupos do Google (Google Groups)** ou adicione a lista de 20 e-mails fornecida pelo prestador de serviços.
4. O prestador fará os 20 aparelhos baixarem o link de teste da Play Store e abrirem o app diariamente.
5. **No 15º dia**, o Google Play Console liberará o formulário: **"Solicitar acesso à Produção"**. Você preenche 3 perguntas simples ("O que você corrigiu com o feedback?") e o app vai para a loja pública!

---

## 6. Como Gerar o Arquivo `.aab` para Envio (EAS Build Gratuito)

Você pode compilar o pacote de produção direto nas nuvens da Expo (grátis), sem precisar configurar o Android Studio pesado na sua máquina:

```bash
# 1. Acesse a pasta do projeto
cd /Users/paulolin/.gemini/antigravity/scratch/orcapro

# 2. Faça o login na sua conta Expo (crie gratuitamente em expo.dev se não tiver)
npx eas login

# 3. Configure o projeto uma única vez
npx eas build:configure

# 4. Inicie a compilação do Android App Bundle (.aab)
npx eas build --platform android --profile production
```

Ao final, o terminal te entregará um link direto para baixar o arquivo `orcapro-v1.0.0.aab`. Esse é o arquivo que você sobe no Google Play Console!
