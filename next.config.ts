import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  distDir: 'out',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      // Add other image hostnames if needed, e.g., Firebase Storage
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
        port: '',
        pathname: '/**',
      }
    ],
    // Allow data URIs for image previews
    dangerouslyAllowSVG: true, // if you use SVGs as data URIs
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;", // Example, adjust as needed
    // This allows all domains, use with caution or specify domains.
    // For data URIs, this might not be necessary as they are self-contained.
    // domains: ['*'], // Not recommended for production for remotePatterns
  },
};

export default nextConfig;
