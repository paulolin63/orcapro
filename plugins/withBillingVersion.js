const { withGradleProperties } = require('@expo/config-plugins');

function withBillingVersion(config, billingVersion = '8.0.0') {
  return withGradleProperties(config, (config) => {
    const properties = config.modResults;
    const targetKey = 'RNIap_playBillingSdkVersion';
    const existing = properties.find((p) => p.key === targetKey);

    if (existing) {
      existing.value = billingVersion;
    } else {
      properties.push({
        type: 'property',
        key: targetKey,
        value: billingVersion,
      });
    }

    return config;
  });
}

module.exports = withBillingVersion;
