import { useState, useEffect, useRef } from "react";

export default function SearchBar({ value, onChange, placeholder }) {
  const [local, setLocal] = useState(value || "");
  const timerRef = useRef(null);

  useEffect(() => { setLocal(value || ""); }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 200);
  };

  return (
    <div style={{ position: "relative" }}>
      <span style={{
        position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
        color: "#bbb", fontSize: 14, pointerEvents: "none",
      }}>&#x1F50D;</span>
      <input
        type="text" value={local} onChange={handleChange}
        placeholder={placeholder || "Search entries..."}
        style={{
          width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10,
          border: "1px solid rgba(0,0,0,0.1)", fontSize: 14,
          fontFamily: "'DM Sans', sans-serif", background: "white",
          boxSizing: "border-box", outline: "none",
        }}
      />
      {local && (
        <button onClick={() => { setLocal(""); onChange(""); }} style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer", color: "#ccc",
          fontSize: 16, padding: 0, lineHeight: 1,
        }}>&times;</button>
      )}
    </div>
  );
}
