import { useState } from "react";
import PulseSelector from "../components/PulseSelector";
import TagPill from "../components/TagPill";
import EditableList from "../components/EditableList";
import { TAGS } from "../constants";

export default function ReviewEntry({ member, extractedData, onSave, onBack }) {
  const [data, setData] = useState(extractedData);
  const [privateNote, setPrivateNote] = useState("");

  const handleSave = () => {
    const filterEmpty = arr => (arr || []).filter(s => s.trim() !== "");
    onSave({
      ...data,
      wins: filterEmpty(data.wins),
      blockers: filterEmpty(data.blockers),
      notable_quotes: filterEmpty(data.notable_quotes),
      action_items_mine: filterEmpty(data.action_items_mine),
      action_items_theirs: filterEmpty(data.action_items_theirs),
      private_note: privateNote,
    });
  };

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
            Review &mdash; {member.name}
          </h1>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
          Here's what was extracted. Tweak anything before saving.
        </p>

        <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 8px" }}>Summary</h3>
          <textarea value={data.summary} onChange={e => setData({ ...data, summary: e.target.value })}
            style={{
              width: "100%", minHeight: 80, padding: 12, borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
              lineHeight: 1.6, resize: "vertical", background: "#FAFAF8", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 24, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Morale</span>
            <div style={{ marginTop: 6 }}>
              <PulseSelector value={data.morale_score} onChange={v => setData({ ...data, morale_score: v })} color={member.color} />
            </div>
            <textarea
              value={data.morale_rationale || ""}
              onChange={e => setData({ ...data, morale_rationale: e.target.value })}
              placeholder="Why this score?"
              rows={2}
              style={{
                marginTop: 6, width: "100%", padding: "6px 10px", borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontStyle: "italic",
                fontFamily: "'DM Sans', sans-serif", background: "#FAFAF8", boxSizing: "border-box",
                color: "#666", resize: "vertical", lineHeight: 1.5,
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Growth</span>
            <div style={{ marginTop: 6 }}>
              <PulseSelector value={data.growth_score} onChange={v => setData({ ...data, growth_score: v })} color={member.color} />
            </div>
            <textarea
              value={data.growth_rationale || ""}
              onChange={e => setData({ ...data, growth_rationale: e.target.value })}
              placeholder="Why this score?"
              rows={2}
              style={{
                marginTop: 6, width: "100%", padding: "6px 10px", borderRadius: 6,
                border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontStyle: "italic",
                fontFamily: "'DM Sans', sans-serif", background: "#FAFAF8", boxSizing: "border-box",
                color: "#666", resize: "vertical", lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Tags</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {TAGS.map(tag => (
              <TagPill key={tag} tag={tag} color={member.color}
                active={data.tags?.includes(tag)}
                onClick={() => {
                  const tags = data.tags || [];
                  setData({
                    ...data,
                    tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]
                  });
                }}
              />
            ))}
          </div>
        </div>

        {[
          { field: "wins", label: "Wins" },
          { field: "blockers", label: "Blockers" },
          { field: "notable_quotes", label: "Notable Quotes" },
        ].map(({ field, label }) => (
          <div key={field} style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
            <h3 style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 8px" }}>
              {label}
            </h3>
            <EditableList
              items={data[field] || []}
              onChange={items => setData({ ...data, [field]: items })}
              placeholder={`Add ${label.toLowerCase().slice(0, -1)}...`}
              color={member.color}
            />
          </div>
        ))}

        <div style={{ background: "white", borderRadius: 12, padding: 16, border: "1px solid rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <h3 style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 6px" }}>Action Items</h3>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 10, background: "#3D405B", color: "white", padding: "1px 6px", borderRadius: 4 }}>YOU</span>
            <div style={{ marginTop: 6 }}>
              <EditableList
                items={data.action_items_mine || []}
                onChange={items => setData({ ...data, action_items_mine: items })}
                placeholder="Add action item..."
                color="#3D405B"
              />
            </div>
          </div>
          <div>
            <span style={{ fontSize: 10, background: member.color, color: "white", padding: "1px 6px", borderRadius: 4 }}>THEM</span>
            <div style={{ marginTop: 6 }}>
              <EditableList
                items={data.action_items_theirs || []}
                onChange={items => setData({ ...data, action_items_theirs: items })}
                placeholder="Add action item..."
                color={member.color}
              />
            </div>
          </div>
        </div>

        <div style={{
          background: "#FFFDE7", borderRadius: 12, padding: 16,
          border: "1px dashed rgba(0,0,0,0.12)", marginBottom: 20,
        }}>
          <h3 style={{ fontSize: 11, color: "#BBA73D", textTransform: "uppercase", letterSpacing: 1.5, margin: "0 0 8px" }}>Private Note</h3>
          <textarea value={privateNote} onChange={e => setPrivateNote(e.target.value)}
            placeholder="Anything you want to remember but wouldn't share directly..."
            style={{
              width: "100%", minHeight: 60, padding: 10, borderRadius: 8,
              border: "1px solid rgba(0,0,0,0.08)", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
              background: "transparent", resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={handleSave} style={{
            padding: "12px 32px", borderRadius: 8,
            background: member.color, color: "white", border: "none",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14,
            cursor: "pointer", transition: "all 0.2s",
          }}>
            Save Entry
          </button>
          <button onClick={onBack} style={{
            padding: "12px 24px", borderRadius: 8,
            background: "transparent", color: "#999", border: "1px solid rgba(0,0,0,0.1)",
            fontFamily: "'DM Sans', sans-serif", fontSize: 14, cursor: "pointer",
          }}>
            Back
          </button>
        </div>
      </div>
    </>
  );
}
