export default function TagPill({ tag, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 12,
      fontFamily: "'DM Sans', sans-serif",
      border: active ? `1.5px solid ${color}` : "1.5px solid rgba(0,0,0,0.1)",
      background: active ? `${color}15` : "transparent",
      color: active ? color : "#666", cursor: "pointer", transition: "all 0.2s",
      fontWeight: active ? 600 : 400,
    }}>
      {tag}
    </button>
  );
}
