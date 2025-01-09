'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { ChartData, ChartOptions } from 'chart.js'
import dynamic from 'next/dynamic'
import 'chartjs-adapter-date-fns'
import { format } from 'date-fns'
import { timeRanges } from '../RealTimeMonitor'
import { SensorType, AggregationType, GeoPosition } from '@/types/sensors'
import { getLatestCollectiveData, getMultipleSensorData } from '@/app/api/deviceApi'

// Dynamically import react-chartjs-2
const Line = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  { ssr: false }
);

let Chart: typeof import('chart.js').Chart;

const initChart = async () => {
  if (typeof window !== 'undefined') {
    const { 
      Chart,
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      TimeScale,
      Title,
      Tooltip,
      Legend 
    } = await import('chart.js')
    
    Chart.register(
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      TimeScale,
      Title,
      Tooltip,
      Legend
    )
  }
}

interface DataPoint {
  x: Date;
  y: number;
}

const MAX_DATA_POINTS = 600

const UPDATE_INTERVALS = {
  '30s': 100,  // Every 100ms for 30-second view
  '1m': 100,   // Every 100ms for 1-minute view
  '1h': 1000,  // Every second for 1-hour view
  '24h': 10000, // Every 10 seconds for 24-hour view
  '7d': 60000,  // Every minute for 7-day view
  '30d': 60000  // Every minute for 30-day view
}

interface RealTimeLineChartProps {
  timeRange: string
  selectedSensor: string | 'all'
  aggregationType: AggregationType
  selectedTypes: SensorType[]
  dataType: SensorType
}

const TYPE_COLORS: Record<SensorType, string> = {
  temperature: 'rgb(239, 68, 68)',
  pressure: 'rgb(59, 130, 246)',
  battery: 'rgb(34, 197, 94)',
  vibration: 'rgb(168, 85, 247)',
  acceleration_x: 'rgb(249, 115, 22)',
  acceleration_y: 'rgb(236, 72, 153)',
  acceleration_z: 'rgb(234, 179, 8)',
  co2: 'rgb(147, 51, 234)',
  so2: 'rgb(20, 184, 166)',
  location: 'rgb(0, 0, 0)',
  tagClass: 'rgb(100, 100, 100)'
}

const UNITS: Record<SensorType, string> = {
  temperature: '°C',
  pressure: 'hPa',
  battery: '%',
  vibration: 'g',
  acceleration_x: 'g',
  acceleration_y: 'g',
  acceleration_z: 'g',
  co2: 'ppm',
  so2: 'ppm',
  location: 'a',
  tagClass: 'tag'
}

