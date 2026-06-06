import { useEffect, useRef } from 'react'
import { Chart } from 'chart.js/auto'

const DEFAULT_COLORS = [
  '#38bdf8', // Cyan
  '#818cf8', // Indigo
  '#34d399', // Emerald
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#a78bfa', // Purple
]

export default function NativeChartRenderer({
  type = 'bar',
  data = [],
  xKey = '',
  yKeys = [],
  mapping = null,
  title = '',
  isDark = true,
}) {
  const canvasRef = useRef(null)
  const chartInstanceRef = useRef(null)

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    // Destroy existing chart instance if any
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy()
      chartInstanceRef.current = null
    }

    let activeXKey = mapping?.x || xKey
    let activeYKeys = Array.isArray(mapping?.y)
      ? mapping.y
      : (mapping?.y ? [mapping.y] : yKeys)

    if (data && data.length > 0) {
      const firstItem = data[0]
      const keys = Object.keys(firstItem)

      if (!activeXKey) {
        const stringKey = keys.find(k => typeof firstItem[k] === 'string')
        activeXKey = stringKey || keys[0] || ''
      }

      if (!activeYKeys || activeYKeys.length === 0) {
        const numberKeys = keys.filter(k => k !== activeXKey && typeof firstItem[k] === 'number')
        activeYKeys = numberKeys.length > 0 ? numberKeys : keys.filter(k => k !== activeXKey).slice(0, 1)
      }
    }

    if (!data || data.length === 0 || !activeXKey || !activeYKeys || activeYKeys.length === 0) {
      return
    }

    // Get dynamic style variables from the page theme
    const rootStyle = getComputedStyle(document.documentElement)
    const brandCyan = rootStyle.getPropertyValue('--analisai-cyan').trim() || '#38bdf8'
    const brandSecondary = isDark ? '#a78bfa' : '#6366f1' // purple/indigo
    const brandSuccess = isDark ? '#34d399' : '#10b981' // emerald
    const brandWarning = isDark ? '#fb923c' : '#f59e0b' // amber
    const brandDanger = isDark ? '#fb7185' : '#f43f5e' // rose
    const brandMuted = isDark ? '#94a3b8' : '#475569' // slate

    const dynamicColors = [
      brandCyan,
      brandSecondary,
      brandSuccess,
      brandWarning,
      brandDanger,
      brandMuted,
    ]

    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'
    const textColor = isDark ? '#8e918f' : '#5f6368'
    const tooltipBg = isDark ? '#1e1f20' : '#ffffff'
    const tooltipText = isDark ? '#e3e3e3' : '#1f1f1f'
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

    let labels = []
    let datasets = []

    if (type === 'scatter') {
      datasets = activeYKeys.map((yKey, index) => {
        const color = dynamicColors[index % dynamicColors.length]
        return {
          label: `${yKey.replace(/_/g, ' ').toUpperCase()} vs ${activeXKey.replace(/_/g, ' ').toUpperCase()}`,
          data: data.map(item => ({
            x: Number(item[activeXKey] ?? 0),
            y: Number(item[yKey] ?? 0)
          })),
          backgroundColor: color,
          borderColor: color,
          pointRadius: 6,
          pointHoverRadius: 8,
        }
      })
    } else {
      const groupedMap = {}
      data.forEach(item => {
        const groupVal = String(item[activeXKey] ?? 'Unknown')
        if (!groupedMap[groupVal]) {
          groupedMap[groupVal] = { [activeXKey]: groupVal }
          activeYKeys.forEach(yKey => {
            groupedMap[groupVal][yKey] = 0
          })
        }
        activeYKeys.forEach(yKey => {
          groupedMap[groupVal][yKey] += Number(item[yKey] ?? 0)
        })
      })

      const aggregatedData = Object.values(groupedMap)
      labels = aggregatedData.map((item) => String(item[activeXKey] ?? ''))

      datasets = activeYKeys.map((yKey, index) => {
        const color = dynamicColors[index % dynamicColors.length]
        const isPieOrDoughnut = type === 'pie' || type === 'doughnut'
        const isArea = type === 'area'

        return {
          label: yKey.replace(/_/g, ' ').toUpperCase(),
          data: aggregatedData.map((item) => Number(item[yKey] ?? 0)),
          backgroundColor: isPieOrDoughnut 
            ? dynamicColors.slice(0, aggregatedData.length) 
            : isArea
              ? color + '22' // hex for 13% opacity area fill
              : type === 'line' ? 'transparent' : color,
          borderColor: isPieOrDoughnut ? 'transparent' : color,
          borderWidth: (type === 'line' || isArea) ? 2 : 1,
          tension: (type === 'line' || isArea) ? 0.35 : 0,
          fill: isArea,
          pointBackgroundColor: color,
          pointHoverRadius: 5,
        }
      })
    }

    const chartConfig = {
      type: type === 'pie' || type === 'doughnut' 
        ? type 
        : type === 'scatter' 
          ? 'scatter' 
          : (type === 'line' || type === 'area') 
            ? 'line' 
            : 'bar',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: false,
          },
          legend: {
            display: type === 'pie' || type === 'doughnut' || activeYKeys.length > 1,
            position: 'bottom',
            labels: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif",
                size: 11,
              },
              padding: 15,
            },
          },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: tooltipText,
            borderColor: tooltipBorder,
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            titleFont: {
              family: "'Inter', sans-serif",
              weight: 'bold',
            },
            bodyFont: {
              family: "'JetBrains Mono', monospace",
              size: 12,
            },
          },
        },
        scales: type === 'pie' || type === 'doughnut' ? {} : {
          x: {
            grid: {
              color: gridColor,
              drawBorder: false,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'Inter', sans-serif",
                size: 11,
              },
            },
          },
          y: {
            grid: {
              color: gridColor,
              drawBorder: false,
            },
            ticks: {
              color: textColor,
              font: {
                family: "'JetBrains Mono', monospace",
                size: 10,
              },
              callback: (value) => {
                if (value >= 1e9) return (value / 1e9).toFixed(1) + 'B'
                if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M'
                if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K'
                return value
              },
            },
          },
        },
      },
    }

    chartInstanceRef.current = new Chart(ctx, chartConfig)

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy()
        chartInstanceRef.current = null
      }
    }
  }, [type, data, xKey, yKeys, isDark])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  )
}
