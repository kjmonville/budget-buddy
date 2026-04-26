import { useLayoutEffect, useRef, useState } from 'react'

export interface ChartPoint {
  date: Date
  balance: number
}

const RANGES = [7, 30, 60, 90] as const

interface BalanceChartProps {
  series: ChartPoint[]
  todayIndex: number
  height?: number
}

function BalanceChart({ series, todayIndex, height = 160 }: BalanceChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1000)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width))
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  if (series.length === 0) return <div ref={wrapRef} style={{ height }} />

  const padL = 16, padR = 16, padT = 28, padB = 24
  const innerW = Math.max(20, width - padL - padR)
  const innerH = Math.max(20, height - padT - padB)

  const balances = series.map((d) => d.balance)
  const minB = Math.min(...balances)
  const maxB = Math.max(...balances)
  const range = Math.max(1, maxB - minB)
  const yMin = minB - range * 0.15
  const yMax = maxB + range * 0.15
  const yRange = yMax - yMin

  const xAt = (i: number) =>
    padL + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW)
  const yAt = (v: number) =>
    padT + innerH - ((v - yMin) / yRange) * innerH

  let pathD = ''
  series.forEach((d, i) => {
    pathD += (i === 0 ? 'M' : ' L') + ` ${xAt(i)} ${yAt(d.balance)}`
  })

  let lowIdx = 0
  series.forEach((d, i) => { if (d.balance < series[lowIdx].balance) lowIdx = i })

  const tickIdxs: number[] = []
  const targetTicks = Math.min(6, series.length)
  if (targetTicks > 1) {
    for (let t = 0; t < targetTicks; t++) {
      tickIdxs.push(Math.round((t / (targetTicks - 1)) * (series.length - 1)))
    }
  } else if (series.length === 1) {
    tickIdxs.push(0)
  }

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = (x - padL) / innerW
    const i = Math.round(ratio * (series.length - 1))
    setHoverIdx(i >= 0 && i < series.length ? i : null)
  }

  const fmtMoney = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtFullDate = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const lowX = xAt(lowIdx)
  const lowY = yAt(series[lowIdx].balance)
  const labelLeft = lowX < 80
  const labelRight = lowX > width - 80

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: 'block', cursor: 'crosshair' }}
      >
        {/* Faint baseline */}
        <line
          x1={padL} x2={width - padR}
          y1={padT + innerH} y2={padT + innerH}
          stroke="var(--chart-border)"
          strokeWidth="1"
        />

        {/* Balance line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--chart-fg)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Today marker */}
        {todayIndex >= 0 && todayIndex < series.length && (
          <g>
            <line
              x1={xAt(todayIndex)} x2={xAt(todayIndex)}
              y1={padT} y2={padT + innerH}
              stroke="var(--chart-primary)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.35"
            />
            <circle
              cx={xAt(todayIndex)} cy={yAt(series[todayIndex].balance)}
              r="3.5"
              fill="white"
              stroke="var(--chart-primary)"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Low-point marker */}
        <g>
          <circle
            cx={lowX} cy={lowY}
            r="4.5"
            fill="var(--chart-low)"
            stroke="white"
            strokeWidth="2"
          />
          <text
            x={labelLeft ? lowX + 10 : labelRight ? lowX - 10 : lowX}
            y={lowY - 12}
            textAnchor={labelLeft ? 'start' : labelRight ? 'end' : 'middle'}
            fill="var(--chart-low)"
            fontSize="11"
            fontWeight="600"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {fmtMoney(series[lowIdx].balance)}
          </text>
        </g>

        {/* X-axis date ticks */}
        {tickIdxs.map((i, k) => (
          <text
            key={k}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--chart-muted)"
            fontSize="11"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {series[i].date.getDate()}
          </text>
        ))}

        {/* Hover scrubber */}
        {hoverIdx != null && (
          <g>
            <line
              x1={xAt(hoverIdx)} x2={xAt(hoverIdx)}
              y1={padT} y2={padT + innerH}
              stroke="var(--chart-fg)"
              strokeWidth="1"
              opacity="0.18"
            />
            <circle
              cx={xAt(hoverIdx)} cy={yAt(series[hoverIdx].balance)}
              r="4"
              fill="white"
              stroke="var(--chart-fg)"
              strokeWidth="1.75"
            />
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverIdx != null && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: Math.min(width - 180, Math.max(0, xAt(hoverIdx) - 90)),
            background: 'var(--chart-surface)',
            border: '1px solid var(--chart-border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            pointerEvents: 'none',
            display: 'flex',
            gap: 12,
            alignItems: 'baseline',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--chart-muted)' }}>{fmtFullDate(series[hoverIdx].date)}</span>
          <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--chart-fg)' }}>
            {fmtMoney(series[hoverIdx].balance)}
          </strong>
        </div>
      )}
    </div>
  )
}

interface BalancePanelProps {
  series: ChartPoint[]
  todayIndex: number
  range: number
  onRangeChange: (r: number) => void
}

export default function BalancePanel({ series, todayIndex, range, onRangeChange }: BalancePanelProps) {
  return (
    <section
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
      style={{ padding: '18px 20px 14px' }}
    >
      {/* Header row */}
      <div className="flex justify-between items-start gap-4 mb-1.5">
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Projected Balance
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Next {range} days · hover to see daily balance
          </div>
        </div>
        <div
          className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shrink-0"
          role="group"
          aria-label="Range"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={[
                'px-2.5 py-1.5 text-xs font-medium border-l border-gray-200 dark:border-gray-700 first:border-l-0 transition-colors',
                r === range
                  ? 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              ].join(' ')}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <BalanceChart series={series} todayIndex={todayIndex} height={160} />

      {/* Legend */}
      <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block rounded-full bg-white"
            style={{ width: 9, height: 9, border: '2px solid var(--chart-primary)' }}
          />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block rounded-full"
            style={{ width: 8, height: 8, background: 'var(--chart-low)' }}
          />
          Low balance
        </span>
      </div>
    </section>
  )
}
