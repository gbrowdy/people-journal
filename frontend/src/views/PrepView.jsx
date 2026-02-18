import { useState, useEffect } from "react";
import * as api from "../api";
import TrendChart from "../components/TrendChart";

export default function PrepView({ member, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.fetchPrep(member.id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [member.id]);

  // Build fake entries for TrendChart from score points
  const trendEntries = data ? data.morale_scores.map((m, i) => ({
    date: m.date,
    morale_score: m.score,
    growth_score: data.growth_scores[i]?.score || 3,
  })) : [];

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
            <h1 style={{ fontSize: 20, fontFamily: "'Fraunces', serif", fontWeight: 600, margin: 0 }}>
              Prep: {member.name}
            </h1>
            <span style={{ fontSize: 12, color: "#999" }}>{member.role}</span>
          </div>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#999" }}>
            <div style={{ fontSize: 14 }}>Generating briefing...</div>
          </div>
        )}

        {error && (
          <div style={{
            background: "#FFF5F5", borderRadius: 12, padding: 20,
            border: "1px solid rgba(220,50,50,0.1)", marginBottom: 20,
          }}>
            <p style={{ fontSize: 14, color: "#C53030", margin: 0 }}>{error}</p>
          </div>
        )}

        {data && !loading && (
          <>
            {/* AI Briefing */}
            <div style={{
              background: "white", borderRadius: 12, padding: 20,
              border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
            }}>
              <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>
                AI Briefing
              </h2>
              <div style={{
                fontSize: 14, color: "#444", lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}>
                {data.briefing}
              </div>
            </div>

            {/* Trend Chart */}
            {trendEntries.length >= 2 && (
              <div style={{ marginBottom: 20 }}>
                <TrendChart entries={trendEntries} color={member.color} />
              </div>
            )}

            {/* Open Action Items */}
            {(data.open_items_mine?.length > 0 || data.open_items_theirs?.length > 0) && (
              <div style={{
                background: "white", borderRadius: 12, padding: 20,
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
              }}>
                <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>
                  Open Action Items
                </h2>
                {data.open_items_mine?.length > 0 && (
                  <div style={{ marginBottom: data.open_items_theirs?.length > 0 ? 14 : 0 }}>
                    <span style={{ fontSize: 10, background: "#3D405B", color: "white", padding: "1px 6px", borderRadius: 4 }}>YOU</span>
                    {data.open_items_mine.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4 }}>
                        <span style={{ color: "#bbb", fontSize: 13, flexShrink: 0 }}>&bull;</span>
                        <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5, flex: 1 }}>{item.text}</span>
                        <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {data.open_items_theirs?.length > 0 && (
                  <div>
                    <span style={{ fontSize: 10, background: member.color, color: "white", padding: "1px 6px", borderRadius: 4 }}>THEM</span>
                    {data.open_items_theirs.map((item, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4 }}>
                        <span style={{ color: "#bbb", fontSize: 13, flexShrink: 0 }}>&bull;</span>
                        <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5, flex: 1 }}>{item.text}</span>
                        <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent Tags */}
            {data.recent_tags?.length > 0 && (
              <div style={{
                background: "white", borderRadius: 12, padding: 20,
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
              }}>
                <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>
                  Recent Tags
                </h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {data.recent_tags.map(t => (
                    <span key={t.tag} style={{
                      padding: "4px 12px", borderRadius: 20, fontSize: 12,
                      fontFamily: "'DM Sans', sans-serif",
                      border: `1.5px solid ${member.color}`,
                      background: `${member.color}15`,
                      color: member.color, fontWeight: 600,
                    }}>
                      {t.tag} {t.count > 1 ? `\u00d7${t.count}` : ""}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Unresolved Blockers */}
            {data.unresolved_blockers?.length > 0 && (
              <div style={{
                background: "white", borderRadius: 12, padding: 20,
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
              }}>
                <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>
                  Unresolved Blockers
                </h2>
                {data.unresolved_blockers.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0" }}>
                    <span style={{ color: "#E07A5F", fontSize: 13, flexShrink: 0 }}>&bull;</span>
                    <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
