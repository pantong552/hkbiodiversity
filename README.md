This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## LandsD Vector Basemap

Set the server-side `HKMAPSERVICE_API_KEY` environment variable in `.env.local` for local development and in the deployment environment. Keep the key out of client-side code and source control; LandsD label tiles and glyphs are fetched through server routes.

## Offline routing

The map's routing panel can download Hong Kong's OpenStreetMap road network and AWS Terrain Tiles elevation data, then keep both in the browser's IndexedDB. Once downloaded, walking and cycling routes and their elevation profiles are calculated locally in a Web Worker; enabling offline routing does not send route waypoints to the online GraphHopper service. The first download requires an internet connection and available browser storage. The panel can update the saved network, and transient download errors are retried automatically. Offline route results may differ from GraphHopper, and map tiles are not included in the routing dataset.

OpenStreetMap data is provided by the Overpass API and is available under the [OpenStreetMap attribution requirements](https://www.openstreetmap.org/copyright).
Elevation data is provided by [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) using SRTM data.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
