package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
)

type PrepResponse struct {
	Briefing           string           `json:"briefing"`
	OpenItemsMine      []PrepActionItem `json:"open_items_mine"`
	OpenItemsTheirs    []PrepActionItem `json:"open_items_theirs"`
	RecentTags         []TagCount       `json:"recent_tags"`
	UnresolvedBlockers []string         `json:"unresolved_blockers"`
	MoraleScores       []ScorePoint     `json:"morale_scores"`
	GrowthScores       []ScorePoint     `json:"growth_scores"`
}

type PrepActionItem struct {
	Text string `json:"text"`
	Date string `json:"date"`
}

type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

type ScorePoint struct {
	Date  string `json:"date"`
	Score int    `json:"score"`
}

func buildPrepPrompt(memberName string, entries []Entry) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf(
		"You are helping an engineering manager prepare for a 1:1 meeting with %s. "+
			"Below are the last %d meeting entries (newest first). "+
			"Generate a concise bullet-point briefing with these three sections:\n\n"+
			"**Follow up on** — open action items and unresolved topics to revisit\n"+
			"**Watch for** — morale/growth concerns or patterns worth probing\n"+
			"**Talking points** — suggested things to bring up\n\n"+
			"Keep bullets short and scannable. No narrative prose. "+
			"Respond ONLY with the three sections and their bullets, using markdown formatting.\n\n",
		memberName, len(entries),
	))

	for i, e := range entries {
		sb.WriteString(fmt.Sprintf("--- Entry %d (%s) ---\n", i+1, e.Date))
		if e.Summary != nil {
			sb.WriteString(fmt.Sprintf("Summary: %s\n", *e.Summary))
		}
		if e.MoraleScore != nil {
			sb.WriteString(fmt.Sprintf("Morale: %d/5", *e.MoraleScore))
			if e.MoraleRationale != nil {
				sb.WriteString(fmt.Sprintf(" (%s)", *e.MoraleRationale))
			}
			sb.WriteString("\n")
		}
		if e.GrowthScore != nil {
			sb.WriteString(fmt.Sprintf("Growth: %d/5", *e.GrowthScore))
			if e.GrowthRationale != nil {
				sb.WriteString(fmt.Sprintf(" (%s)", *e.GrowthRationale))
			}
			sb.WriteString("\n")
		}
		if len(e.Tags) > 0 {
			sb.WriteString(fmt.Sprintf("Tags: %s\n", strings.Join(e.Tags, ", ")))
		}
		if len(e.ActionItemsMine) > 0 {
			sb.WriteString("My action items:\n")
			for _, a := range e.ActionItemsMine {
				status := "[ ]"
				if a.Completed {
					status = "[x]"
				}
				sb.WriteString(fmt.Sprintf("  %s %s\n", status, a.Text))
			}
		}
		if len(e.ActionItemsTheirs) > 0 {
			sb.WriteString(fmt.Sprintf("%s's action items:\n", memberName))
			for _, a := range e.ActionItemsTheirs {
				status := "[ ]"
				if a.Completed {
					status = "[x]"
				}
				sb.WriteString(fmt.Sprintf("  %s %s\n", status, a.Text))
			}
		}
		if len(e.Blockers) > 0 {
			sb.WriteString(fmt.Sprintf("Blockers: %s\n", strings.Join(e.Blockers, "; ")))
		}
		if len(e.Wins) > 0 {
			sb.WriteString(fmt.Sprintf("Wins: %s\n", strings.Join(e.Wins, "; ")))
		}
		if len(e.NotableQuotes) > 0 {
			sb.WriteString(fmt.Sprintf("Notable quotes: %s\n", strings.Join(e.NotableQuotes, "; ")))
		}
		sb.WriteString("\n")
	}

	return sb.String()
}

