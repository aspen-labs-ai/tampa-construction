import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow client-side fetches to ArcGIS and OpenFreeMap
  async headers() {
    return [];
  },
};

export default nextConfig;
