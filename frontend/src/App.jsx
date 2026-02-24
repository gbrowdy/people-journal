import { useState, useEffect, useCallback } from "react";
import * as api from "./api";
import Dashboard from "./views/Dashboard";
import PersonView from "./views/PersonView";
import NewEntry from "./views/NewEntry";
import ReviewEntry from "./views/ReviewEntry";
import EntryDetail from "./views/EntryDetail";
import Settings from "./views/Settings";
import PrepView from "./views/PrepView";

const pageStyle = {
  minHeight: "100vh",
  background: "#FAFAF8",
  fontFamily: "'DM Sans', sans-serif",
  color: "#1a1a1a",
};

export default function App() {
  const [team, setTeam] = useState([]);
  const [entries, setEntries] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selectedMember, setSelectedMember] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [transcript, setTranscript] = useState(null);
  const [config, setConfig] = useState({});
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [teamData, entriesData, configData] = await Promise.all([
        api.fetchTeam(),
        api.fetchEntries(),
        api.fetchConfig().catch(() => ({})),
      ]);
      setTeam(teamData);
      setEntries(entriesData);
      setConfig(configData);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data. Is the backend running?");
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExtract = async (transcriptText, memberName) => {
    setError(null);
    const data = await api.extractTranscript(transcriptText, memberName);
    setExtractedData(data);
    setTranscript(transcriptText);
    setView("review");
    return data;
  };

  const handleSaveEntry = async (data) => {
    setError(null);
    try {
      const wrapItems = (items) => (items || []).map(item =>
        typeof item === "string" ? { text: item, completed: false } : item
      );
      await api.createEntry({
        member_id: selectedMember.id,
        date: new Date().toISOString(),
        ...data,
        action_items_mine: wrapItems(data.action_items_mine),
        action_items_theirs: wrapItems(data.action_items_theirs),
        transcript,
      });
      await loadData();
      setExtractedData(null);
      setTranscript(null);
      setView("person");
    } catch (err) {
      console.error("Failed to save entry:", err);
      setError("Failed to save entry. Please try again.");
    }
  };

  const handleDeleteEntry = async (entryId) => {
    setError(null);
    try {
      await api.deleteEntry(entryId);
      await loadData();
      setSelectedEntry(null);
      setView("person");
    } catch (err) {
      console.error("Failed to delete entry:", err);
      setError("Failed to delete entry. Please try again.");
    }
  };

  const handleUpdateEntry = async (entryId, updates) => {
    setError(null);
    try {
      const updated = await api.updateEntry(entryId, updates);
      await loadData();
      setSelectedEntry(updated);
    } catch (err) {
      console.error("Failed to update entry:", err);
      setError("Failed to update entry. Please try again.");
    }
  };

  const handleSaveTeam = async ({ updated, added, deleted }) => {
    setError(null);
    try {
      const results = await Promise.allSettled([
        ...updated.map(m => api.updateTeamMember(m.id, { name: m.name, role: m.role, color: m.color, jira_account_id: m.jira_account_id })),
        ...added.map(m => api.createTeamMember({ name: m.name, role: m.role, color: m.color })),
        ...deleted.map(id => api.deleteTeamMember(id)),
      ]);
      const failures = results.filter(r => r.status === "rejected");
      if (failures.length > 0) {
        console.error("Some team operations failed:", failures);
        setError(`${failures.length} team operation(s) failed. Some changes may have been saved.`);
      }
      await loadData();
      setView("dashboard");
    } catch (err) {
      console.error("Failed to save team:", err);
      setError("Failed to save team changes. Please try again.");
    }
  };

  return (
    <div style={pageStyle}>
      {error && (
        <div style={{
          padding: "12px 32px", background: "#FEE2E2", color: "#991B1B",
          fontFamily: "'DM Sans', sans-serif", fontSize: 14,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{
            background: "none", border: "none", color: "#991B1B",
            cursor: "pointer", fontSize: 18, padding: "0 4px",
          }}>&times;</button>
        </div>
      )}
      {view === "dashboard" && (
        <Dashboard
          team={team} entries={entries}
          onSelectMember={m => { setSelectedMember(m); setView("person"); }}
          onNewEntry={() => { setSelectedMember(null); setView("new"); }}
          onOpenSettings={() => setView("settings")}
          onSelectEntry={(entry, member) => { setSelectedMember(member); setSelectedEntry(entry); setView("entry-detail"); }}
          onPrep={m => { setSelectedMember(m); setView("prep"); }}
        />
      )}
      {view === "person" && selectedMember && (
        <PersonView
          member={selectedMember} entries={entries}
          onBack={() => setView("dashboard")}
          onNewEntry={() => setView("new")}
          onSelectEntry={entry => { setSelectedEntry(entry); setView("entry-detail"); }}
          onUpdate={handleUpdateEntry}
          onPrep={() => setView("prep")}
          config={config}
        />
      )}
      {view === "new" && (
        <NewEntry
          team={team} selectedMember={selectedMember}
          onSelectMember={setSelectedMember}
          onExtract={handleExtract}
          onBack={() => setView(selectedMember ? "person" : "dashboard")}
        />
      )}
      {view === "review" && extractedData && selectedMember && (
        <ReviewEntry
          member={selectedMember} extractedData={extractedData}
          onSave={handleSaveEntry}
          onBack={() => setView("new")}
        />
      )}
      {view === "entry-detail" && selectedEntry && selectedMember && (
        <EntryDetail
          entry={selectedEntry} member={selectedMember}
          onBack={() => setView("person")}
          onDelete={handleDeleteEntry}
          onUpdate={handleUpdateEntry}
        />
      )}
      {view === "prep" && selectedMember && (
        <PrepView
          member={selectedMember}
          onBack={() => setView("person")}
          onMemberUpdated={loadData}
        />
      )}
      {view === "settings" && (
        <Settings
          team={team}
          onSave={handleSaveTeam}
          onBack={() => setView("dashboard")}
        />
      )}
    </div>
  );
}
