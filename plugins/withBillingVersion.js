const { withProjectBuildGradle, withAppBuildGradle } = require('@expo/config-plugins');

function withBillingVersion(config, billingVersion = '8.0.0') {
  // 1. Force globally via allprojects in root build.gradle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const code = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force "com.android.billingclient:billing:${billingVersion}"
            force "com.android.billingclient:billing-ktx:${billingVersion}"
        }
    }
}
`;
      if (!config.modResults.contents.includes('com.android.billingclient:billing')) {
        config.modResults.contents += code;
      }
    }
    return config;
  });

  // 2. Add implementation to app/build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      const depCode = `
dependencies {
    implementation "com.android.billingclient:billing:${billingVersion}"
    implementation "com.android.billingclient:billing-ktx:${billingVersion}"
}
`;
      if (!config.modResults.contents.includes(`com.android.billingclient:billing:${billingVersion}`)) {
        config.modResults.contents += depCode;
      }
    }
    return config;
  });

  return config;
}

module.exports = withBillingVersion;
