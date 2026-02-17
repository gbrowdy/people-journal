export default function PulseSelector({ value, onChange, max = 5, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center", cursor: "pointer" }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} onClick={() => onChange(i + 1)} style={{
          width: 24, height: 8, borderRadius: 4,
          background: i < value ? color : "rgba(0,0,0,0.1)",
          transition: "all 0.2s",
          transform: i < value ? "scaleY(1)" : "scaleY(0.8)",
        }} />
      ))}
    </div>
  );
}