func computeStructuredPrep(entries []Entry) ([]PrepActionItem, []PrepActionItem, []TagCount, []string, []ScorePoint, []ScorePoint) {
	var openMine, openTheirs []PrepActionItem
	tagCounts := map[string]int{}
	var blockers []string
	var moraleScores, growthScores []ScorePoint

	for _, e := range entries {
		for _, a := range e.ActionItemsMine {
			if !a.Completed {
				openMine = append(openMine, PrepActionItem{Text: a.Text, Date: e.Date})
			}
		}
		for _, a := range e.ActionItemsTheirs {
			if !a.Completed {
				openTheirs = append(openTheirs, PrepActionItem{Text: a.Text, Date: e.Date})
			}
		}
		for _, t := range e.Tags {
			tagCounts[t]++
		}
		blockers = append(blockers, e.Blockers...)
		if e.MoraleScore != nil {
			moraleScores = append(moraleScores, ScorePoint{Date: e.Date, Score: *e.MoraleScore})
		}
		if e.GrowthScore != nil {
			growthScores = append(growthScores, ScorePoint{Date: e.Date, Score: *e.GrowthScore})
		}
	}

	var tags []TagCount
	for t, c := range tagCounts {
		tags = append(tags, TagCount{Tag: t, Count: c})
	}
	sort.Slice(tags, func(i, j int) bool { return tags[i].Count > tags[j].Count })

	return openMine, openTheirs, tags, blockers, moraleScores, growthScores
}

func handlePrep(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MemberID string `json:"member_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, 400, map[string]string{"error": "invalid json"})
		return
	}
	if body.MemberID == "" {
		writeJSON(w, 400, map[string]string{"error": "member_id is required"})
		return
	}

	// Fetch member name
	var memberName string
	err := DB.QueryRow("SELECT name FROM team_members WHERE id = ?", body.MemberID).Scan(&memberName)
	if err != nil {
		writeJSON(w, 404, map[string]string{"error": "member not found"})
		return
	}

	// Fetch last 5 entries
	rows, err := DB.Query(
		fmt.Sprintf("SELECT %s FROM entries WHERE member_id = ? ORDER BY date DESC LIMIT 5", entryCols),
		body.MemberID,
	)
	if err != nil {
		writeJSON(w, 500, map[string]string{"error": "db error"})
		return
	}
	defer rows.Close()

	var entries []Entry
	for rows.Next() {
		e, err := scanEntry(rows)
		if err != nil {
			continue
		}
		entries = append(entries, e)
	}

	if len(entries) == 0 {
		writeJSON(w, 200, PrepResponse{Briefing: "No entries yet for this team member."})
		return
	}

	// Build cache key from member ID + entry IDs + updated_at
	keyParts := []string{body.MemberID}
	for _, e := range entries {
		keyParts = append(keyParts, e.ID)
		if e.UpdatedAt != nil {
			keyParts = append(keyParts, *e.UpdatedAt)
		}
	}
	key := cacheKey(keyParts...)

	// Check cache
	if cached, ok := cacheGet(key, "prep"); ok {
		var result PrepResponse
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			writeJSON(w, 200, result)
			return
		}
	}

	// Compute structured data
	openMine, openTheirs, tags, blockers, moraleScores, growthScores := computeStructuredPrep(entries)

	// Call AI for briefing
	prompt := buildPrepPrompt(memberName, entries)

	var briefingText string
	var aiErr error

	anthropicKey := getEnvNonEmpty("ANTHROPIC_API_KEY")
	openaiKey := getEnvNonEmpty("OPENAI_API_KEY")

	if anthropicKey != "" {
		briefingText, aiErr = extractWithAnthropic(prompt)
	} else if openaiKey != "" {
		briefingText, aiErr = extractWithOpenAI(prompt)
	} else {
		// No API key — return structured data without briefing
		resp := PrepResponse{
			Briefing:           "No API key configured. Showing structured data only.",
			OpenItemsMine:      openMine,
			OpenItemsTheirs:    openTheirs,
			RecentTags:         tags,
			UnresolvedBlockers: blockers,
			MoraleScores:       moraleScores,
			GrowthScores:       growthScores,
		}
		writeJSON(w, 200, resp)
		return
	}

	if aiErr != nil {
		fmt.Println("Prep briefing generation failed:", aiErr)
		briefingText = "Failed to generate AI briefing. Showing structured data only."
	}

	resp := PrepResponse{
		Briefing:           strings.TrimSpace(briefingText),
		OpenItemsMine:      openMine,
		OpenItemsTheirs:    openTheirs,
		RecentTags:         tags,
		UnresolvedBlockers: blockers,
		MoraleScores:       moraleScores,
		GrowthScores:       growthScores,
	}

	// Cache the response
	respJSON, _ := json.Marshal(resp)
	cacheSet(key, "prep", string(respJSON))

	writeJSON(w, 200, resp)
}
