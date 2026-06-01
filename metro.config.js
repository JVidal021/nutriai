// Metro config — estende o padrão do Expo.
// Garante comportamento previsível e suporte a assets/JSON (i18n).
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

module.exports = config
