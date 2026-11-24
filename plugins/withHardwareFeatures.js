const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withHardwareFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest || cfg.modResults;
    manifest['uses-feature'] = manifest['uses-feature'] || [];

    const featuresToLoosen = [
      'android.hardware.screen.portrait',
      'android.hardware.screen.landscape',
      'android.hardware.camera',
      'android.hardware.camera.autofocus',
      'android.hardware.microphone',
    ];

    featuresToLoosen.forEach((featureName) => {
      let existing = manifest['uses-feature'].find(
        (f) => f && f.$ && f.$['android:name'] === featureName
      );

      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            'android:required': 'false',
          },
        });
      }
    });

    return cfg;
  });
};
