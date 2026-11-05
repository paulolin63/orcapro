/**
 * Garante Billing Library 8.x no react-native-iap apos npm install (EAS incluso).
 * Usa `billing` (Java) em vez de `billing-ktx` — ktx 8 exige Kotlin 2.1 e quebra Expo SDK 52.
 * Complementa plugins/withBillingVersion.js + patch-rniap-billing8.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '8.0.0';

const propsPath = path.join(root, 'node_modules/react-native-iap/android/gradle.properties');
const gradlePath = path.join(root, 'node_modules/react-native-iap/android/build.gradle');

if (!fs.existsSync(propsPath)) {
  console.warn('[patch-billing] react-native-iap ainda nao instalado — skip');
  process.exit(0);
}

let props = fs.readFileSync(propsPath, 'utf8');
const nextProps = props.replace(
  /RNIap_playBillingSdkVersion=.*/g,
  `RNIap_playBillingSdkVersion=${VERSION}`
);
if (!nextProps.includes(`RNIap_playBillingSdkVersion=${VERSION}`)) {
  console.error('[patch-billing] falhou ao setar versao');
  process.exit(1);
}
if (nextProps !== props) {
  fs.writeFileSync(propsPath, nextProps);
  console.log(`[patch-billing] RNIap_playBillingSdkVersion=${VERSION}`);
} else {
  console.log(`[patch-billing] ja em ${VERSION}`);
}

if (fs.existsSync(gradlePath)) {
  let gradle = fs.readFileSync(gradlePath, 'utf8');
  // billing-ktx 8.x = Kotlin 2.1 metadata → conflit com Expo 52 (Kotlin 1.9)
  const swapped = gradle.replace(
    /playImplementation\s+"com\.android\.billingclient:billing-ktx:\$playBillingSdkVersion"/,
    'playImplementation "com.android.billingclient:billing:$playBillingSdkVersion"'
  );
  if (swapped === gradle && !gradle.includes('com.android.billingclient:billing:$playBillingSdkVersion')) {
    console.error('[patch-billing] nao encontrou dependencia billing-ktx/billing no build.gradle');
    process.exit(1);
  }
  if (swapped !== gradle) {
    fs.writeFileSync(gradlePath, swapped);
    console.log('[patch-billing] billing-ktx → billing (compat Expo 52 / Kotlin 1.9)');
  } else {
    console.log('[patch-billing] ja usando artifact billing (sem ktx)');
  }
}
