const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function(options, webpack) {
  return {
    ...options,
    entry: ['./src/main.ts'],
    target: 'node',
    externals: [
      nodeExternals({
        allowlist: []
      })
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          loader: 'ts-loader',
          options: {
            transpileOnly: true,
            happyPackMode: false,
            configFile: 'tsconfig.build.json'
          }
        }
      ]
    },
    resolve: {
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src')
      }
    },
    optimization: {
      minimize: false,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false
    },
    performance: {
      hints: false
    },
    cache: {
      type: 'filesystem',
      compression: 'gzip'
    }
  };
};
