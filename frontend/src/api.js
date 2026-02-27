const IS_TAURI = Boolean(window.__TAURI_INTERNALS__);

let invoke;
if (IS_TAURI) {
  invoke = (await import("@tauri-apps/api/core")).invoke;
}

// ─── HTTP backend (Go) ─────────────────────────────────

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── API functions ──────────────────────────────────────

export function fetchTeam() {
  if (IS_TAURI) return invoke("get_team");
  return request("/api/team");
}

export function createTeamMember(data) {
  if (IS_TAURI) return invoke("create_team_member", { data });
  return request("/api/team", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTeamMember(id, data) {
  if (IS_TAURI) return invoke("update_team_member", { id, data });
  return request(`/api/team/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTeamMember(id) {
  if (IS_TAURI) return invoke("delete_team_member", { id });
  return request(`/api/team/${id}`, { method: "DELETE" });
}

export function fetchEntries(memberId) {
  if (IS_TAURI) return invoke("get_entries", { memberId: memberId || null });
  const query = memberId ? `?member_id=${memberId}` : "";
  return request(`/api/entries${query}`);
}

export function fetchEntry(id) {
  if (IS_TAURI) return invoke("get_entry", { id });
  return request(`/api/entries/${id}`);
}

export function createEntry(data) {
  if (IS_TAURI) return invoke("create_entry", { data });
  return request("/api/entries", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteEntry(id) {
  if (IS_TAURI) return invoke("delete_entry", { id });
  return request(`/api/entries/${id}`, { method: "DELETE" });
}

export function updateEntry(id, data) {
  if (IS_TAURI) return invoke("update_entry", { id, data });
  return request(`/api/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function extractTranscript(transcript, memberName) {
  if (IS_TAURI) return invoke("extract_transcript", { transcript, memberName });
  return request("/api/extract", {
    method: "POST",
    body: JSON.stringify({ transcript, member_name: memberName }),
  });
}

export function fetchConfig() {
  if (IS_TAURI) return invoke("get_config");
  return request("/api/config");
}

export function updatePrepNotes(memberId, prepNotes) {
  if (IS_TAURI) return invoke("update_prep_notes", { memberId, prepNotes });
  return request(`/api/team/${memberId}/prep-notes`, {
    method: "PUT",
    body: JSON.stringify({ prep_notes: prepNotes }),
  });
}

export function fetchPrep(memberId, { force = false } = {}) {
  if (IS_TAURI) return invoke("fetch_prep", { memberId, force });
  return request("/api/prep", {
    method: "POST",
    body: JSON.stringify({ member_id: memberId, force }),
  });
}
