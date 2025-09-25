import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  webpack: config => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      bufferutil: 'commonjs bufferutil',
    });

    // Exclude Supabase functions from webpack compilation
    config.module.rules.push({
      test: /supabase\/functions\/.*\.ts$/,
      use: 'ignore-loader',
    });

    return config;
  },
  images: {
    remotePatterns: [new URL('https://cdn.discordapp.com/avatars/**')],
  },
  // Exclude Supabase folder from TypeScript compilation
  typescript: {
    ignoreBuildErrors: false,
  },
  // Exclude Supabase folder from ESLint
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'app'],
  },
};

export default nextConfig;
