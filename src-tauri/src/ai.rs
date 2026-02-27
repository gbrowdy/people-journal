use serde_json::{json, Value};
use std::env;

const TAGS: &[&str] = &[
    "career growth", "blockers", "wins", "feedback given", "feedback received",
    "cross-team", "technical debt", "hiring", "process", "personal", "morale",
    "autonomy", "project update", "conflict", "learning",
];

fn get_env_non_empty(key: &str) -> Option<String> {
    env::var(key).ok().filter(|v| !v.is_empty() && v != "your-key-here")
}

fn build_extraction_prompt(member_name: &str, transcript: &str) -> String {
    let tag_list = TAGS.join(", ");
    format!(
        r#"You are helping an engineering manager process a 1:1 meeting transcript with their report named {name}. Extract structured information and respond ONLY with a JSON object (no markdown, no backticks, no preamble). The JSON should have these fields:

{{
  "summary": "2-4 sentence summary of the key discussion points",
  "tags": ["array of relevant tags from this list: {tags}"],
  "action_items_mine": ["action items for the manager"],
  "action_items_theirs": ["action items for {name}"],
  "morale_score": <1-5 integer, your best read on their energy/morale based on tone>,
  "morale_rationale": "1-2 sentence explanation of why you gave this morale score, citing specific things from the conversation",
  "growth_score": <1-5 integer, signals of professional growth or stagnation>,
  "growth_rationale": "1-2 sentence explanation of why you gave this growth score, citing specific things from the conversation",
  "notable_quotes": ["1-2 notable or important things {name} said, verbatim if possible"],
  "blockers": ["any blockers or frustrations mentioned"],
  "wins": ["any wins, accomplishments, or positive things mentioned"]
}}

Here is the transcript:

{transcript}"#,
        name = member_name,
        tags = tag_list,
        transcript = transcript,
    )
}

async fn call_anthropic(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = json!({
        "model": "claude-sonnet-4-5-20250929",
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": prompt}],
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("anthropic request failed: {e}"))?;

    let status = resp.status();
    let data: Value = resp.json().await.map_err(|e| format!("failed to read response: {e}"))?;

    if !status.is_success() {
        return Err(format!("anthropic returned {}: {}", status, data));
    }

    let texts: Vec<&str> = data["content"]
        .as_array()
        .map(|arr| arr.iter().filter_map(|c| c["text"].as_str()).collect())
        .unwrap_or_default();

    Ok(texts.join(""))
}

async fn call_openai(api_key: &str, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = json!({
        "model": "gpt-4o",
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": prompt}],
    });

    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("openai request failed: {e}"))?;

    let status = resp.status();
    let data: Value = resp.json().await.map_err(|e| format!("failed to read response: {e}"))?;

    if !status.is_success() {
        return Err(format!("openai returned {}: {}", status, data));
    }

    data["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "openai returned no choices".to_string())
}

async fn call_ai(prompt: &str) -> Result<String, String> {
    if let Some(key) = get_env_non_empty("ANTHROPIC_API_KEY") {
        call_anthropic(&key, prompt).await
    } else if let Some(key) = get_env_non_empty("OPENAI_API_KEY") {
        call_openai(&key, prompt).await
    } else {
        Err("No API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env".to_string())
    }
}

fn strip_markdown_fences(text: &str) -> &str {
    let s = text.trim();
    let s = s.strip_prefix("```json").unwrap_or(s);
    let s = s.strip_prefix("```").unwrap_or(s);
    let s = s.strip_suffix("```").unwrap_or(s);
    s.trim()
}

pub async fn extract_transcript(transcript: &str, member_name: &str) -> Result<Value, String> {
    let prompt = build_extraction_prompt(member_name, transcript);
    let text = call_ai(&prompt).await?;
    let clean = strip_markdown_fences(&text);
    serde_json::from_str(clean).map_err(|e| format!("Failed to parse extraction JSON: {e}"))
}

pub fn build_prep_prompt(member_name: &str, entries: &[crate::db::Entry]) -> String {
    let mut sb = String::new();

    sb.push_str(&format!(
        "You are helping an engineering manager prepare for a 1:1 meeting with {name}. \
         Below are the last {n} meeting entries (newest first). \
         Generate a concise bullet-point briefing with these two sections:\n\n\
         **Follow up on**\n\
         **Watch for**\n\n\
         Follow up on = open action items and unresolved topics to revisit.\n\
         Watch for = morale/growth concerns or patterns worth probing.\n\n\
         Keep bullets short and scannable. No narrative prose.\n\
         Use this exact format — section headers as **bold text** on their own line, bullets as - dashes:\n\n\
         **Follow up on**\n- bullet one\n- bullet two\n\n**Watch for**\n- bullet one\n\n",
        name = member_name,
        n = entries.len(),
    ));

    for (i, e) in entries.iter().enumerate() {
        sb.push_str(&format!("--- Entry {} ({}) ---\n", i + 1, e.date));
        if let Some(ref s) = e.summary {
            sb.push_str(&format!("Summary: {s}\n"));
        }
        if let Some(score) = e.morale_score {
            sb.push_str(&format!("Morale: {score}/5"));
            if let Some(ref r) = e.morale_rationale {
                sb.push_str(&format!(" ({r})"));
            }
            sb.push('\n');
        }
        if let Some(score) = e.growth_score {
            sb.push_str(&format!("Growth: {score}/5"));
            if let Some(ref r) = e.growth_rationale {
                sb.push_str(&format!(" ({r})"));
            }
            sb.push('\n');
        }
        if !e.tags.is_empty() {
            sb.push_str(&format!("Tags: {}\n", e.tags.join(", ")));
        }
        if !e.action_items_mine.is_empty() {
            sb.push_str("My action items:\n");
            for a in &e.action_items_mine {
                let status = if a.completed { "[x]" } else { "[ ]" };
                sb.push_str(&format!("  {status} {}\n", a.text));
            }
        }
        if !e.action_items_theirs.is_empty() {
            sb.push_str(&format!("{name}'s action items:\n", name = member_name));
            for a in &e.action_items_theirs {
                let status = if a.completed { "[x]" } else { "[ ]" };
                sb.push_str(&format!("  {status} {}\n", a.text));
            }
        }
        if !e.blockers.is_empty() {
            sb.push_str(&format!("Blockers: {}\n", e.blockers.join("; ")));
        }
        if !e.wins.is_empty() {
            sb.push_str(&format!("Wins: {}\n", e.wins.join("; ")));
        }
        if !e.notable_quotes.is_empty() {
            sb.push_str(&format!("Notable quotes: {}\n", e.notable_quotes.join("; ")));
        }
        sb.push('\n');
    }

    sb
}

pub async fn generate_briefing(prompt: &str) -> Result<String, String> {
    let text = call_ai(prompt).await?;
    Ok(text.trim().to_string())
}
