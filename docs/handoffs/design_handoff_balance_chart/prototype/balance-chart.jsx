// BalanceChart — desktop adaptation of the iOS sparkline.
// Single thin line, low-balance dot annotation, sparse date ticks, hover scrubber.

const BalanceChart = ({
  series,           // [{date: Date, balance: number, delta: number, label?: string}]
  height = 160,
  style = "line",   // "line" | "area" | "stepped"
  showLowPoint = true,
  showTodayMarker = true,
  showHoverScrubber = true,
  todayIndex = 0,
}) => {
  const wrapRef = React.useRef(null);
  const [width, setWidth] = React.useState(1000);
  const [hoverIdx, setHoverIdx] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  if (!series || series.length === 0) return <div ref={wrapRef} style={{height}} />;

  // Layout
  const padL = 16, padR = 16, padT = 28, padB = 24;
  const innerW = Math.max(20, width - padL - padR);
  const innerH = Math.max(20, height - padT - padB);

  const balances = series.map((d) => d.balance);
  const minB = Math.min(...balances);
  const maxB = Math.max(...balances);
  const range = Math.max(1, maxB - minB);
  // Add a touch of headroom so line never hugs the top/bottom
  const yMin = minB - range * 0.15;
  const yMax = maxB + range * 0.15;
  const yRange = yMax - yMin;

  const xAt = (i) => padL + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
  const yAt = (v) => padT + innerH - ((v - yMin) / yRange) * innerH;

  // Path
  let pathD = "";
  if (style === "stepped") {
    series.forEach((d, i) => {
      const x = xAt(i), y = yAt(d.balance);
      if (i === 0) pathD += `M ${x} ${y}`;
      else {
        const px = xAt(i - 1);
        pathD += ` L ${x} ${yAt(series[i - 1].balance)} L ${x} ${y}`;
      }
    });
  } else {
    series.forEach((d, i) => {
      const x = xAt(i), y = yAt(d.balance);
      pathD += (i === 0 ? "M" : " L") + ` ${x} ${y}`;
    });
  }
  let areaD = pathD;
  if (style === "area" || style === "stepped") {
    areaD = pathD + ` L ${xAt(series.length - 1)} ${padT + innerH} L ${xAt(0)} ${padT + innerH} Z`;
  }

  // Low point
  let lowIdx = 0;
  series.forEach((d, i) => { if (d.balance < series[lowIdx].balance) lowIdx = i; });

  // Tick selection — sparse, like iOS (every ~5 days)
  const tickIdxs = [];
  const targetTicks = Math.min(6, series.length);
  for (let t = 0; t < targetTicks; t++) {
    tickIdxs.push(Math.round((t / (targetTicks - 1)) * (series.length - 1)));
  }

  const fmtDay = (d) => d.getDate();

  const handleMove = (e) => {
    if (!showHoverScrubber) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = (x - padL) / innerW;
    const i = Math.round(ratio * (series.length - 1));
    if (i >= 0 && i < series.length) setHoverIdx(i);
    else setHoverIdx(null);
  };
  const handleLeave = () => setHoverIdx(null);

  const fmtMoney = (n) =>
    "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtFullDate = (d) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Annotation positions: keep low-point label inside bounds
  const lowX = xAt(lowIdx);
  const lowY = yAt(series[lowIdx].balance);
  const labelLeft = lowX < 80;
  const labelRight = lowX > width - 80;

  return (
    <div ref={wrapRef} style={{position: "relative", width: "100%"}}>
      <svg
        width={width}
        height={height}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        style={{display: "block", cursor: showHoverScrubber ? "crosshair" : "default"}}
      >
        {/* Faint baseline */}
        <line
          x1={padL} x2={width - padR}
          y1={padT + innerH} y2={padT + innerH}
          stroke="var(--bb-border)"
          strokeWidth="1"
        />

        {/* Area fill */}
        {(style === "area" || style === "stepped") && (
          <path d={areaD} fill="url(#bb-area)" opacity="0.6" />
        )}
        <defs>
          <linearGradient id="bb-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--bb-line)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--bb-line)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--bb-line)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Today marker (vertical guide) */}
        {showTodayMarker && todayIndex >= 0 && todayIndex < series.length && (
          <g>
            <line
              x1={xAt(todayIndex)} x2={xAt(todayIndex)}
              y1={padT} y2={padT + innerH}
              stroke="var(--bb-primary)"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.35"
            />
            <circle
              cx={xAt(todayIndex)} cy={yAt(series[todayIndex].balance)}
              r="3.5"
              fill="white"
              stroke="var(--bb-primary)"
              strokeWidth="2"
            />
          </g>
        )}

        {/* Low-point marker */}
        {showLowPoint && (
          <g>
            <circle
              cx={lowX} cy={lowY}
              r="4.5"
              fill="var(--bb-low)"
              stroke="white"
              strokeWidth="2"
            />
            <text
              x={labelLeft ? lowX + 10 : labelRight ? lowX - 10 : lowX}
              y={lowY - 12}
              textAnchor={labelLeft ? "start" : labelRight ? "end" : "middle"}
              fill="var(--bb-low)"
              fontSize="11"
              fontWeight="600"
              style={{fontVariantNumeric: "tabular-nums"}}
            >
              {fmtMoney(series[lowIdx].balance)}
            </text>
          </g>
        )}

        {/* X-axis ticks */}
        {tickIdxs.map((i, k) => (
          <text
            key={k}
            x={xAt(i)}
            y={height - 6}
            textAnchor="middle"
            fill="var(--bb-muted)"
            fontSize="11"
            style={{fontVariantNumeric: "tabular-nums"}}
          >
            {fmtDay(series[i].date)}
          </text>
        ))}

        {/* Hover scrubber */}
        {hoverIdx != null && showHoverScrubber && (
          <g>
            <line
              x1={xAt(hoverIdx)} x2={xAt(hoverIdx)}
              y1={padT} y2={padT + innerH}
              stroke="var(--bb-fg)"
              strokeWidth="1"
              opacity="0.18"
            />
            <circle
              cx={xAt(hoverIdx)} cy={yAt(series[hoverIdx].balance)}
              r="4"
              fill="white"
              stroke="var(--bb-fg)"
              strokeWidth="1.75"
            />
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoverIdx != null && showHoverScrubber && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: Math.min(width - 180, Math.max(0, xAt(hoverIdx) - 90)),
            background: "var(--bb-bg)",
            border: "1px solid var(--bb-border)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            pointerEvents: "none",
            display: "flex",
            gap: 12,
            alignItems: "baseline",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{color: "var(--bb-muted)"}}>{fmtFullDate(series[hoverIdx].date)}</span>
          <strong style={{fontVariantNumeric: "tabular-nums", color: "var(--bb-fg)"}}>
            {fmtMoney(series[hoverIdx].balance)}
          </strong>
        </div>
      )}
    </div>
  );
};

window.BalanceChart = BalanceChart;
