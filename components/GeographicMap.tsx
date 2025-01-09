'use client';

import dynamic from 'next/dynamic';

// Dynamically import Map with no SSR
const MapWithNoSSR = dynamic(
  () => import('./Map').then((mod) => ({ default: mod.Map })),
  {
    ssr: false,
    loading: () => (
      <div 
        style={{ height: '800px', width: '100%' }} 
        className="rounded-lg overflow-hidden flex items-center justify-center bg-gray-100"
      >
        Loading map...
      </div>
    ),
  }
);

export function GeographicMap() {
  return <MapWithNoSSR />;
}

export default GeographicMap;
