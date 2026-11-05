# OrçaPro — checklist Play Store

Atualizado apos smoke + expo-doctor + Metro Android export.

## Automatizado (ja passou nesta maquina)

- [x] `npm run test:smoke` — Pix, calculos, QR, SKUs, telas
- [x] `npx expo-doctor` — 18/18
- [x] `npx expo export --platform android` — bundle OK (1181 modules)
- [x] Rota `calculadora-maquininha` criada
- [x] Permissoes legadas bloqueadas (storage + RECORD_AUDIO)
- [x] Icon 512x512 / splash 1080x1920
- [x] Hybrid IAP SKUs no codigo: lifetime / mensal / anual

## Bloqueado sem a sua conta (nao da pra fazer daqui)

- [ ] `eas login` (hoje: **Not logged in**)
- [ ] `eas init` / projectId no `app.json`
- [ ] `eas build --platform android --profile production` → `.aab`
- [ ] Privacy Policy em URL **HTTPS publica** (arquivo local: `privacy-policy.html`)
- [ ] Google Play Console: app `com.orcapro.myapp`
- [ ] Criar produtos (ver `MONETIZACAO.md`):
  - `orcapro_pro_lifetime` (R$ 29,90, nao consumivel) — PDF ilimitado
  - `orcapro_pro_ia_mensal` (R$ 19,90/mes) — ilimitado + 20 IA
  - `orcapro_pro_ia_anual` (R$ 149,90/ano)
  - `orcapro_ia_pack_15` (R$ 9,90, consumivel) — +15 creditos IA
  - Nao lance cobranca de IA antes do feature voz/foto existir
- [ ] License testers: comprar + restaurar no aparelho (dev/preview build)
- [ ] Closed Testing: 20 testers x 14 dias
- [ ] Data Safety alinhado ao guia (Device ID local + Play Billing)
- [ ] Screenshots da loja (telefone)
- [ ] Conteudo classificado 18+ / Business ou Tools (nao Finances)

## Comandos na sua maquina

```bash
cd orcapro
npm install
npm run test:smoke
npx expo-doctor

# conta Expo
npx eas-cli login
npx eas-cli init
# cole a privacy URL HTTPS em Play Console > Store listing

# build de teste interna (APK)
npm run build:preview

# build loja (.aab)
npm run build:android
```

## Teste manual obrigatorio no aparelho (preview/dev client)

1. Abrir app → criar 3 orcamentos → 4o abre paywall
2. Airplane mode apos Pro cache → ainda Pro
3. Config Pix telefone `11999998888` → vira `+5511999998888`
4. PDF com QR; banco escaneia
5. Lifetime / restore com license tester
6. Logo via image picker
7. Calculadora maquininha no header
8. Estatisticas / detalhe / excluir orcamento

## Nao testavel 100% offline / sem Play

- Google Play Billing real
- Assinatura renovacao / cancelamento
- Review humano do Google
