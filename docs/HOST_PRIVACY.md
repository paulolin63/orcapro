# Hospedar Privacy Policy em HTTPS (obrigatorio Play Store)

O arquivo local `privacy-policy.html` (e `docs/index.html`) precisa de uma URL **https://** publica.

## Opcao rapida: GitHub Pages

1. Crie um repo publico (ex.: `orcapro-privacy`) so com `index.html` (= copia de `docs/index.html`).
2. Settings > Pages > Deploy from branch `main` / root.
3. URL tipica: `https://SEU_USER.github.io/orcapro-privacy/`
4. Cole essa URL em:
   - Play Console > Store listing > Privacy policy
   - Play Console > App content > Data safety > Privacy policy

## Opcao: Firebase Hosting / Netlify / Cloudflare Pages

Suba a pasta `docs/` (com `index.html`). Use a URL HTTPS gerada.

## Data Safety (alinhar ao codigo)

Marque / declare:
- **Device or other IDs** — Android ID local para cota free (App functionality). Nao compartilhado com terceiros nossos.
- **Purchase history** — Google Play Billing.
- Se `FEATURE_PRO_IA` estiver on e Gemini ativo: **Audio / Photos** processados pela Google LLC (ver secao 6 da policy).
- Dados de orcamento/clientes: **nao coletados por nos** (ficam no SQLite local).

Nao marque "Nao coleta nem compartilha" de forma absoluta.
