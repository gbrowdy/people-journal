export default function TrendChart({ entries, color }) {
  // Need at least 2 entries for a meaningful line
  if (!entries || entries.length < 2) return null;

  // Reverse so oldest is left, newest is right
  const sorted = [...entries].reverse();

  const width = 600;
  const height = 120;
  const padX = 30;
  const padTop = 10;
  const padBottom = 24;
  const chartW = width - padX * 2;
  const chartH = height - padTop - padBottom;

  const xStep = sorted.length > 1 ? chartW / (sorted.length - 1) : 0;

  const toY = (score) => padTop + chartH - ((((score || 3) - 1) / 4) * chartH);

  const moralePath = sorted.map((e, i) => `${padX + i * xStep},${toY(e.morale_score)}`).join(" ");
  const growthPath = sorted.map((e, i) => `${padX + i * xStep},${toY(e.growth_score)}`).join(" ");

  // Lighter shade for the secondary line
  const lighten = (hex, amount) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r + amount)}, ${Math.min(255, g + amount)}, ${Math.min(255, b + amount)})`;
  };

  const moraleColor = color;
  const growthColor = lighten(color, 80);

  // Y-axis labels (1-5)
  const yLabels = [1, 2, 3, 4, 5];

  // X-axis: show a few date labels
  const labelIndices = sorted.length <= 5
    ? sorted.map((_, i) => i)
    : [0, Math.floor(sorted.length / 2), sorted.length - 1];

  return (
    <div style={{
      background: "white", borderRadius: 12, padding: "16px 20px",
      border: "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Trends</h2>
        <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: moraleColor, display: "inline-block" }} />
            Morale
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 3, borderRadius: 2, background: growthColor, display: "inline-block" }} />
            Growth
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        {/* Horizontal grid lines */}
        {yLabels.map(v => (
          <g key={v}>
            <line
              x1={padX} y1={toY(v)} x2={width - padX} y2={toY(v)}
              stroke="rgba(0,0,0,0.06)" strokeWidth="1"
            />
            <text x={padX - 8} y={toY(v) + 4} textAnchor="end"
              style={{ fontSize: 10, fill: "#ccc", fontFamily: "'DM Mono', monospace" }}>
              {v}
            </text>
          </g>
        ))}
        {/* Morale line */}
        <polyline points={moralePath} fill="none" stroke={moraleColor}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Growth line */}
        <polyline points={growthPath} fill="none" stroke={growthColor}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray="6,3" />
        {/* Data points — morale */}
        {sorted.map((e, i) => (
          <circle key={`m${i}`} cx={padX + i * xStep} cy={toY(e.morale_score)}
            r="3.5" fill={moraleColor} stroke="white" strokeWidth="1.5" />
        ))}
        {/* Data points — growth */}
        {sorted.map((e, i) => (
          <circle key={`g${i}`} cx={padX + i * xStep} cy={toY(e.growth_score)}
            r="3.5" fill={growthColor} stroke="white" strokeWidth="1.5" />
        ))}
        {/* X-axis date labels */}
        {labelIndices.map(i => (
          <text key={`d${i}`} x={padX + i * xStep} y={height - 4} textAnchor="middle"
            style={{ fontSize: 10, fill: "#bbb", fontFamily: "'DM Mono', monospace" }}>
            {new Date(sorted[i].date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        ))}
      </svg>
    </div>
  );
}
