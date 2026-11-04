# OrçaPro — modelo de monetizacao (hibrido)

## Problema
Se a compra unica ja libera PDF ilimitado, a assinatura mensal **precisa vender outra coisa** (custo recorrente). AI (audio/foto → orcamento) tem custo de API: nao pode ser ilimitado no mes.

## Matriz final

| Plano | Preco | Orcamentos/PDF | Creditos IA / mes | Quem e pra |
|-------|-------|----------------|-------------------|------------|
| Free | R$ 0 | 3 / mes | 0 | Testar o fluxo |
| Permanente | R$ 29,90 **uma vez** | Ilimitado | 0 (pode comprar pacote) | Usa todo dia, sem AI |
| Pro IA Mensal | R$ 19,90 / mes | Ilimitado | **20** | Quer voz/foto no orcamento |
| Pro IA Anual | R$ 149,90 / ano (~R$ 12,49/mes) | Ilimitado | **20** / mes | Mesmo Pro, desconto |
| Pacote IA | R$ 9,90 **consumivel** | — | **+15** (nao expira no mes; consome sob demanda) | Free/Permanente que testa AI |

### O que conta como 1 credito IA
- 1 gravacao de audio → rascunho de orcamento, **ou**
- 1 foto de materiais/nota → itens sugeridos no orcamento

### O que NAO gasta credito
- Digitar orcamento na mao
- Gerar PDF / Pix / WhatsApp
- Maquininha / estatisticas

## Por que esses numeros
- Custo estimado por uso IA (Whisper/Vision + margem): ~R$ 0,30–0,50.
- 20 usos × R$ 0,40 ≈ R$ 8 de custo → sobra margem em R$ 19,90 apos taxa Play (~15%).
- Permanente barato ancora conversao; Pro IA e upsell claro.
- Pacote evita “all-you-can-eat” e atende quem nao quer assinatura.

## SKUs Play Console

| SKU | Tipo | Preco |
|-----|------|-------|
| `orcapro_pro_lifetime` | Nao consumivel | R$ 29,90 |
| `orcapro_pro_ia_mensal` | Assinatura | R$ 19,90/mes |
| `orcapro_pro_ia_anual` | Assinatura | R$ 149,90/ano |
| `orcapro_ia_pack_15` | Consumivel | R$ 9,90 |

> SKUs antigos `orcapro_pro_mensal` / `orcapro_pro_anual` (R$ 14,90 / 119,90) ficam **deprecated** no codigo — migrar Console para os novos `*_ia_*` antes do launch.

## Regras de entitlement
1. `podeGerarOrcamentoIlimitado` = lifetime **OU** assinatura IA ativa **OU** (free com cota).
2. `podeUsarIA` = assinatura IA com credito restante **OU** saldo de pacote > 0.
3. Creditos da assinatura **resetam todo mes** (YYYY-MM); pacote e saldo acumulado ate zerar.
4. Sem server: contadores no SecureStore (soft). Com server depois: validar receipt + debitar credito.

## UX paywall (ordem)
1. Permanente — “PDF e orcamentos ilimitados”
2. Pro IA Mensal — “Ilimitado + 20x voz/foto por IA”
3. Pro IA Anual — badge economia
4. Pacote 15 creditos — secundario / na tela de IA

## Faseamento
- **v1 (agora):** UI voz/foto + rascunho **MOCK** em `AssistenteIA` / `ia-rascunho.js`. 1 demo gratis/instalacao; depois exige credito.
- **v1.1:** trocar `gerarRascunhoIa` por Whisper/Vision reais (backend).
- Paywall ja vende Pro IA + pacote; so ative cobranca no Console quando mock for aceitavel ou API estiver pronta.

Nao venda Pro IA como “IA real” enquanto o pipeline for mock — copy do paywall/assistente diz “demo”.

## Alternativa se AI atrasar
Assinatura mensal temporaria = permanente com “cloud backup / sync” — so faca se tiver backend. Sem backend, **nao invente feature fantasma**.
