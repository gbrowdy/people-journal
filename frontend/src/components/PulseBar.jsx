export default function PulseBar({ value, max = 5, color }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 18, height: 6, borderRadius: 3,
          background: i < value ? color : "rgba(0,0,0,0.08)",
          transition: "background 0.3s",
        }} />
      ))}
    </div>
  );
}
