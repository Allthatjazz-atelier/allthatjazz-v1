/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/grid", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
