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
      {
        source: '/inat-s3/:path*',
        destination: 'https://inaturalist-open-data.s3.amazonaws.com/:path*',
      },
      {
        source: '/inat-static/:path*',
        destination: 'https://static.inaturalist.org/:path*',
      },
      {
        source: '/inat-uploads/:path*',
        destination: 'https://uploads.inaturalist.org/:path*',
      },
      {
        source: '/cloudinary/:path*',
        destination: 'https://res.cloudinary.com/:path*',
      },
      {
        source: '/plantnet-img/:path*',
        destination: 'https://my-plantnet.s3.amazonaws.com/:path*',
      },
      {
        source: '/plantnet-bs/:path*',
        destination: 'https://bs.plantnet.org/:path*',
      },
      {
        source: '/freeimage-host/:path*',
        destination: 'https://i.freeimage.host/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/cloudinary/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
          {
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
      {
        source: '/inat-s3/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        source: '/inat-static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        source: '/inat-uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        source: '/plantnet-img/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        source: '/plantnet-bs/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        source: '/freeimage-host/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        ],
      },
      {
        source: '/logo/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/site.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, must-revalidate',
          },
        ],
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
