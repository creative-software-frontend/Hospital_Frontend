import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy every /api request to the Node/Express backend so the browser talks
  // same-origin to Next.js. The backend's HTTP-only auth cookie (hms_token) is
  // then sent/received automatically without CORS or same-site friction.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
