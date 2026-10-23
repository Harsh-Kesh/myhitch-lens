import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev overlay badge that overlaps the sidebar footer.
  devIndicators: false,
  // Reads Word files with Node APIs; keep it out of the bundle.
  serverExternalPackages: ["mammoth"],
};

export default nextConfig;
