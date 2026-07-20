module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // permet d'importer les migrations .sql générées par drizzle-kit
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
