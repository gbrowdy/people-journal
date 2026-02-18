import { useState } from "react";
import EntryCard from "../components/EntryCard";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import { matchesSearch, matchesFilters } from "../utils";
import TrendChart from "../components/TrendChart";

export default function PersonView({ member, entries, onBack, onNewEntry, onSelectEntry, onUpdate, onPrep }) {
  const mEntries = entries
    .filter(e => e.member_id === member.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const avgMorale = mEntries.length
    ? (mEntries.reduce((s, e) => s + (e.morale_score || 0), 0) / mEntries.length).toFixed(1)
    : "\u2014";
  const avgGrowth = mEntries.length
    ? (mEntries.reduce((s, e) => s + (e.growth_score || 0), 0) / mEntries.length).toFixed(1)
    : "\u2014";

  const openItems = mEntries.flatMap(e => [
    ...(e.action_items_mine || []).map((a, i) => ({
      ...a, field: "action_items_mine", index: i, entryId: e.id, date: e.date,
    })).filter(a => !a.completed),
    ...(e.action_items_theirs || []).map((a, i) => ({
      ...a, field: "action_items_theirs", index: i, entryId: e.id, date: e.date,
    })).filter(a => !a.completed),
  ]);
  const openMine = openItems.filter(a => a.field === "action_items_mine");
  const openTheirs = openItems.filter(a => a.field === "action_items_theirs");
  const [savingItems, setSavingItems] = useState(new Set());
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [dateRange, setDateRange] = useState("all");

  const filteredEntries = mEntries.filter(e =>
    matchesSearch(e, search) && matchesFilters(e, { tags: selectedTags, dateRange })
  );

  const toggleItem = async (item) => {
    const key = `${item.entryId}:${item.field}:${item.index}`;
    setSavingItems(prev => new Set([...prev, key]));
    const entry = mEntries.find(e => e.id === item.entryId);
    const items = [...entry[item.field]];
    items[item.index] = { ...items[item.index], completed: true };
    await onUpdate(item.entryId, { [item.field]: items });
    setSavingItems(prev => { const next = new Set(prev); next.delete(key); return next; });
  };

  const formatShortDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onPrep} style={{
            padding: "8px 16px", borderRadius: 8,
            background: `${member.color}15`, color: member.color,
            border: `1px solid ${member.color}30`,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>Prep</button>
          <button onClick={onNewEntry} style={{
            padding: "8px 20px", borderRadius: 8,
            background: member.color, color: "white", border: "none",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>+ New Entry</button>
        </div>
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

        {mEntries.length >= 2 && (
          <div style={{ marginBottom: 28 }}>
            <TrendChart entries={mEntries} color={member.color} />
          </div>
        )}

        {(openMine.length > 0 || openTheirs.length > 0) && (
          <div style={{
            background: "white", borderRadius: 12, padding: 20,
            border: "1px solid rgba(0,0,0,0.06)", marginBottom: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, margin: 0 }}>
                Open Action Items
              </h2>
              <span style={{
                fontSize: 11, fontWeight: 600, background: `${member.color}20`, color: member.color,
                padding: "1px 8px", borderRadius: 10,
              }}>{openMine.length + openTheirs.length}</span>
            </div>

            {openMine.length > 0 && (
              <div style={{ marginBottom: openTheirs.length > 0 ? 14 : 0 }}>
                <span style={{ fontSize: 10, background: "#3D405B", color: "white", padding: "1px 6px", borderRadius: 4 }}>YOU</span>
                {openMine.map((item, i) => {
                  const saving = savingItems.has(`${item.entryId}:${item.field}:${item.index}`);
                  return (
                    <div key={`${item.entryId}:${item.field}:${item.index}`} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4, opacity: saving ? 0.4 : 1, transition: "opacity 0.2s" }}>
                      <input type="checkbox" checked={false} onChange={() => toggleItem(item)} disabled={saving}
                        style={{ marginTop: 3, cursor: saving ? "default" : "pointer", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5, flex: 1 }}>{item.text}</span>
                      {saving
                        ? <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic", flexShrink: 0 }}>Saving...</span>
                        : <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>{formatShortDate(item.date)}</span>
                      }
                    </div>
                  );
                })}
              </div>
            )}

            {openTheirs.length > 0 && (
              <div>
                <span style={{ fontSize: 10, background: member.color, color: "white", padding: "1px 6px", borderRadius: 4 }}>THEM</span>
                {openTheirs.map((item, i) => {
                  const saving = savingItems.has(`${item.entryId}:${item.field}:${item.index}`);
                  return (
                    <div key={`${item.entryId}:${item.field}:${item.index}`} style={{ display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", paddingLeft: 4, opacity: saving ? 0.4 : 1, transition: "opacity 0.2s" }}>
                      <input type="checkbox" checked={false} onChange={() => toggleItem(item)} disabled={saving}
                        style={{ marginTop: 3, cursor: saving ? "default" : "pointer", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, color: "#444", lineHeight: 1.5, flex: 1 }}>{item.text}</span>
                      {saving
                        ? <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic", flexShrink: 0 }}>Saving...</span>
                        : <span style={{ fontSize: 11, color: "#bbb", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", flexShrink: 0 }}>{formatShortDate(item.date)}</span>
                      }
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mEntries.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SearchBar value={search} onChange={setSearch} placeholder={`Search ${member.name}'s entries...`} />
            <div style={{ marginTop: 10 }}>
              <FilterBar
                selectedTags={selectedTags} onTagsChange={setSelectedTags}
                dateRange={dateRange} onDateRangeChange={setDateRange}
                color={member.color}
              />
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
            <h2 style={{ fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>
              Timeline
              {(search || selectedTags.length > 0 || dateRange !== "all") && (
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 8 }}>
                  ({filteredEntries.length} of {mEntries.length})
                </span>
              )}
            </h2>
            {filteredEntries.length > 0 ? filteredEntries.map(entry => (
              <EntryCard key={entry.id} entry={entry} member={member}
                onClick={() => onSelectEntry(entry)}
              />
            )) : (
              <p style={{ fontSize: 13, color: "#ccc", fontStyle: "italic", textAlign: "center", padding: 20 }}>No entries match your filters.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
