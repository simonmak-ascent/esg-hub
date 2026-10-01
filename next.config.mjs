import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@simonmak-ascent/esg-hub-mcp"],
  reactStrictMode: true,
  outputFileTracingExcludes: {
    "*": [
      "node_modules/onnxruntime-node/**",
      "node_modules/@huggingface/transformers/**",
      "node_modules/sharp/**",
      "node_modules/@img/**",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
        pathname: '/vi/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  serverExternalPackages: [
    "onnxruntime-node",
    "sharp",
    "@huggingface/transformers",
    "@modelcontextprotocol/sdk",
  ],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Exclude native ONNX and transformers modules from the server bundle
      config.externals = config.externals || [];
      config.externals.push({
        "onnxruntime-node": "commonjs onnxruntime-node",
        "@huggingface/transformers": "commonjs @huggingface/transformers",
      });
    }
    // Handle WASM files for client-side @huggingface/transformers
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    };
    return config;
  },
};
export default withNextIntl(nextConfig);
