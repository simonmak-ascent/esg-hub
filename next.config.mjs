import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Behind the ALB + Caddy the standalone server otherwise builds request URLs
  // from the socket address (localhost:3210), so next-intl's "/" -> "/en"
  // rewrite becomes an absolute self-proxy and the default locale loops.
  experimental: {
    trustHostHeader: true,
  },
  transpilePackages: ["@simonmak-ascent/esg-hub-mcp"],
  reactStrictMode: true,
  async redirects() {
    // The regulations section has five regional guides but no hub page, and
    // four content pages link to /regulations/ (nightly lychee: 404). Send
    // readers to the contents index, which lists the section, until a real
    // hub page exists.
    return [
      { source: "/regulations", destination: "/contents", permanent: false },
      { source: "/regulations/", destination: "/contents", permanent: false },
      {
        source: "/:locale(en|zh|hi|hk)/regulations",
        destination: "/:locale/contents",
        permanent: false,
      },
    ];
  },
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
