const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');

module.exports = (options, webpack) => {
  const lazyImports = [
    '@nestjs/microservices',
    '@nestjs/websockets',
    'class-validator',
    'class-transformer',
    'bcrypt',
    'passport',
    'passport-jwt',
    'passport-google-oauth20',
    'passport-apple',
    'passport-local',
    '@nestjs/passport',
    'multer',
    'multer-s3',
    'sharp',
    'tesseract.js',
    'speakeasy',
    'pdf-lib',
    'qrcode',
    'nodemailer',
    'winston',
    'winston-loki',
    'bull',
    'bullmq',
    '@nestjs/bull',
    '@nestjs/bullmq',
    '@nestjs/schedule',
    '@nestjs/throttler',
    '@nestjs/serve-static',
    '@prisma/client',
    'typeorm',
    '@nestjs/typeorm',
    'ioredis',
    '@nestjs-modules/ioredis',
    'socket.io',
    '@nestjs/platform-socket.io',
    '@nestjs/websockets',
    'facebook-nodejs-business-sdk',
    'instagram-graph-api',
    'tiktok-business-api-sdk-official',
    'twitter-api-v2',
    '@googleapis/youtube',
    'aws-sdk',
    'crypto-js',
    'decimal.js',
    'moment',
    'date-fns',
    'lodash',
    'uuid'
  ];

  return {
    ...options,
    mode: 'production',
    output: {
      ...options.output,
      filename: '[name].[contenthash].js',
      chunkFilename: '[name].[contenthash].js',
      clean: true,
    },
    externals: [
      ...options.externals,
      ({ request }, callback) => {
        // Don't externalize cache-manager packages
        if (request === 'cache-manager' || request === '@nestjs/cache-manager') {
          return callback();
        }
        if (lazyImports.includes(request)) {
          return callback(null, `commonjs ${request}`);
        }
        callback();
      },
    ],
    module: {
      ...options.module,
      rules: [
        ...options.module.rules,
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                happyPackMode: true,
                configFile: 'tsconfig.build.json',
                // Speed optimizations
                getCustomTransformers: () => ({
                  before: [],
                }),
                compilerOptions: {
                  module: 'commonjs',
                  target: 'ES2021',
                  noEmitOnError: false,
                  skipLibCheck: true,
                }
              }
            }
          ]
        }
      ]
    },
    resolve: {
      ...options.resolve,
      symlinks: false,
      extensions: ['.ts', '.js', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src/'),
      }
    },
    cache: {
      type: 'filesystem',
      cacheDirectory: path.resolve(__dirname, '.nest'),
      buildDependencies: {
        config: [__filename],
      },
      maxAge: 86400000, // 24 hours
      compression: 'gzip',
      idleTimeout: 60000,
      idleTimeoutForInitialStore: 0
    },
    optimization: {
      ...options.optimization,
      minimize: true,
      minimizer: [
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            compress: {
              drop_console: false,
              drop_debugger: true,
            },
            mangle: false, // Keep function names for debugging
          },
        }),
      ],
      splitChunks: {
        chunks: 'all',
        maxSize: 244000,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors-[contenthash]',
            chunks: 'all',
            priority: 10,
          },
          common: {
            name: 'common-[contenthash]',
            minChunks: 2,
            chunks: 'all',
            priority: 5,
          },
        },
      },
      moduleIds: 'deterministic',
      runtimeChunk: {
        name: 'runtime-[contenthash]'
      },
      chunkIds: 'deterministic',
    },
    target: 'node',
    node: {
      __dirname: false,
      __filename: false,
    },
    plugins: [
      ...options.plugins,
      new CircularDependencyPlugin({
        // exclude detection of files based on a RegExp
        exclude: /node_modules/,
        // include specific files based on a RegExp
        include: /src/,
        // add errors to webpack instead of warnings
        failOnError: false,
        // allow import cycles that include an asyncronous import,
        // e.g. via import(/* webpackMode: "weak" */ './file.js')
        allowAsyncCycles: false,
        // set the current working directory for displaying module paths
        cwd: process.cwd(),
      }),
      new webpack.IgnorePlugin({
        checkResource(resource) {
          // Don't ignore cache-manager as it's a required dependency
          if (resource === 'cache-manager') return false;
          return lazyImports.includes(resource);
        },
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      }),
    ],
    stats: {
      colors: true,
      modules: true, // Changed to true temporarily to see which modules are causing issues
      children: false,
      chunks: false,
      chunkModules: false,
    },
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
};