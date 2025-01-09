'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DeviceStatus } from '@/types/sensors';
import { getDeviceLocations } from '@/app/api/deviceApi';

// Extract constants
const DEFAULT_CENTER = { lat: 37.7510, lng: 14.9934, zoom: 14 };
const POLLING_INTERVAL = 10000;

// Extract types
interface MapCenter {
  lat: number;
  lng: number;
  zoom: number;
}

interface LeafletMapProps {
  center: MapCenter;
  devices?: DeviceStatus[];
  children?: React.ReactNode;
}

// Dynamically import Leaflet with no SSR
const LeafletMap = dynamic(
  async () => {
    const L = (await import('leaflet')).default;
    
    const addLeafletStyles = () => {
      if (document.querySelector('#leaflet-css')) return;
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    };

    // Create a named component instead of an anonymous one
    const LeafletMapComponent = ({ children, ...props }: LeafletMapProps) => {
      const mapRef = useRef<L.Map | null>(null);
      const markersRef = useRef<(L.Marker | L.CircleMarker)[]>([]);
      const containerRef = useRef<HTMLDivElement>(null);
      const [isClient, setIsClient] = useState(false);

      useEffect(() => {
        setIsClient(true);
        addLeafletStyles();
      }, []);

      useEffect(() => {
        if (!isClient || !containerRef.current) return;

        // Initialize map only if it hasn't been initialized yet
        if (!mapRef.current) {
          const container = containerRef.current;
          // Ensure the container is empty
          container.innerHTML = '';
          
          mapRef.current = L.map(container).setView([props.center.lat, props.center.lng], props.center.zoom);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
          }).addTo(mapRef.current);
        } else {
          // Just update the view if map already exists
          mapRef.current.setView([props.center.lat, props.center.lng], props.center.zoom);
        }

        return () => {
          if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
          }
        };
      }, [isClient, props.center]);

      useEffect(() => {
        if (!mapRef.current || !props.devices) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        // Add new markers
        props.devices.forEach(device => {
          // Determine color based on battery level
          let color = '#22c55e'; // green
          if (device.batteryLevel < 10) {
            color = '#ef4444'; // red
          } else if (device.batteryLevel < 50) {
            color = '#eab308'; // yellow
          }

          // Create circle marker instead of pin marker
          const marker = L.circleMarker(
            [device.position.latitude, device.position.longitude],
            {
              radius: 8,
              fillColor: color,
              color: '#ffffff',
              weight: 1.5,
              opacity: 1,
              fillOpacity: 0.8
            }
          ).addTo(mapRef.current!);
          
          marker.bindPopup(`
            <b>Device ${device.deviceId}</b><br>
            Battery: ${device.batteryLevel.toFixed(2)}%<br>
            Lat: ${device.position.latitude.toFixed(2)}<br>
            Lng: ${device.position.longitude.toFixed(2)}
          `);
          
          markersRef.current.push(marker);
        });
      }, [props.devices]);

      if (!isClient) {
        return <div>Loading map...</div>;
      }

      return (
        <div 
          ref={containerRef}
          style={{ height: '800px', width: '100%' }} 
          className="rounded-lg overflow-hidden"
        />
      );
    };

    // Add display name to the component
    LeafletMapComponent.displayName = 'LeafletMapComponent';

    return LeafletMapComponent;
  },
  { ssr: false }
);

// Add display name to the main Map component as well
export const Map = () => {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);

  // Calculate map center based on devices
  const calculateMapCenter = useCallback((devices: DeviceStatus[]): MapCenter => {
    if (devices.length === 0) return DEFAULT_CENTER;

    const lats = devices.map(d => d.position.latitude);
    const lngs = devices.map(d => d.position.longitude);
    
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    const latSpread = Math.max(...lats) - Math.min(...lats);
    const lngSpread = Math.max(...lngs) - Math.min(...lngs);
    const maxSpread = Math.max(latSpread, lngSpread);
    
    let zoom = 14;
    if (maxSpread > 0.01) zoom = 13;
    if (maxSpread > 0.05) zoom = 12;
    if (maxSpread > 0.1) zoom = 11;

    return { lat: centerLat, lng: centerLng, zoom };
  }, []);

  // Fetch devices data
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const deviceData = await getDeviceLocations();
        setDevices(deviceData);
        setMapCenter(calculateMapCenter(deviceData));
      } catch (error) {
        console.error('Failed to fetch device locations:', error);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [calculateMapCenter]);

  return <LeafletMap center={mapCenter} devices={devices} />;
};

Map.displayName = 'Map';