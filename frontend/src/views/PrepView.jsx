import { useState, useEffect } from "react";
import * as api from "../api";
import TrendChart from "../components/TrendChart";

function BriefingMarkdown({ text }) {
  const sections = [];
  let currentSection = null;

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Section header: **Follow up on** (possibly with ## prefix)
    const headerMatch = trimmed.match(/^(?:#{1,4}\s+)?\*\*(.+?)\*\*\s*$/);
    if (headerMatch) {
      currentSection = { title: headerMatch[1], items: [] };
      sections.push(currentSection);
      continue;
    }

    // Bullet point
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletMatch && currentSection) {
      const parts = bulletMatch[1].split(/\*\*(.+?)\*\*/g);
      currentSection.items.push(parts);
      continue;
    }

    // Fallback
    if (currentSection) {
      currentSection.items.push([trimmed]);
    } else {
      currentSection = { title: null, items: [[trimmed]] };
      sections.push(currentSection);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {sections.map((section, si) => (
        <div key={si}>
          {section.title && (
            <div style={{
              fontSize: 12, fontWeight: 700, color: "#3D405B", marginBottom: 8,
              textTransform: "uppercase", letterSpacing: 1.5,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {section.title}
            </div>
          )}
          {section.items.map((parts, ii) => (
            <div key={ii} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "4px 0", paddingLeft: 4 }}>
              <span style={{ color: "#bbb", fontSize: 13, flexShrink: 0 }}>&bull;</span>
              <span style={{ fontSize: 14, color: "#444", lineHeight: 1.6 }}>
                {parts.map((part, pi) =>
                  pi % 2 === 1
                    ? <strong key={pi} style={{ fontWeight: 600 }}>{part}</strong>
                    : <span key={pi}>{part}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PrepView({ member, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPrep = (force = false) => {
    setLoading(true);
    setError(null);
    api.fetchPrep(member.id, { force })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPrep(); }, [member.id]);

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
        {data && !loading && (
          <button onClick={() => loadPrep(true)} style={{
            padding: "8px 16px", borderRadius: 8,
            background: "white", color: "#666",
            border: "1px solid rgba(0,0,0,0.12)",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>Regenerate</button>
        )}
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
              <BriefingMarkdown text={data.briefing} />
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

            {/* JIRA Activity */}
            {(data.jira_assigned?.length > 0 || data.jira_completed?.length > 0 || data.jira_blocked?.length > 0) && (
              <div style={{
                background: "white", borderRadius: 12, padding: 20,
                border: "1px solid rgba(0,0,0,0.06)", marginBottom: 20,
              }}>
                <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 12px" }}>
                  JIRA Activity
                </h2>

                {/* Sprint Stats */}
                {data.jira_sprint_stats && (
                  <div style={{
                    display: "flex", gap: 16, marginBottom: 14, padding: "10px 14px",
                    background: "#FAFAF8", borderRadius: 8,
                  }}>
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: member.color, fontFamily: "'Fraunces', serif" }}>
                        {data.jira_sprint_stats.points_completed}/{data.jira_sprint_stats.points_committed}
                      </div>
                      <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5 }}>Points</div>
                    </div>
                  </div>
                )}

                {/* Blocked/Flagged tickets */}
                {data.jira_blocked?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <span style={{ fontSize: 10, background: "#E07A5F", color: "white", padding: "1px 6px", borderRadius: 4 }}>BLOCKED</span>
                    {data.jira_blocked.map((ticket, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4 }}>
                        <span style={{ color: "#E07A5F", fontSize: 13, flexShrink: 0 }}>&bull;</span>
                        <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5, flex: 1 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888" }}>{ticket.key}</span>{" "}
                          {ticket.summary}
                          {ticket.epic_name && <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>{ticket.epic_name}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assigned tickets */}
                {data.jira_assigned?.length > 0 && (
                  <div style={{ marginBottom: data.jira_completed?.length > 0 ? 14 : 0 }}>
                    <span style={{ fontSize: 10, background: "#3D405B", color: "white", padding: "1px 6px", borderRadius: 4 }}>IN PROGRESS</span>
                    {data.jira_assigned.map((ticket, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4 }}>
                        <span style={{ color: "#bbb", fontSize: 13, flexShrink: 0 }}>&bull;</span>
                        <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5, flex: 1 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#888" }}>{ticket.key}</span>{" "}
                          {ticket.summary}
                          {ticket.epic_name && <span style={{ fontSize: 11, color: "#aaa", marginLeft: 6 }}>{ticket.epic_name}</span>}
                        </span>
                        <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>
                          {ticket.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Completed tickets */}
                {data.jira_completed?.length > 0 && (
                  <div>
                    <span style={{ fontSize: 10, background: "#81B29A", color: "white", padding: "1px 6px", borderRadius: 4 }}>
                      COMPLETED ({data.jira_completed.length})
                    </span>
                    {data.jira_completed.map((ticket, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4 }}>
                        <span style={{ color: "#81B29A", fontSize: 13, flexShrink: 0 }}>&bull;</span>
                        <span style={{ fontSize: 14, color: "#888", lineHeight: 1.5, flex: 1, textDecoration: "line-through", textDecorationColor: "#ddd" }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12 }}>{ticket.key}</span>{" "}
                          {ticket.summary}
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
                  Recent Blockers
                </h2>
                {data.unresolved_blockers.map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0" }}>
                    <span style={{ color: "#bbb", fontSize: 13, flexShrink: 0 }}>&bull;</span>
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
