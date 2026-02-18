package main

import (
	"crypto/sha256"
	"fmt"
	"time"
)

const cacheTTLDays = 30

func cacheKey(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte{0}) // separator
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}

func cacheGet(key, category string) (string, bool) {
	var value, createdAt string
	err := DB.QueryRow(
		"SELECT value, created_at FROM cache WHERE key = ? AND category = ?",
		key, category,
	).Scan(&value, &createdAt)
	if err != nil {
		return "", false
	}

	t, err := time.Parse(time.RFC3339, createdAt)
	if err != nil || time.Since(t) > time.Duration(cacheTTLDays)*24*time.Hour {
		DB.Exec("DELETE FROM cache WHERE key = ? AND category = ?", key, category)
		return "", false
	}

	return value, true
}

func cacheSet(key, category, value string) {
	now := time.Now().UTC().Format(time.RFC3339)
	DB.Exec(
		"INSERT OR REPLACE INTO cache (key, category, value, created_at) VALUES (?, ?, ?, ?)",
		key, category, value, now,
	)
	// Lazy cleanup: delete expired entries
	cutoff := time.Now().UTC().AddDate(0, 0, -cacheTTLDays).Format(time.RFC3339)
	DB.Exec("DELETE FROM cache WHERE created_at < ?", cutoff)
}
