/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for @ffmpeg/ffmpeg and @ffmpeg/util
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'fs': false,
      'path': false,
      'os': false,
      'crypto': false,
    };

    // Necessary for FFmpeg WASM to work
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    // Support for WebAssembly
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });

    // Fix for dynamic imports
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];

    // Output more verbose webpack errors
    config.infrastructureLogging = {
      level: 'error',
    };

    return config;
  },
  // Add headers for cross-origin isolation (needed for SharedArrayBuffer)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  // Disable strict mode temporarily to avoid double mounting issues with FFmpeg
  reactStrictMode: false,
};

module.exports = nextConfig;
