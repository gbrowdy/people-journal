import TagPill from "./TagPill";
import { TAGS } from "../constants";

const DATE_RANGES = [
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "180d", value: "180" },
  { label: "All", value: "all" },
];

export default function FilterBar({ selectedTags, onTagsChange, dateRange, onDateRangeChange, color }) {
  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
        {TAGS.map(tag => (
          <TagPill key={tag} tag={tag} color={color}
            active={selectedTags.includes(tag)}
            onClick={() => toggleTag(tag)}
          />
        ))}
        {selectedTags.length > 0 && (
          <button onClick={() => onTagsChange([])} style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 11,
            fontFamily: "'DM Sans', sans-serif", border: "1px solid rgba(0,0,0,0.1)",
            background: "transparent", color: "#999", cursor: "pointer",
          }}>Clear tags</button>
        )}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {DATE_RANGES.map(r => (
          <button key={r.value} onClick={() => onDateRangeChange(r.value)} style={{
            padding: "4px 12px", borderRadius: 6, fontSize: 12,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
            border: dateRange === r.value ? `1.5px solid ${color}` : "1.5px solid rgba(0,0,0,0.1)",
            background: dateRange === r.value ? `${color}15` : "transparent",
            color: dateRange === r.value ? color : "#666",
            fontWeight: dateRange === r.value ? 600 : 400,
            transition: "all 0.2s",
          }}>{r.label}</button>
        ))}
      </div>
    </div>
  );
}
