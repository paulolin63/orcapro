# Closed Testing — destravar upload (Play Console)

## Erro que voce viu (versionCode 2)

> Sua aplicacao atualmente usa Google Play Billing Library **7.0.0**, mas e preciso **>= 8.0.0**.

### Causa
`react-native-iap@12.16.4` defaulta `RNIap_playBillingSdkVersion=7.0.0`.

### Correcao (ja no codigo)
1. Plugin: [`plugins/withBillingVersion.js`](plugins/withBillingVersion.js) força `billing:8.0.0` e redireciona `billing-ktx` → `billing`
2. `postinstall`: [`scripts/patch-billing-version.mjs`](scripts/patch-billing-version.mjs) + [`scripts/patch-rniap-billing8.mjs`](scripts/patch-rniap-billing8.mjs)
3. **Nao** forcar Kotlin 2.1 no Expo 52 (quebra `KotlinTopLevelExtension`). Usar artifact `billing` (Java), nao `billing-ktx`
4. `versionCode` **3** em [`app.json`](app.json)
5. Local: `./scripts/with-java17.sh eas build --platform android --profile production --local`

### Rebuild e reenvio
```bash
cd orcapro
npm install
npm run test:smoke
# confira: PASS rniap billing sdk 8.0.0

npx eas-cli login
npx eas-cli build --platform android --profile production --clear-cache
```
Suba o **novo** `.aab` (versionCode **3**) no Closed Testing. Nao reenvie o AAB antigo do code 2.

---

## Checklist Console (antes do Roll out)

### 1. Privacy Policy HTTPS
- Arquivo pronto: `privacy-policy.html` / `docs/index.html` (com secao Gemini)
- Hospede (ver `docs/HOST_PRIVACY.md`) e cole a URL em Store listing + Data safety

### 2. Ficha da loja
- [x] Icon 512 + feature graphic 1024x500 em `assets/`
- [ ] >= 2 screenshots de telefone
- [ ] Nome / short / full description (`GOOGLE_PLAY_SUBMISSION_GUIDE.md`)
- [ ] Categoria: **Business** ou **Tools** (NUNCA Finances)

### 3. App content
- [ ] Data safety: Device ID (cota) + Purchase history; audio/fotos so se Pro IA on
- [ ] Content rating
- [ ] Target audience 18+
- [ ] Ads = No
- [ ] Personal loans = app nao oferece empréstimos/servicos financeiros

### 4. Closed testing track
1. Create release com AAB versionCode 3
2. Paises
3. Pelo menos **1 tester** (seu Gmail ou Google Group)
4. **Roll out** / enviar para revisao

### 5. Nao confundir com Producao
20 testers x 14 dias liberam **Producao**, nao o Closed Testing.

### 6. Credenciais
Nunca zipar `.jks`. Use EAS Credentials (`docs/CREDENTIALS.md`).

---

## Monetizacao no launch
- Paywall: so **Permanente** (Pro IA flag off — `FEATURE_PRO_IA=false`)
- Lifetime inclui modelos reutilizaveis + PDF sem marca Free
- Quando API propria existir: `FEATURE_PRO_IA=true` e ative SKUs `*_ia_*` no Console
