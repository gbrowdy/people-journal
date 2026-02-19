package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// ─── JIRA Data Types ────────────────────────────────────

type JIRATicket struct {
	Key      string `json:"key"`
	Summary  string `json:"summary"`
	Status   string `json:"status"`
	Flagged  bool   `json:"flagged"`
	EpicName string `json:"epic_name,omitempty"`
}

type JIRASprintStats struct {
	PointsCommitted int `json:"points_committed"`
	PointsCompleted int `json:"points_completed"`
}

type JIRAContext struct {
	Assigned    []JIRATicket     `json:"jira_assigned"`
	Completed   []JIRATicket     `json:"jira_completed"`
	Blocked     []JIRATicket     `json:"jira_blocked"`
	SprintStats *JIRASprintStats `json:"jira_sprint_stats,omitempty"`
	JIRABaseURL string           `json:"-"`
}

// ─── Configuration ──────────────────────────────────────

func jiraConfigured() bool {
	return getEnvNonEmpty("JIRA_BASE_URL") != "" &&
		getEnvNonEmpty("JIRA_EMAIL") != "" &&
		getEnvNonEmpty("JIRA_API_TOKEN") != ""
}

// ─── HTTP Client ────────────────────────────────────────

func jiraRequest(method, path string, body io.Reader) ([]byte, error) {
	baseURL := strings.TrimRight(getEnvNonEmpty("JIRA_BASE_URL"), "/")
	email := getEnvNonEmpty("JIRA_EMAIL")
	token := getEnvNonEmpty("JIRA_API_TOKEN")

	fullURL := baseURL + path
	log.Printf("[JIRA] %s %s", method, fullURL)

	req, err := http.NewRequest(method, fullURL, body)
	if err != nil {
		return nil, fmt.Errorf("jira: failed to create request: %w", err)
	}

	req.SetBasicAuth(email, token)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("jira: request failed: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("jira: failed to read response: %w", err)
	}

	log.Printf("[JIRA] %s %s → %d (%d bytes)", method, path, resp.StatusCode, len(data))

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("jira: %s %s returned %d: %s", method, path, resp.StatusCode, string(data))
	}

	return data, nil
}

// ─── User Search ────────────────────────────────────────

func resolveJIRAUser(displayName string) (string, error) {
	log.Printf("[JIRA] Searching for user: %q", displayName)
	path := "/rest/api/3/user/search?query=" + url.QueryEscape(displayName)

	data, err := jiraRequest("GET", path, nil)
	if err != nil {
		return "", fmt.Errorf("jira user search failed: %w", err)
	}

	var users []map[string]any
	if err := json.Unmarshal(data, &users); err != nil {
		return "", fmt.Errorf("jira: failed to parse user search response: %w", err)
	}

	log.Printf("[JIRA] User search returned %d results", len(users))

	// Filter to active users only
	var activeUsers []map[string]any
	for _, u := range users {
		active, _ := u["active"].(bool)
		if active {
			activeUsers = append(activeUsers, u)
		}
	}

	if len(activeUsers) == 0 {
		return "", fmt.Errorf("jira: no active users found for %q (%d total results, none active)", displayName, len(users))
	}

	// Try exact match (case-insensitive) first
	for _, u := range activeUsers {
		name := stringField(u, "displayName")
		if strings.EqualFold(name, displayName) {
			accountID := stringField(u, "accountId")
			log.Printf("[JIRA] Resolved %q → %s (exact match)", displayName, accountID)
			return accountID, nil
		}
	}

	// Fall back to first active user
	accountID := stringField(activeUsers[0], "accountId")
	fallbackName := stringField(activeUsers[0], "displayName")
	log.Printf("[JIRA] No exact match for %q, using first active user: %q (%s)", displayName, fallbackName, accountID)
	return accountID, nil
}

// ─── JQL Search ─────────────────────────────────────────

