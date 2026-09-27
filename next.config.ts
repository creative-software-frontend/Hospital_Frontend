import type { NextConfig } from "next";

// Server-side only: this is the rewrite destination, never exposed to the
// browser. Override with BACKEND_URL when the API is not on localhost:5000
// (a different host in staging, or a tunnel in review deployments).
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:5000";

const nextConfig: NextConfig = {
  // Proxy every /api request to the Node/Express backend so the browser talks
  // same-origin to Next.js. The backend's HTTP-only auth cookie (hms_token) is
  // then sent/received automatically without CORS or same-site friction.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
