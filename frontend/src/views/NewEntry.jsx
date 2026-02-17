import { useState, useRef } from "react";

export default function NewEntry({ team, selectedMember, onSelectMember, onExtract, onBack }) {
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setTranscript(ev.target.result);
    reader.readAsText(file);
  };

  const handleProcess = async () => {
    if (!transcript.trim() || !selectedMember) return;
    setProcessing(true);
    setError(null);
    try {
      await onExtract(transcript, selectedMember.name);
    } catch (e) {
      setError("Failed to process transcript. Please check your connection and try again.");
      console.error(e);
    }
    setProcessing(false);
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
          <h1 style={{ fontSize: 20, fontFamily: "'Fraunces', serif", fontWeight: 600, margin: 0 }}>New 1:1 Entry</h1>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Team Member</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {team.map(m => (
              <button key={m.id} onClick={() => onSelectMember(m)} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px", borderRadius: 10,
                border: selectedMember?.id === m.id ? `2px solid ${m.color}` : "2px solid rgba(0,0,0,0.08)",
                background: selectedMember?.id === m.id ? `${m.color}10` : "white",
                cursor: "pointer", transition: "all 0.2s",
                fontFamily: "'DM Sans', sans-serif", fontSize: 14,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", background: m.color,
                  color: "white", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{m.name.charAt(0)}</div>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Transcript</span>
            <div>
              <input type="file" ref={fileInputRef} accept=".txt,.doc,.md,.vtt,.srt" onChange={handleFileUpload} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} style={{
                fontSize: 12, color: "#666", background: "none", border: "1px solid rgba(0,0,0,0.1)",
                padding: "4px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              }}>
                Upload file
              </button>
            </div>
          </div>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)}
            placeholder="Paste your Google Meet transcript here, or upload a file..."
            style={{
              width: "100%", minHeight: 240, padding: 16, borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.1)", fontSize: 14,
              fontFamily: "'DM Mono', monospace", lineHeight: 1.7,
              background: "white", resize: "vertical", boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: "12px 16px", borderRadius: 8, marginBottom: 16,
            background: "#FFF0F0", border: "1px solid rgba(220,60,60,0.15)",
            color: "#c33", fontSize: 13,
          }}>{error}</div>
        )}

        <button onClick={handleProcess}
          disabled={!transcript.trim() || !selectedMember || processing}
          style={{
            padding: "14px 32px", borderRadius: 10,
            background: (!transcript.trim() || !selectedMember || processing) ? "#ccc" : "#1a1a1a",
            color: "white", border: "none",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 15,
            cursor: (!transcript.trim() || !selectedMember || processing) ? "default" : "pointer",
            transition: "all 0.2s",
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          {processing ? (
            <>
              <span style={{
                display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)",
                borderTopColor: "white", borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              Processing...
            </>
          ) : "Extract & Review"}
        </button>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </>
  );
}
