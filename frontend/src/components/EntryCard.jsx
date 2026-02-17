import PulseBar from "./PulseBar";

export default function EntryCard({ entry, member, onClick }) {
  const date = new Date(entry.date);
  const dayStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div onClick={onClick} style={{
      padding: "16px 20px", borderRadius: 12, cursor: "pointer",
      background: "white", border: "1px solid rgba(0,0,0,0.06)",
      transition: "all 0.2s", marginBottom: 8,
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#999", fontFamily: "'DM Mono', monospace" }}>{dayStr}</span>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>mood</span>
            <PulseBar value={entry.morale_score} color={member.color} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>growth</span>
            <PulseBar value={entry.growth_score} color={member.color} />
          </div>
        </div>
      </div>
      <p style={{ fontSize: 14, color: "#333", lineHeight: 1.5, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
        {entry.summary}
      </p>
      {entry.tags?.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 10 }}>
          {entry.tags.map(t => (
            <span key={t} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 10,
              background: `${member.color}12`, color: member.color,
              fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
