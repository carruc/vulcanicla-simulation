import { 
  SensorType, 
  AggregationType, 
  Sensor, 
  SensorData,
  GeoPosition,
  DeviceStatus
} from '@/types/sensors';
import { API_URL } from './config';
import { getMockSensorValue, calculateCollectiveStats, DEVICE_LOCATIONS } from './utils/mockData';

const API_BASE_URL = `${API_URL}/api`;

/**
 * Fetches the list of available device IDs from the server
 */
export async function getAvailableDevices(): Promise<number[]> {
  // Return the device IDs from our mock data
  return Object.keys(DEVICE_LOCATIONS).map(id => parseInt(id));
}

interface CollectiveStats {
  timestamp: string;
  metrics: {
    average?: number | null;
    peak?: number | null;
    rms?: number | null;
  };
  deviceCount: number;
  readingCount: number;
}

/**
 * Fetches latest sensor data for specific types and aggregation method
 */
export async function getLatestCollectiveData(
  sensorTypes: SensorType[],
  aggregationType: AggregationType
): Promise<Record<SensorType, CollectiveStats>> {
  const mockData: Record<SensorType, CollectiveStats> = Object.fromEntries(
    sensorTypes.map(type => [type, {
      timestamp: new Date().toISOString(),
      metrics: { average: null, peak: null, rms: null },
      deviceCount: 0,
      readingCount: 0
    }])
  ) as Record<SensorType, CollectiveStats>;
  
  const devices = Object.keys(DEVICE_LOCATIONS);
  
  for (const sensorType of sensorTypes) {
    const values = devices.map(deviceId => 
      getMockSensorValue(sensorType, deviceId)
    ).filter((val): val is number => 
      typeof val === 'number' && 
      val !== null && 
      (typeof val === 'object' ? !('latitude' in val) : true)
    );

    const stats = calculateCollectiveStats(values);
    
    mockData[sensorType] = {
      timestamp: new Date().toISOString(),
      metrics: {
        average: stats.average,
        peak: stats.peak,
        rms: stats.rms
      },
      deviceCount: devices.length,
      readingCount: values.length
    };
  }

  return mockData;
}

/**
 * Fetches sensor data for a specific device
 */
export async function getSensorData(
  deviceId: string | number,
  sensorType: SensorType
): Promise<{ value: number | null | GeoPosition }> {
  const mockValue = getMockSensorValue(sensorType, deviceId.toString());
  return { value: mockValue };
}

/**
 * Fetches multiple sensor types data from a specific device
 */
export async function getMultipleSensorData(
  deviceId: string | number,
  sensorTypes: SensorType[]
): Promise<Record<SensorType, number | null | GeoPosition>> {
  try {
    const promises = sensorTypes.map(type => getSensorData(deviceId, type));
    const results = await Promise.all(promises);
    
    return sensorTypes.reduce((acc, type, index) => {
      acc[type] = results[index].value;
      return acc;
    }, {} as Record<SensorType, number | null | GeoPosition>);
  } catch (error) {
    console.error(`Failed to fetch multiple sensor data for device ${deviceId}:`, error);
    throw error;
  }
}

export async function getDeviceLocations(): Promise<DeviceStatus[]> {
  try {
    const deviceIds = await getAvailableDevices();
    
    const deviceLocations = await Promise.all(
      deviceIds.map(async (deviceId) => {
        const sensorData = await getMultipleSensorData(deviceId, ['location', 'battery']);
        console.log('Device location data:', deviceId, sensorData);
        
        if (typeof sensorData.location === 'object' && sensorData.location && 'latitude' in sensorData.location) {
          return {
            deviceId: deviceId.toString(),
            position: sensorData.location as GeoPosition,
            batteryLevel: sensorData.battery ?? 0
          } as DeviceStatus;
        }
        return null;
      })
    );
    
    const filteredLocations = deviceLocations.filter((d): d is DeviceStatus => d !== null);
    console.log('Final device locations:', filteredLocations);
    return filteredLocations;
  } catch (error) {
    console.error('Failed to fetch device locations:', error);
    return [];
  }
}