import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ['react-map-gl', '@mapbox/mapbox-gl-draw'],
};

export default nextConfig;
