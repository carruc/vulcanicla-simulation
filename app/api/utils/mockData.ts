import { SensorType, GeoPosition } from '../../../types/sensors';

// Define device locations similar to the Python script
export const DEVICE_LOCATIONS: Record<string, { latitude: number; longitude: number; altitude: number }> = {
  '1': { latitude: 45.4847, longitude: 9.2320, altitude: 150 }, // North
  '2': { latitude: 45.4713, longitude: 9.2320, altitude: 150 }, // South
  '3': { latitude: 45.4780, longitude: 9.2420, altitude: 150 }, // East
  '4': { latitude: 45.4780, longitude: 9.2220, altitude: 150 }, // West
  '5': { latitude: 45.4780, longitude: 9.2320, altitude: 150 }  // Center
};

// Define ranges for different sensor types
const SENSOR_RANGES: Record<SensorType, [number, number]> = {
  'battery': [60, 100],
  'acceleration_x': [-1000, 1000],
  'acceleration_y': [-1000, 1000],
  'acceleration_z': [-1000, 1000],
  'vibration': [0, 5],
  'temperature': [15, 35],
  'pressure': [980, 1020],
  'co2': [400, 2000],
  'so2': [0, 500],
  'location': [0, 0], // Special case, handled separately
  'tagClass': [0, 2]  // Added this line, range 0-2 as in Python script
};

// Helper function to generate random number within range
function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function getMockSensorValue(
  sensorType: SensorType, 
  deviceId: string
): number | GeoPosition | null {
  if (sensorType === 'location') {
    const location = DEVICE_LOCATIONS[deviceId];
    if (!location) {
      console.log('No location found for device:', deviceId);
      return null;
    }
    
    // Add small random variation to make points visible if they overlap
    const position = {
      latitude: location.latitude + randomInRange(-0.0002, 0.0002),
      longitude: location.longitude + randomInRange(-0.0002, 0.0002),
      altitude: location.altitude + randomInRange(-1, 1)
    };
    console.log('Generated position for device:', deviceId, position);
    return position;
  }

  const range = SENSOR_RANGES[sensorType];
  if (!range) return null;
  
  return randomInRange(range[0], range[1]);
}

export function calculateCollectiveStats(values: number[]): { 
  average: number | null; 
  peak: number | null; 
  rms: number | null; 
} {
  if (!values.length) {
    return { average: null, peak: null, rms: null };
  }

  const average = values.reduce((sum, val) => sum + val, 0) / values.length;
  const peak = Math.max(...values);
  const rms = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0) / values.length);

  return { average, peak, rms };
} 