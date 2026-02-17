import { useState } from "react";
import PulseBar from "../components/PulseBar";
import PulseSelector from "../components/PulseSelector";
import EditableList from "../components/EditableList";
import TagPill from "../components/TagPill";
import { TAGS } from "../constants";

export default function EntryDetail({ entry, member, onBack, onDelete, onUpdate }) {
  const date = new Date(entry.date);
  const [editingSection, setEditingSection] = useState(null);
  const [editData, setEditData] = useState({});

  const startEdit = (section, initialData) => {
    setEditingSection(section);
    setEditData(initialData);
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditData({});
  };

  const saveEdit = () => {
    const cleaned = { ...editData };
    const listFields = ["wins", "blockers", "notable_quotes", "action_items_mine", "action_items_theirs"];
    for (const f of listFields) {
      if (cleaned[f]) cleaned[f] = cleaned[f].filter(s => s.trim() !== "");
    }
    onUpdate(entry.id, cleaned);
    setEditingSection(null);
    setEditData({});
  };

  const editButton = (section, initialData) => (
    <button
      onClick={() => editingSection === section ? cancelEdit() : startEdit(section, initialData)}
      style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 11, color: editingSection === section ? "#dc3c3c" : "#ccc",
        fontFamily: "'DM Sans', sans-serif", padding: "2px 6px",
      }}
    >
      {editingSection === section ? "Cancel" : "Edit"}
    </button>
  );

  const saveButton = (
    <button onClick={saveEdit} style={{
      padding: "4px 14px", borderRadius: 6, marginTop: 8,
      background: member.color, color: "white", border: "none",
      fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12,
      cursor: "pointer",
    }}>Save</button>
  );

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
          <h1 style={{ fontSize: 20, fontFamily: "'Fraunces', serif", fontWeight: 600, margin: 0 }}>
            {date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h1>
        </div>
        <button onClick={() => { if (confirm("Delete this entry?")) onDelete(entry.id); }} style={{
          background: "none", border: "1px solid rgba(220,60,60,0.2)", color: "#dc3c3c",
          padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>Delete</button>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>

        {/* Scores */}
        <div style={{ display: "flex", gap: 24, marginBottom: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
          {editingSection === "scores" ? (
            <>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Morale</span>
                <div style={{ marginTop: 4 }}>
                  <PulseSelector value={editData.morale_score} onChange={v => setEditData({ ...editData, morale_score: v })} color={member.color} />
                </div>
                <textarea value={editData.morale_rationale || ""} onChange={e => setEditData({ ...editData, morale_rationale: e.target.value })}
                  placeholder="Why this score?" rows={2}
                  style={{ marginTop: 6, width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontStyle: "italic", fontFamily: "'DM Sans', sans-serif", background: "#FAFAF8", boxSizing: "border-box", color: "#666", resize: "vertical", lineHeight: 1.5 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Growth</span>
                <div style={{ marginTop: 4 }}>
                  <PulseSelector value={editData.growth_score} onChange={v => setEditData({ ...editData, growth_score: v })} color={member.color} />
                </div>
                <textarea value={editData.growth_rationale || ""} onChange={e => setEditData({ ...editData, growth_rationale: e.target.value })}
                  placeholder="Why this score?" rows={2}
                  style={{ marginTop: 6, width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontStyle: "italic", fontFamily: "'DM Sans', sans-serif", background: "#FAFAF8", boxSizing: "border-box", color: "#666", resize: "vertical", lineHeight: 1.5 }}
                />
              </div>
              <div style={{ alignSelf: "flex-start", paddingTop: 14 }}>
                {editButton("scores", {})}
              </div>
              <div style={{ flexBasis: "100%" }}>{saveButton}</div>
            </>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Morale</span>
                <div style={{ marginTop: 4 }}><PulseBar value={entry.morale_score} color={member.color} /></div>
                {entry.morale_rationale && (
                  <p style={{ fontSize: 12, color: "#888", fontStyle: "italic", margin: "6px 0 0", lineHeight: 1.4 }}>{entry.morale_rationale}</p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Growth</span>
                <div style={{ marginTop: 4 }}><PulseBar value={entry.growth_score} color={member.color} /></div>
                {entry.growth_rationale && (
                  <p style={{ fontSize: 12, color: "#888", fontStyle: "italic", margin: "6px 0 0", lineHeight: 1.4 }}>{entry.growth_rationale}</p>
                )}
              </div>
              <div style={{ alignSelf: "flex-start", paddingTop: 2 }}>
                {editButton("scores", { morale_score: entry.morale_score, growth_score: entry.growth_score, morale_rationale: entry.morale_rationale || "", growth_rationale: entry.growth_rationale || "" })}
              </div>
            </>
          )}
        </div>

        {/* Summary */}
        <div style={{ background: "white", borderRadius: 12, padding: 24, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Summary</h3>
            {editButton("summary", { summary: entry.summary })}
          </div>
          {editingSection === "summary" ? (
            <>
              <textarea value={editData.summary} onChange={e => setEditData({ ...editData, summary: e.target.value })}
                style={{ width: "100%", minHeight: 80, padding: 12, borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, resize: "vertical", background: "#FAFAF8", boxSizing: "border-box" }}
              />
              {saveButton}
            </>
          ) : (
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#333", margin: 0 }}>{entry.summary}</p>
          )}
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Tags</span>
            {editButton("tags", { tags: [...(entry.tags || [])] })}
          </div>
          {editingSection === "tags" ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {TAGS.map(tag => (
                  <TagPill key={tag} tag={tag} color={member.color}
                    active={editData.tags?.includes(tag)}
                    onClick={() => {
                      const tags = editData.tags || [];
                      setEditData({
                        ...editData,
                        tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
                      });
                    }}
                  />
                ))}
              </div>
              {saveButton}
            </>
          ) : (
            entry.tags?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {entry.tags.map(t => (
                  <span key={t} style={{
                    fontSize: 11, padding: "3px 10px", borderRadius: 12,
                    background: `${member.color}15`, color: member.color, fontWeight: 500,
                  }}>{t}</span>
                ))}
              </div>
            )
          )}
        </div>

        {/* Wins */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 11, color: "#81B29A", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Wins</h3>
            {editButton("wins", { wins: [...(entry.wins || [])] })}
          </div>
          {editingSection === "wins" ? (
            <>
              <EditableList items={editData.wins || []} onChange={wins => setEditData({ ...editData, wins })} placeholder="Add win..." color={member.color} />
              {saveButton}
            </>
          ) : (
            entry.wins?.map((w, i) => <p key={i} style={{ fontSize: 14, color: "#444", margin: "4px 0", lineHeight: 1.5 }}>&bull; {w}</p>)
          )}
        </div>

        {/* Blockers */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 11, color: "#E07A5F", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Blockers</h3>
            {editButton("blockers", { blockers: [...(entry.blockers || [])] })}
          </div>
          {editingSection === "blockers" ? (
            <>
              <EditableList items={editData.blockers || []} onChange={blockers => setEditData({ ...editData, blockers })} placeholder="Add blocker..." color={member.color} />
              {saveButton}
            </>
          ) : (
            entry.blockers?.map((b, i) => <p key={i} style={{ fontSize: 14, color: "#444", margin: "4px 0", lineHeight: 1.5 }}>&bull; {b}</p>)
          )}
        </div>

        {/* Action Items */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 11, color: "#3D405B", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Action Items</h3>
            {editButton("action_items", { action_items_mine: [...(entry.action_items_mine || [])], action_items_theirs: [...(entry.action_items_theirs || [])] })}
          </div>
          {editingSection === "action_items" ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 10, background: "#3D405B", color: "white", padding: "1px 6px", borderRadius: 4 }}>YOU</span>
                <div style={{ marginTop: 6 }}>
                  <EditableList items={editData.action_items_mine || []} onChange={items => setEditData({ ...editData, action_items_mine: items })} placeholder="Add action item..." color="#3D405B" />
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, background: member.color, color: "white", padding: "1px 6px", borderRadius: 4 }}>THEM</span>
                <div style={{ marginTop: 6 }}>
                  <EditableList items={editData.action_items_theirs || []} onChange={items => setEditData({ ...editData, action_items_theirs: items })} placeholder="Add action item..." color={member.color} />
                </div>
              </div>
              {saveButton}
            </>
          ) : (
            <>
              {entry.action_items_mine?.map((a, i) => (
                <p key={`m${i}`} style={{ fontSize: 14, color: "#444", margin: "4px 0", lineHeight: 1.5 }}>
                  <span style={{ fontSize: 10, background: "#3D405B", color: "white", padding: "1px 6px", borderRadius: 4, marginRight: 6 }}>YOU</span>{a}
                </p>
              ))}
              {entry.action_items_theirs?.map((a, i) => (
                <p key={`t${i}`} style={{ fontSize: 14, color: "#444", margin: "4px 0", lineHeight: 1.5 }}>
                  <span style={{ fontSize: 10, background: member.color, color: "white", padding: "1px 6px", borderRadius: 4, marginRight: 6 }}>THEM</span>{a}
                </p>
              ))}
            </>
          )}
        </div>

        {/* Notable Quotes */}
        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Notable Quotes</h3>
            {editButton("notable_quotes", { notable_quotes: [...(entry.notable_quotes || [])] })}
          </div>
          {editingSection === "notable_quotes" ? (
            <>
              <EditableList items={editData.notable_quotes || []} onChange={items => setEditData({ ...editData, notable_quotes: items })} placeholder="Add quote..." color={member.color} />
              {saveButton}
            </>
          ) : (
            entry.notable_quotes?.map((q, i) => (
              <p key={i} style={{
                fontSize: 14, color: "#555", margin: "8px 0", lineHeight: 1.5,
                borderLeft: `3px solid ${member.color}`, paddingLeft: 12, fontStyle: "italic",
              }}>{q}</p>
            ))
          )}
        </div>

        {/* Private Note */}
        <div style={{
          background: "#FFFDE7", borderRadius: 12, padding: 20,
          border: "1px dashed rgba(0,0,0,0.12)", marginBottom: 12,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ fontSize: 11, color: "#BBA73D", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>Private Note</h3>
            {editButton("private_note", { private_note: entry.private_note || "" })}
          </div>
          {editingSection === "private_note" ? (
            <>
              <textarea value={editData.private_note} onChange={e => setEditData({ ...editData, private_note: e.target.value })}
                placeholder="Anything you want to remember but wouldn't share directly..."
                style={{ width: "100%", minHeight: 60, padding: 10, borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, fontFamily: "'DM Sans', sans-serif", background: "transparent", resize: "vertical", boxSizing: "border-box" }}
              />
              {saveButton}
            </>
          ) : (
            entry.private_note ? (
              <p style={{ fontSize: 14, color: "#666", margin: 0, lineHeight: 1.5 }}>{entry.private_note}</p>
            ) : (
              <p style={{ fontSize: 13, color: "#ccc", margin: 0, fontStyle: "italic" }}>No private note</p>
            )
          )}
        </div>

      </div>
    </>
  );
}
