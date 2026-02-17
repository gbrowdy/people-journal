import { useState } from "react";

const DEFAULT_COLORS = ["#E07A5F", "#3D405B", "#81B29A", "#F2CC8F", "#7B68EE", "#E06895", "#4ECDC4", "#FF6B35"];

export default function Settings({ team, onSave, onBack }) {
  const [draft, setDraft] = useState(team.map(m => ({ ...m })));
  const [deletedIds, setDeletedIds] = useState([]);

  const updateMember = (idx, field, value) => {
    const updated = [...draft];
    updated[idx] = { ...updated[idx], [field]: value };
    setDraft(updated);
  };

  const addMember = () => {
    const color = DEFAULT_COLORS[draft.length % DEFAULT_COLORS.length];
    setDraft([...draft, { id: `new-${Date.now()}`, name: "", role: "Engineer", color, _isNew: true }]);
  };

  const removeMember = (idx) => {
    const member = draft[idx];
    if (!member._isNew) {
      setDeletedIds([...deletedIds, member.id]);
    }
    setDraft(draft.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const added = draft.filter(m => m._isNew).map(({ _isNew, ...m }) => m);
    const updated = draft.filter(m => !m._isNew);
    onSave({ updated, added, deleted: deletedIds });
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
          <h1 style={{ fontSize: 20, fontFamily: "'Fraunces', serif", fontWeight: 600, margin: 0 }}>Team Settings</h1>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 24 }}>
          Customize your team members. Add, remove, or edit names, roles, and colors.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {draft.map((member, idx) => (
            <div key={member.id} style={{
              background: "white", borderRadius: 12, padding: 20,
              border: member._isNew ? "1px dashed rgba(0,0,0,0.15)" : "1px solid rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: member.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {(member.name || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Name</label>
                    <input value={member.name} onChange={e => updateMember(idx, "name", e.target.value)}
                      placeholder="Name"
                      autoFocus={member._isNew}
                      style={{
                        width: "100%", padding: "6px 10px", border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                        background: "#FAFAF8", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ flex: "1 1 120px" }}>
                    <label style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Role</label>
                    <input value={member.role} onChange={e => updateMember(idx, "role", e.target.value)}
                      style={{
                        width: "100%", padding: "6px 10px", border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 6, fontSize: 14, fontFamily: "'DM Sans', sans-serif",
                        background: "#FAFAF8", boxSizing: "border-box",
                      }}
                    />
                  </div>
                  <div style={{ flex: "0 0 60px" }}>
                    <label style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1 }}>Color</label>
                    <input type="color" value={member.color} onChange={e => updateMember(idx, "color", e.target.value)}
                      style={{ width: "100%", height: 30, border: "none", borderRadius: 6, cursor: "pointer", padding: 0 }}
                    />
                  </div>
                  <div style={{ flex: "0 0 32px", display: "flex", alignItems: "flex-end", paddingBottom: 2 }}>
                    <button onClick={() => {
                      if (confirm(`Remove ${member.name || "this member"}? This will also delete all their entries.`))
                        removeMember(idx);
                    }} style={{
                      width: 30, height: 30, borderRadius: 6, border: "1px solid rgba(220,60,60,0.2)",
                      background: "none", color: "#dc3c3c", cursor: "pointer", fontSize: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>&times;</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={handleSave} style={{
            padding: "12px 32px", borderRadius: 8,
            background: "#1a1a1a", color: "white", border: "none",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: "pointer",
          }}>
            Save Team
          </button>
          <button onClick={addMember} style={{
            padding: "12px 24px", borderRadius: 8,
            background: "transparent", color: "#666", border: "1px solid rgba(0,0,0,0.12)",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500, fontSize: 14, cursor: "pointer",
          }}>
            + Add Member
          </button>
        </div>
      </div>
    </>
  );
}
