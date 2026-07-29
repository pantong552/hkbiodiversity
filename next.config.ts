import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/bgis-api/:path*',
        destination: 'https://bih.gov.hk/BGIS/API/:path*',
      },
      {
        source: '/ebird-api/:path*',
        destination: 'https://ebird.org/:path*',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'inaturalist-open-data.s3.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '*.inaturalist.org',
      }
    ],
    localPatterns: [
      {
        pathname: '/api/image/transform',
        search: '',
      },
    ],
  },
};

export default nextConfig;
