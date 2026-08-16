const { withGradleProperties } = require('@expo/config-plugins');

module.exports = function withCoreFeatures(config) {
  return withGradleProperties(config, (cfg) => {
    const yaExiste = cfg.modResults.some(
      (p) => p.type === 'property' && p.key === 'coreFeatures',
    );
    if (!yaExiste) {
      cfg.modResults.push({
        type: 'property',
        key: 'coreFeatures',
        value: 'compose',
      });
    }
    return cfg;
  });
};