export function matchesSearch(entry, query) {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase();
  const fields = [
    entry.summary,
    entry.private_note,
    ...(entry.wins || []),
    ...(entry.blockers || []),
    ...(entry.notable_quotes || []),
    ...(entry.action_items_mine || []).map(a => typeof a === "string" ? a : a.text),
    ...(entry.action_items_theirs || []).map(a => typeof a === "string" ? a : a.text),
  ];
  return fields.some(f => f && f.toLowerCase().includes(q));
}

export function matchesFilters(entry, { tags, dateRange }) {
  if (tags && tags.length > 0) {
    if (!entry.tags || !entry.tags.some(t => tags.includes(t))) return false;
  }
  if (dateRange && dateRange !== "all") {
    const days = parseInt(dateRange, 10);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    if (new Date(entry.date) < cutoff) return false;
  }
  return true;
}
