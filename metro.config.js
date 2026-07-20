const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// les migrations drizzle sont des fichiers .sql importés comme du source
config.resolver.sourceExts.push('sql');

module.exports = config;
