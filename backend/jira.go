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
	Carryover       int `json:"carryover"`
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

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("jira: %s %s returned %d: %s", method, path, resp.StatusCode, string(data))
	}

	return data, nil
}

// ─── User Search ────────────────────────────────────────

func resolveJIRAUser(displayName string) (string, error) {
	path := "/rest/api/3/user/search?query=" + url.QueryEscape(displayName)

	data, err := jiraRequest("GET", path, nil)
	if err != nil {
		return "", fmt.Errorf("jira user search failed: %w", err)
	}

	var users []map[string]any
	if err := json.Unmarshal(data, &users); err != nil {
		return "", fmt.Errorf("jira: failed to parse user search response: %w", err)
	}

	// Filter to active users only
	var activeUsers []map[string]any
	for _, u := range users {
		active, _ := u["active"].(bool)
		if active {
			activeUsers = append(activeUsers, u)
		}
	}

	if len(activeUsers) == 0 {
		return "", fmt.Errorf("jira: no active users found for %q", displayName)
	}

	// Try exact match (case-insensitive) first
	for _, u := range activeUsers {
		name := stringField(u, "displayName")
		if strings.EqualFold(name, displayName) {
			return stringField(u, "accountId"), nil
		}
	}

	// Fall back to first active user
	return stringField(activeUsers[0], "accountId"), nil
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

func parseJIRAIssue(issue map[string]any) JIRATicket {
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

	// Epic name: try customfield_10014
	if epicName := stringField(fields, "customfield_10014"); epicName != "" {
		ticket.EpicName = epicName
	}

	return ticket
}

func extractStoryPoints(issue map[string]any) int {
	fields, _ := issue["fields"].(map[string]any)
	if fields == nil {
		return 0
	}

	// Try story_points first
	if sp, ok := fields["story_points"]; ok && sp != nil {
		if f, ok := sp.(float64); ok && f > 0 {
			return int(f)
		}
	}

	// Fall back to customfield_10016
	if sp, ok := fields["customfield_10016"]; ok && sp != nil {
		if f, ok := sp.(float64); ok && f > 0 {
			return int(f)
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

// ─── Activity Fetch ─────────────────────────────────────

func fetchJIRAActivity(accountID, sinceDate string) (JIRAContext, error) {
	ctx := JIRAContext{
		Assigned:    []JIRATicket{},
		Completed:   []JIRATicket{},
		Blocked:     []JIRATicket{},
		JIRABaseURL: strings.TrimRight(getEnvNonEmpty("JIRA_BASE_URL"), "/"),
	}

	fields := []string{"summary", "status", "priority", "flagged", "customfield_10014", "story_points", "customfield_10016"}

	// Query 1: Assigned in open sprints
	assignedJQL := fmt.Sprintf(`assignee = "%s" AND sprint in openSprints() ORDER BY status ASC, rank ASC`, accountID)
	assignedIssues, err := searchJIRA(assignedJQL, fields)
	if err != nil {
		log.Printf("JIRA: failed to fetch assigned issues: %v", err)
	}

	var totalCommitted, totalCompleted int

	for _, issue := range assignedIssues {
		ticket := parseJIRAIssue(issue)
		points := extractStoryPoints(issue)

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
		ticket := parseJIRAIssue(issue)
		ctx.Completed = append(ctx.Completed, ticket)
	}

	// Calculate sprint stats if we have any data
	if len(assignedIssues) > 0 || len(completedIssues) > 0 {
		carryover := totalCommitted - totalCompleted
		if carryover < 0 {
			carryover = 0
		}
		ctx.SprintStats = &JIRASprintStats{
			PointsCommitted: totalCommitted,
			PointsCompleted: totalCompleted,
			Carryover:       carryover,
		}
	}

	return ctx, nil
}
