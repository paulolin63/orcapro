/**
 * Forca Google Play Billing Library >= 8.0.0 no react-native-iap.
 * O default do RNIap 12.16.x e 7.0.0 (bloqueado pelo Play Console).
 *
 * Tres camadas (qualquer uma basta; juntas evitam EAS/cache/prebuild):
 * 1) android/gradle.properties → RNIap_playBillingSdkVersion
 * 2) root build.gradle ext.playBillingSdkVersion (lido por getExtOrDefault)
 * 3) force resolution no app/build.gradle
 */
const {
  withGradleProperties,
  withProjectBuildGradle,
  withAppBuildGradle,
} = require('@expo/config-plugins');

const MARKER = 'orcapro-play-billing';

function withBillingVersion(config, billingVersion = '8.0.0') {
  const version = String(billingVersion || '8.0.0');

  config = withGradleProperties(config, (cfg) => {
    const properties = cfg.modResults;
    const targetKey = 'RNIap_playBillingSdkVersion';
    const existing = properties.find((p) => p.type === 'property' && p.key === targetKey);
    if (existing) {
      existing.value = version;
    } else {
      properties.push({ type: 'property', key: targetKey, value: version });
    }
    return cfg;
  });

  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      contents = contents.replace(
        /playBillingSdkVersion\s*=\s*["'][^"']+["']/,
        `playBillingSdkVersion = "${version}"`
      );
    } else if (/ext\s*\{/.test(contents)) {
      contents = contents.replace(
        /ext\s*\{/,
        `ext {\n        // ${MARKER}\n        playBillingSdkVersion = "${version}"`
      );
    } else {
      contents = contents.replace(
        /(buildscript\s*\{)/,
        `$1\n    // ${MARKER}\n    ext { playBillingSdkVersion = "${version}" }\n`
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    // So billing (Java). Redireciona billing-ktx → billing: ktx 8 exige Kotlin 2.1 (quebra Expo 52).
    const forceBlock = `
// ${MARKER}
configurations.all {
    resolutionStrategy {
        force "com.android.billingclient:billing:${version}"
        eachDependency { details ->
            if (details.requested.group == "com.android.billingclient" && details.requested.name == "billing-ktx") {
                details.useTarget("com.android.billingclient:billing:${version}")
                details.because("Expo 52: billing-ktx 8 needs Kotlin 2.1")
            }
        }
    }
}
`;
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) {
      // Rebuild block on re-prebuild
      contents = contents.replace(
        new RegExp(`// ${MARKER}[\\s\\S]*?^}\\n`, 'm'),
        forceBlock
      );
      if (!contents.includes(MARKER)) {
        contents = contents.trimEnd() + '\n' + forceBlock;
      }
    } else {
      contents = contents.trimEnd() + '\n' + forceBlock;
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withBillingVersion;
