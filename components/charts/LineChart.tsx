'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import react-chartjs-2 with no SSR
const Line = dynamic(
  () => import('react-chartjs-2').then((mod) => mod.Line),
  { ssr: false }
)

// Dynamically import Chart.js registration
const registerChartComponents = async () => {
  if (typeof window !== 'undefined') {
    const { 
      Chart,
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
      TimeScale 
    } = await import('chart.js')
    
    Chart.register(
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
      TimeScale
    )
  }
}

interface LineChartProps {
  dataType: 'seismic' | 'temperature'
  timeRange: string
}

export function LineChart({ dataType, timeRange }: LineChartProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    registerChartComponents()
  }, [])

  const [data, setData] = useState<any[]>([])

  // Simulate real-time data updates
  useEffect(() => {
    const fetchData = () => {
      // This is where you'd normally fetch real data
      // For now, we'll generate dummy data
      const now = Date.now()
      const points = 100
      const newData = Array.from({ length: points }, (_, i) => ({
        x: new Date(now - (points - i) * 360000),
        y: Math.random() * (dataType === 'seismic' ? 5 : 800) + 
           (dataType === 'seismic' ? 0 : 200),
      }))
      setData(newData)
    }

    fetchData()
    const interval = setInterval(fetchData, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [dataType, timeRange])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: (timeRange === '1h' ? 'minute' : 
                 timeRange === '24h' ? 'hour' : 
                 timeRange === '7d' ? 'day' : 'week') as 'minute' | 'hour' | 'day' | 'week'
        },
        title: {
          display: true,
          text: 'Time'
        }
      },
      y: {
        title: {
          display: true,
          text: dataType === 'seismic' ? 'Magnitude (ML)' : 'Temperature (°C)'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  }), [dataType, timeRange])

  const chartData = {
    datasets: [
      {
        data: data,
        borderColor: dataType === 'seismic' ? '#ef4444' : '#f97316',
        backgroundColor: dataType === 'seismic' ? '#fee2e2' : '#ffedd5',
        fill: true,
        tension: 0.4
      }
    ]
  }

  if (!isClient) {
    return <div>Loading chart...</div>
  }

  return <Line options={chartOptions} data={chartData} />
} 