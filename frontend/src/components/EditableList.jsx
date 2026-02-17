import { useRef, useCallback } from "react";

function AutoTextarea({ value, onChange, placeholder }) {
  const resize = useCallback((el) => {
    if (!el) return;
    el.style.height = "0";
    el.style.height = el.scrollHeight + "px";
  }, []);

  const ref = useCallback((el) => { resize(el); }, [resize]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => { onChange(e); resize(e.target); }}
      placeholder={placeholder}
      rows={1}
      style={{
        flex: 1, padding: "6px 10px", borderRadius: 6,
        border: "1px solid rgba(0,0,0,0.1)", fontSize: 14,
        fontFamily: "'DM Sans', sans-serif", background: "#FAFAF8",
        resize: "none", overflow: "hidden", lineHeight: 1.5,
        boxSizing: "border-box",
      }}
    />
  );
}

export default function EditableList({ items, onChange, placeholder, color }) {
  const handleChange = (index, value) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const handleRemove = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([...(items || []), ""]);
  };

  return (
    <div>
      {(items || []).map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <AutoTextarea
            value={item}
            onChange={e => handleChange(i, e.target.value)}
            placeholder={placeholder}
          />
          <button onClick={() => handleRemove(i)} style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#ccc", fontSize: 18, padding: "4px 4px 0", lineHeight: 1,
            flexShrink: 0,
          }} title="Remove">&times;</button>
        </div>
      ))}
      <button onClick={handleAdd} style={{
        background: "none", border: "1px dashed rgba(0,0,0,0.15)",
        borderRadius: 6, padding: "4px 12px", fontSize: 12,
        color: color || "#888", cursor: "pointer",
        fontFamily: "'DM Sans', sans-serif", marginTop: 4,
      }}>+ Add</button>
    </div>
  );
}
