# Credenciais Android (EAS) — NUNCA no git

O keystore `.jks` **nao** deve ficar no repositorio nem em zips compartilhados.

## Fluxo correto

```bash
npx eas-cli login
npx eas-cli credentials
# Android > production > Keystore: gerenciado pela Expo (recomendado)
```

Ou configure upload key no Play Console / EAS e deixe a Expo assinar builds.

## Se um `.jks` vazou em zip/Telegram

1. Confirme se o Play App Signing esta ativo (Console > App integrity).
2. Com App Signing da Google: a upload key pode ser resetada no Console.
3. Sem App Signing: trate a chave como comprometida e planeje app novo / suporte Google.
4. Remova o arquivo de qualquer pasta compartilhada e regenere via EAS.
