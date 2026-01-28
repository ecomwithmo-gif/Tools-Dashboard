/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