export function RealTimeLineChart({
  timeRange,
  selectedSensor,
  aggregationType,
  selectedTypes,
  dataType
}: RealTimeLineChartProps) {
  const [isClient, setIsClient] = useState(false)
  const [isChartReady, setIsChartReady] = useState(false);
  const [dataPoints, setDataPoints] = useState<Record<SensorType, DataPoint[]>>({
    temperature: [],
    pressure: [],
    battery: [],
    vibration: [],
    acceleration_x: [],
    acceleration_y: [],
    acceleration_z: [],
    co2: [],
    so2: [],
    location: [],
    tagClass: []
  });
  
  const chartRef = useRef<any>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const getTimeWindow = useCallback(() => {
    switch (timeRange) {
      case '30s': return 30 * 1000;
      case '1m': return 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }, [timeRange]);

  const getDynamicRange = useCallback((data: Array<{x: Date, y: number}>) => {
    if (!data || data.length === 0) return { min: 0, max: 1 };
    
    const values = data.map(point => point.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (min === max) {
      return { min: min - 0.5, max: max + 0.5 };
    }
    
    const range = max - min;
    const padding = range * 0.1;
    
    return { min: min - padding, max: max + padding };
  }, []);

  const updateDataPoints = useCallback((type: SensorType, value: number | GeoPosition | null) => {
    // Skip if value is not a number
    if (typeof value !== 'number') return;
    
    const now = new Date();
    setDataPoints(current => ({
      ...current,
      [type]: [
        ...(current[type] || []).slice(-MAX_DATA_POINTS),
        { x: now, y: value }  // Match the DataPoint interface
      ]
    }));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      if (selectedSensor === 'all') {
        const data = await getLatestCollectiveData(selectedTypes, aggregationType);
        selectedTypes.forEach(type => {
          const value = data[type]?.metrics?.[aggregationType];
          if (typeof value === 'number') {
            updateDataPoints(type, value);
          }
        });
      } else if (selectedSensor && selectedTypes.length > 0) {
        const data = await getMultipleSensorData(selectedSensor, selectedTypes);
        selectedTypes.forEach(type => {
          if (typeof data[type] === 'number') {
            updateDataPoints(type, data[type]);
          }
        });
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    }
  }, [selectedSensor, selectedTypes, aggregationType, updateDataPoints]);

  // Initialize Chart.js
  useEffect(() => {
    setIsClient(true)
    initChart()
  }, [])

  // Set up data polling
  useEffect(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    void fetchData();

    const interval = UPDATE_INTERVALS[timeRange as keyof typeof UPDATE_INTERVALS] || 10000;
    pollingIntervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [timeRange, selectedTypes, selectedSensor, aggregationType, fetchData]);

  // Update time window
  useEffect(() => {
    const timeWindow = getTimeWindow();
    
    const updateTimeWindow = () => {
      const chart = chartRef.current;
      if (!chart?.options?.scales?.['x']) return;

      const xAxis = chart.options.scales['x'];
      const now = Date.now();
      
      xAxis.min = now - timeWindow;
      xAxis.max = now;
      
      chart.update('none');
    };

    const intervalId = setInterval(updateTimeWindow, 1000);
    return () => clearInterval(intervalId);
  }, [timeRange, getTimeWindow]);

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,  // Disable animations for better performance
    spanGaps: true,   // Connect points across gaps
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '30s' || timeRange === '1m' ? 'second' :
                timeRange === '1h' ? 'minute' : 
                timeRange === '24h' ? 'hour' : 'day',
          displayFormats: {
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM d'
          }
        },
        title: {
          display: true,
          text: 'Time'
        },
        min: Date.now() - getTimeWindow(),
        max: Date.now()
      },
      ...selectedTypes.reduce((acc, type, index) => {
        const range = getDynamicRange(dataPoints[type]);
        return {
          ...acc,
          [`y-${type}`]: {
            type: 'linear' as const,
            display: true,
            position: index % 2 === 0 ? 'left' : 'right',
            grid: {
              drawOnChartArea: index === 0,
            },
            title: {
              display: true,
              text: `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} (${UNITS[type]})`,
              color: TYPE_COLORS[type]
            },
            ticks: {
              color: TYPE_COLORS[type],
              callback: (value: number) => value.toFixed(2)
            },
            min: range.min,
            max: range.max,
            beginAtZero: type === 'battery'
          }
        };
      }, {})
    },
    plugins: {
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: (tooltipItems) => {
            const date = new Date(tooltipItems[0].parsed.x);
            return format(date, timeRange === '1m' ? 'HH:mm:ss.SSS' : 'HH:mm:ss');
          },
          label: (context) => {
            if (!context.dataset.label) return '';
            const value = context.parsed.y.toFixed(3);
            const sensorType = context.dataset.label.toLowerCase().replace(' ', '_') as SensorType;
            return `${context.dataset.label}: ${value} ${UNITS[sensorType]}`;
          }
        }
      },
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle'
        }
      }
    },
    interaction: {
      intersect: false,
      mode: 'nearest'
    },
    elements: {
      point: {
        radius: 0     // Hide points for better performance
      },
      line: {
        tension: 0.1  // Reduce line smoothing for performance
      }
    }
  };

  const chartData: ChartData<'line', DataPoint[]> = {
    datasets: selectedTypes.map(type => ({
      label: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
      data: dataPoints[type],
      borderColor: TYPE_COLORS[type],
      backgroundColor: TYPE_COLORS[type],
      tension: 0.1,
      pointRadius: 0,
      yAxisID: `y-${type}`
    }))
  };

  if (!isClient) {
    return <div className="flex h-full items-center justify-center text-gray-500">
      Loading chart...
    </div>
  }

  return (
    <div className="relative w-full h-full">
      {isClient && <Line ref={chartRef} options={chartOptions} data={chartData} />}
    </div>
  );
}