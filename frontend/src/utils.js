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
