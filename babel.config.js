module.exports = function (api) {
  api.cache(true)
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@screens':    './src/screens',
            '@services':   './src/services',
            '@store':      './src/store',
            '@types':      './src/types',
            '@constants':  './src/constants',
            '@utils':      './src/utils',
            '@components': './src/components',
            '@data':       './src/data',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
      ],
      'react-native-reanimated/plugin',
      // Remove todos os console.* em builds de produção (EAS build / expo export)
      ...(isProduction ? [['transform-remove-console', { exclude: [] }]] : []),
    ],
  }
}
