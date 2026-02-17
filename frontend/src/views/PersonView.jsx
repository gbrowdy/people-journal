import EntryCard from "../components/EntryCard";

export default function PersonView({ member, entries, onBack, onNewEntry, onSelectEntry }) {
  const mEntries = entries
    .filter(e => e.member_id === member.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const avgMorale = mEntries.length
    ? (mEntries.reduce((s, e) => s + (e.morale_score || 0), 0) / mEntries.length).toFixed(1)
    : "\u2014";
  const avgGrowth = mEntries.length
    ? (mEntries.reduce((s, e) => s + (e.growth_score || 0), 0) / mEntries.length).toFixed(1)
    : "\u2014";

  return (
    <>
      <div style={{
        padding: "24px 32px", borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center", background: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onBack} style={{
            background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#999", padding: 0,
          }}>&larr;</button>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: member.color,
            color: "white", fontWeight: 700, fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{member.name.charAt(0)}</div>
          <div>
            <h1 style={{ fontSize: 20, fontFamily: "'Fraunces', serif", fontWeight: 600, margin: 0 }}>{member.name}</h1>
            <span style={{ fontSize: 12, color: "#999" }}>{member.role}</span>
          </div>
        </div>
        <button onClick={onNewEntry} style={{
          padding: "8px 20px", borderRadius: 8,
          background: member.color, color: "white", border: "none",
          fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}>+ New Entry</button>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        {mEntries.length > 0 && (
          <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
            <div style={{
              background: "white", borderRadius: 12, padding: "14px 20px",
              border: "1px solid rgba(0,0,0,0.06)", flex: 1, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Avg Morale</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: member.color, fontFamily: "'Fraunces', serif" }}>{avgMorale}</div>
            </div>
            <div style={{
              background: "white", borderRadius: 12, padding: "14px 20px",
              border: "1px solid rgba(0,0,0,0.06)", flex: 1, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Avg Growth</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: member.color, fontFamily: "'Fraunces', serif" }}>{avgGrowth}</div>
            </div>
            <div style={{
              background: "white", borderRadius: 12, padding: "14px 20px",
              border: "1px solid rgba(0,0,0,0.06)", flex: 1, textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Entries</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: member.color, fontFamily: "'Fraunces', serif" }}>{mEntries.length}</div>
            </div>
          </div>
        )}

        {mEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#999" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>&#128221;</div>
            <p style={{ fontSize: 15 }}>No entries yet for {member.name}.</p>
            <p style={{ fontSize: 13 }}>Process your first 1:1 transcript to get started.</p>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Timeline</h2>
            {mEntries.map(entry => (
              <EntryCard key={entry.id} entry={entry} member={member}
                onClick={() => onSelectEntry(entry)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
