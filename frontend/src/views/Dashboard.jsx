import { useState } from "react";
import SearchBar from "../components/SearchBar";
import { matchesSearch } from "../utils";

export default function Dashboard({ team, entries, onSelectMember, onNewEntry, onOpenSettings, onSelectEntry, onPrep }) {
  const [search, setSearch] = useState("");
  const memberEntries = (memberId) =>
    entries.filter(e => e.member_id === memberId).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <>
      <div style={{
        padding: "24px 32px", borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex", justifyContent: "space-between", alignItems: "center", background: "white",
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>People Journal</h1>
          <p style={{ fontSize: 12, color: "#999", margin: "2px 0 0", fontFamily: "'DM Mono', monospace" }}>1:1 notes &amp; signals</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onNewEntry} style={{
            padding: "8px 20px", borderRadius: 8,
            background: "#1a1a1a", color: "white", border: "none",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>+ New Entry</button>
          <button onClick={onOpenSettings} style={{
            padding: "8px 14px", borderRadius: 8,
            background: "transparent", color: "#999", border: "1px solid rgba(0,0,0,0.1)",
            fontSize: 13, cursor: "pointer",
          }}>&#9881;</button>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {team.map(member => {
            const mEntries = memberEntries(member.id);
            const latest = mEntries[0];
            return (
              <div key={member.id} onClick={() => onSelectMember(member)} style={{
                background: "white", borderRadius: 14, padding: 22,
                border: "1px solid rgba(0,0,0,0.06)", cursor: "pointer",
                transition: "all 0.2s", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 3,
                  background: member.color, opacity: 0.7,
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: member.color,
                    color: "white", fontWeight: 700, fontSize: 15,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{member.name.charAt(0)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{member.name}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{member.role}</div>
                  </div>
                </div>
                {latest ? (
                  <>
                    <p style={{ fontSize: 13, color: "#666", lineHeight: 1.5, margin: "0 0 10px",
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {latest.summary}
                    </p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace" }}>
                        {new Date(latest.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button onClick={(e) => { e.stopPropagation(); onPrep(member); }} style={{
                          padding: "2px 8px", borderRadius: 4, fontSize: 10,
                          fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                          background: `${member.color}15`, color: member.color,
                          border: `1px solid ${member.color}30`, cursor: "pointer",
                        }}>Prep</button>
                        <span style={{ fontSize: 11, color: "#bbb" }}>{mEntries.length} entries</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: "#ccc", fontStyle: "italic", margin: 0 }}>No entries yet</p>
                )}
              </div>
            );
          })}
        </div>

        {entries.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Recent Across Team</h2>
            </div>
            <div style={{ marginBottom: 12 }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search all entries..." />
            </div>
            {(() => {
              const filtered = [...entries]
                .filter(e => matchesSearch(e, search))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, search ? 20 : 5);
              return filtered.length > 0 ? filtered.map(entry => {
                const member = team.find(m => m.id === entry.member_id);
                return (
                  <div key={entry.id} onClick={() => onSelectEntry(entry, member)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                      background: "white", borderRadius: 10, marginBottom: 6,
                      border: "1px solid rgba(0,0,0,0.04)", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9f9f7"}
                    onMouseLeave={e => e.currentTarget.style.background = "white"}
                  >
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%", background: member?.color || "#ccc",
                      color: "white", fontSize: 11, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{member?.name?.charAt(0) || "?"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, color: "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                        {entry.summary}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>
                      {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                );
              }) : (
                <p style={{ fontSize: 13, color: "#ccc", fontStyle: "italic", textAlign: "center", padding: 20 }}>No entries match your search.</p>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
