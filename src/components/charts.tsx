/**
 * Small dependency-free SVG charts. Server-renderable and responsive, avoiding
 * a heavy charting dependency while still giving realistic dashboard visuals.
 */

export function BarChart({
  data,
  unit = "%",
  max,
  height = 160,
}: {
  data: { label: string; value: number }[];
  unit?: string;
  max?: number;
  height?: number;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-400">No data yet.</p>;
  }
  const ceiling = max ?? Math.max(100, ...data.map((d) => d.value));
  const barW = 100 / data.length;
  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full">
        {[0, 25, 50, 75, 100].map((g) => {
          const y = height - (g / ceiling) * (height - 20) - 14;
          return (
            <line
              key={g}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="#eceef2"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        {data.map((d, i) => {
          const h = Math.max(1, (d.value / ceiling) * (height - 20));
          const x = i * barW + barW * 0.22;
          const w = barW * 0.56;
          const y = height - h - 14;
          const color = d.value >= 75 ? "#12b76a" : d.value >= 50 ? "#f79009" : "#f04438";
          return (
            <g key={`${d.label}-${i}`}>
              <rect x={x} y={y} width={w} height={h} rx="1" fill={color} opacity="0.9" />
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        {data.map((d, i) => (
          <span key={`${d.label}-lbl-${i}`} className="flex-1 truncate text-center">
            {d.label}
            <br />
            <span className="font-medium text-ink-600">
              {d.value}
              {unit}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  data,
  height = 160,
  unit = "%",
}: {
  data: { label: string; value: number }[];
  height?: number;
  unit?: string;
}) {
  if (data.length === 0) {
    return <p className="py-6 text-center text-xs text-ink-400">No data yet.</p>;
  }
  const max = 100;
  const min = 0;
  const step = data.length > 1 ? 100 / (data.length - 1) : 0;
  const toY = (v: number) =>
    height - 18 - ((v - min) / (max - min)) * (height - 30);
  const points = data.map((d, i) => `${i * step},${toY(d.value)}`).join(" ");
  const area = `0,${height - 18} ${points} ${(data.length - 1) * step},${height - 18}`;
  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full">
        {[0, 25, 50, 75, 100].map((g) => {
          const y = toY(g);
          return (
            <line
              key={g}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="#eceef2"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
        <polygon points={area} fill="#3560f5" opacity="0.08" />
        <polyline
          points={points}
          fill="none"
          stroke="#3560f5"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        {data.map((d, i) => (
          <circle
            key={`${d.label}-pt-${i}`}
            cx={i * step}
            cy={toY(d.value)}
            r="1.6"
            fill="#3560f5"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-ink-400">
        <span>{data[0]!.label}</span>
        <span>
          Latest: {data[data.length - 1]!.value}
          {unit}
        </span>
        <span>{data[data.length - 1]!.label}</span>
      </div>
    </div>
  );
}