func searchJIRA(jql string, fields []string) ([]map[string]any, error) {
	reqBody := map[string]any{
		"jql":        jql,
		"fields":     fields,
		"maxResults": 50,
	}
	b, _ := json.Marshal(reqBody)

	data, err := jiraRequest("POST", "/rest/api/3/search/jql", bytes.NewReader(b))
	if err != nil {
		return nil, err
	}

	var result struct {
		Issues []map[string]any `json:"issues"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("jira: failed to parse search response: %w", err)
	}

	return result.Issues, nil
}

// ─── Issue Parsing ──────────────────────────────────────

func parseJIRAIssue(issue map[string]any, epicField string) JIRATicket {
	ticket := JIRATicket{
		Key: stringField(issue, "key"),
	}

	fields, _ := issue["fields"].(map[string]any)
	if fields == nil {
		return ticket
	}

	ticket.Summary = stringField(fields, "summary")

	// Status is nested: fields.status.name
	if statusObj, ok := fields["status"].(map[string]any); ok {
		ticket.Status = stringField(statusObj, "name")
	}

	// Flagged may come as a list — truthy if non-empty
	if flagged, ok := fields["flagged"]; ok && flagged != nil {
		switch v := flagged.(type) {
		case []any:
			ticket.Flagged = len(v) > 0
		case bool:
			ticket.Flagged = v
		}
	}

	// Epic name — field ID discovered dynamically
	if epicName := stringField(fields, epicField); epicName != "" {
		ticket.EpicName = epicName
	}

	return ticket
}

func extractStoryPoints(issue map[string]any, spFields []string) int {
	fields, _ := issue["fields"].(map[string]any)
	if fields == nil {
		return 0
	}

	for _, spField := range spFields {
		if sp, ok := fields[spField]; ok && sp != nil {
			if f, ok := sp.(float64); ok && f > 0 {
				return int(f)
			}
		}
	}

	return 0
}

func stringField(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return s
}

// ─── Field Discovery ────────────────────────────────────

// discoverJIRAFields queries the JIRA field definitions to find the actual
// custom field IDs for story points and epic name, which vary per instance.
// Returns all candidate story points fields (there can be multiple) and one epic name field.
func discoverJIRAFields() (storyPointsFields []string, epicNameField string) {
	epicNameField = "customfield_10014" // fallback

	data, err := jiraRequest("GET", "/rest/api/3/field", nil)
	if err != nil {
		log.Printf("[JIRA] Failed to fetch field definitions: %v", err)
		storyPointsFields = []string{"story_points"}
		return
	}

	var fields []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}
	if err := json.Unmarshal(data, &fields); err != nil {
		log.Printf("[JIRA] Failed to parse field definitions: %v", err)
		storyPointsFields = []string{"story_points"}
		return
	}

	for _, f := range fields {
		nameLower := strings.ToLower(f.Name)
		if nameLower == "story points" || nameLower == "story point estimate" {
			storyPointsFields = append(storyPointsFields, f.ID)
			log.Printf("[JIRA] Discovered story points field: %s (%s)", f.ID, f.Name)
		}
		if nameLower == "epic name" {
			epicNameField = f.ID
			log.Printf("[JIRA] Discovered epic name field: %s (%s)", f.ID, f.Name)
		}
	}

	if len(storyPointsFields) == 0 {
		storyPointsFields = []string{"story_points"}
	}

	return
}

// ─── Activity Fetch ─────────────────────────────────────

func fetchJIRAActivity(accountID, sinceDate string) (JIRAContext, error) {
	ctx := JIRAContext{
		Assigned:    []JIRATicket{},
		Completed:   []JIRATicket{},
		Blocked:     []JIRATicket{},
		JIRABaseURL: strings.TrimRight(getEnvNonEmpty("JIRA_BASE_URL"), "/"),
	}

	// Discover the right field IDs for this JIRA instance
	spFields, epicField := discoverJIRAFields()

	fields := []string{"summary", "status", "priority", "flagged", epicField}
	fields = append(fields, spFields...)

	// Query 1: Assigned in open sprints
	assignedJQL := fmt.Sprintf(`assignee = "%s" AND sprint in openSprints() ORDER BY status ASC, rank ASC`, accountID)
	assignedIssues, err := searchJIRA(assignedJQL, fields)
	if err != nil {
		log.Printf("JIRA: failed to fetch assigned issues: %v", err)
	}

	var totalCommitted, totalCompleted int

	for i, issue := range assignedIssues {
		ticket := parseJIRAIssue(issue, epicField)
		points := extractStoryPoints(issue, spFields)

		// Log field details for the first issue to help debug custom field IDs
		if i == 0 {
			if fields, ok := issue["fields"].(map[string]any); ok {
				var pointFields []string
				for k, v := range fields {
					if v == nil {
						continue
					}
					// Look for anything that might be story points
					if f, ok := v.(float64); ok && f > 0 {
						pointFields = append(pointFields, fmt.Sprintf("%s=%.0f", k, f))
					}
				}
				log.Printf("[JIRA] First issue %s fields with numeric values: %v", ticket.Key, pointFields)
			}
		}

		// Skip Done-status issues from the assigned query
		if strings.EqualFold(ticket.Status, "Done") {
			totalCompleted += points
			totalCommitted += points
			continue
		}

		totalCommitted += points

		if ticket.Flagged {
			ctx.Blocked = append(ctx.Blocked, ticket)
		}
		ctx.Assigned = append(ctx.Assigned, ticket)
	}

	// Query 2: Completed since date
	completedJQL := fmt.Sprintf(`assignee = "%s" AND status = Done AND resolved >= "%s" ORDER BY resolved DESC`, accountID, sinceDate)
	completedIssues, err := searchJIRA(completedJQL, fields)
	if err != nil {
		log.Printf("JIRA: failed to fetch completed issues: %v", err)
	}

	for _, issue := range completedIssues {
		ticket := parseJIRAIssue(issue, epicField)
		ctx.Completed = append(ctx.Completed, ticket)
	}

	// Calculate sprint stats if we have any data
	if len(assignedIssues) > 0 || len(completedIssues) > 0 {
		ctx.SprintStats = &JIRASprintStats{
			PointsCommitted: totalCommitted,
			PointsCompleted: totalCompleted,
		}
	}

	return ctx, nil
}
