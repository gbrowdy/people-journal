package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

var tags = []string{
	"career growth", "blockers", "wins", "feedback given", "feedback received",
	"cross-team", "technical debt", "hiring", "process", "personal", "morale",
	"autonomy", "project update", "conflict", "learning",
}

func getEnvNonEmpty(key string) string {
	v := os.Getenv(key)
	if v == "" || v == "your-key-here" {
		return ""
	}
	return v
}

func buildExtractionPrompt(memberName, transcript string) string {
	return fmt.Sprintf(`You are helping an engineering manager process a 1:1 meeting transcript with their report named %s. Extract structured information and respond ONLY with a JSON object (no markdown, no backticks, no preamble). The JSON should have these fields:

{
  "summary": "2-4 sentence summary of the key discussion points",
  "tags": ["array of relevant tags from this list: %s"],
  "action_items_mine": ["action items for the manager"],
  "action_items_theirs": ["action items for %s"],
  "morale_score": <1-5 integer, your best read on their energy/morale based on tone>,
  "morale_rationale": "1-2 sentence explanation of why you gave this morale score, citing specific things from the conversation",
  "growth_score": <1-5 integer, signals of professional growth or stagnation>,
  "growth_rationale": "1-2 sentence explanation of why you gave this growth score, citing specific things from the conversation",
  "notable_quotes": ["1-2 notable or important things %s said, verbatim if possible"],
  "blockers": ["any blockers or frustrations mentioned"],
  "wins": ["any wins, accomplishments, or positive things mentioned"]
}

Here is the transcript:

%s`, memberName, strings.Join(tags, ", "), memberName, memberName, transcript)
}

func extractWithAnthropic(prompt string) (string, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	body := map[string]any{
		"model":      "claude-sonnet-4-5-20250929",
		"max_tokens": 1000,
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(b))
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")
	req.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic request failed: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("anthropic returned %d: %s", resp.StatusCode, string(data))
	}

	var result struct {
		Content []struct {
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", fmt.Errorf("failed to parse anthropic response: %w", err)
	}

	var texts []string
	for _, c := range result.Content {
		texts = append(texts, c.Text)
	}
	return strings.Join(texts, ""), nil
}

func extractWithOpenAI(prompt string) (string, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	body := map[string]any{
		"model":      "gpt-4o",
		"max_tokens": 1000,
		"messages":   []map[string]string{{"role": "user", "content": prompt}},
	}
	b, _ := json.Marshal(body)

	req, _ := http.NewRequest("POST", "https://api.openai.com/v1/chat/completions", bytes.NewReader(b))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("openai returned %d: %s", resp.StatusCode, string(data))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return "", fmt.Errorf("failed to parse openai response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("openai returned no choices")
	}
	return result.Choices[0].Message.Content, nil
}

func handleExtract(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Transcript string `json:"transcript"`
		MemberName string `json:"member_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, `{"error":"invalid json"}`, 400)
		return
	}

	if body.Transcript == "" || body.MemberName == "" {
		writeJSON(w, 400, map[string]string{"error": "transcript and member_name are required"})
		return
	}

	// Check cache
	extractKey := cacheKey(body.MemberName, body.Transcript)
	if cached, ok := cacheGet(extractKey, "extract"); ok {
		var result map[string]any
		if err := json.Unmarshal([]byte(cached), &result); err == nil {
			writeJSON(w, 200, result)
			return
		}
	}

	anthropicKey := getEnvNonEmpty("ANTHROPIC_API_KEY")
	openaiKey := getEnvNonEmpty("OPENAI_API_KEY")
	hasAnthropic := anthropicKey != ""
	hasOpenAI := openaiKey != ""

	if !hasAnthropic && !hasOpenAI {
		writeJSON(w, 500, map[string]string{"error": "No API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env"})
		return
	}

	prompt := buildExtractionPrompt(body.MemberName, body.Transcript)

	var text string
	var err error
	if hasAnthropic {
		text, err = extractWithAnthropic(prompt)
	} else {
		text, err = extractWithOpenAI(prompt)
	}

	if err != nil {
		fmt.Println("Extraction failed:", err)
		writeJSON(w, 500, map[string]string{"error": "Failed to extract from transcript"})
		return
	}

	// Strip markdown fences if present
	clean := strings.TrimSpace(text)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)

	var extracted map[string]any
	if err := json.Unmarshal([]byte(clean), &extracted); err != nil {
		fmt.Println("Failed to parse extraction JSON:", err)
		writeJSON(w, 500, map[string]string{"error": "Failed to extract from transcript"})
		return
	}

	cacheSet(extractKey, "extract", clean)

	writeJSON(w, 200, extracted)
}
