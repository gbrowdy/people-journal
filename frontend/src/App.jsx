import { useState, useEffect, useCallback } from "react";
import * as api from "./api";
import Dashboard from "./views/Dashboard";
import PersonView from "./views/PersonView";
import NewEntry from "./views/NewEntry";
import ReviewEntry from "./views/ReviewEntry";
import EntryDetail from "./views/EntryDetail";
import Settings from "./views/Settings";

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

  const loadData = useCallback(async () => {
    const [teamData, entriesData] = await Promise.all([
      api.fetchTeam(),
      api.fetchEntries(),
    ]);
    setTeam(teamData);
    setEntries(entriesData);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExtract = async (transcript, memberName) => {
    const data = await api.extractTranscript(transcript, memberName);
    setExtractedData(data);
    setView("review");
    return data;
  };

  const handleSaveEntry = async (data) => {
    await api.createEntry({
      member_id: selectedMember.id,
      date: new Date().toISOString(),
      ...data,
    });
    await loadData();
    setExtractedData(null);
    setView("person");
  };

  const handleDeleteEntry = async (entryId) => {
    await api.deleteEntry(entryId);
    await loadData();
    setSelectedEntry(null);
    setView("person");
  };

  const handleUpdateEntry = async (entryId, updates) => {
    const updated = await api.updateEntry(entryId, updates);
    await loadData();
    setSelectedEntry(updated);
  };

  const handleSaveTeam = async ({ updated, added, deleted }) => {
    await Promise.all([
      ...updated.map(m => api.updateTeamMember(m.id, { name: m.name, role: m.role, color: m.color })),
      ...added.map(m => api.createTeamMember({ name: m.name, role: m.role, color: m.color })),
      ...deleted.map(id => api.deleteTeamMember(id)),
    ]);
    await loadData();
    setView("dashboard");
  };

  return (
    <div style={pageStyle}>
      {view === "dashboard" && (
        <Dashboard
          team={team} entries={entries}
          onSelectMember={m => { setSelectedMember(m); setView("person"); }}
          onNewEntry={() => { setSelectedMember(null); setView("new"); }}
          onOpenSettings={() => setView("settings")}
          onSelectEntry={(entry, member) => { setSelectedMember(member); setSelectedEntry(entry); setView("entry-detail"); }}
        />
      )}
      {view === "person" && selectedMember && (
        <PersonView
          member={selectedMember} entries={entries}
          onBack={() => setView("dashboard")}
          onNewEntry={() => setView("new")}
          onSelectEntry={entry => { setSelectedEntry(entry); setView("entry-detail"); }}
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
