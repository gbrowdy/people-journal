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

export function fetchTeam() {
  return request("/api/team");
}

export function createTeamMember(data) {
  return request("/api/team", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTeamMember(id, data) {
  return request(`/api/team/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTeamMember(id) {
  return request(`/api/team/${id}`, { method: "DELETE" });
}

export function fetchEntries(memberId) {
  const query = memberId ? `?member_id=${memberId}` : "";
  return request(`/api/entries${query}`);
}

export function fetchEntry(id) {
  return request(`/api/entries/${id}`);
}

export function createEntry(data) {
  return request("/api/entries", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteEntry(id) {
  return request(`/api/entries/${id}`, { method: "DELETE" });
}

export function updateEntry(id, data) {
  return request(`/api/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function extractTranscript(transcript, memberName) {
  return request("/api/extract", {
    method: "POST",
    body: JSON.stringify({ transcript, member_name: memberName }),
  });
}

export function fetchConfig() {
  return request("/api/config");
}

export function fetchPrep(memberId) {
  return request("/api/prep", {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}
