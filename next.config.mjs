/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb"
    }
  },
  images: {
    remotePatterns: []
  }
};

export default nextConfig;
