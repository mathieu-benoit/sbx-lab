package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUnquote(t *testing.T) {
	for in, want := range map[string]string{
		"> sbx policy reset --force": "sbx policy reset --force",
		"> a\n>\n> b":                "a\n\nb",
		"> > x\n> > y":               "x\ny",
		"echo a > b":                 "echo a > b",
		"cat <<EOF\n>x\nEOF":         "cat <<EOF\n>x\nEOF",
		"":                           "",
	} {
		if got := unquote(in); got != want {
			t.Errorf("unquote(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestResolveSavePath(t *testing.T) {
	ws := t.TempDir()
	home, _ := os.UserHomeDir()
	ok := map[string]string{
		"project/a.txt": filepath.Join(ws, "project", "a.txt"),
		"~/x/y.txt":     filepath.Join(home, "x", "y.txt"),
	}
	for in, want := range ok {
		got, err := resolveSavePath(ws, in)
		if err != nil || got != want {
			t.Errorf("resolveSavePath(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "../out.txt", "/etc/passwd", "~", "~/../x", "a/../../b", `\\server\x`} {
		if got, err := resolveSavePath(ws, in); err == nil {
			t.Errorf("resolveSavePath(%q) = %q, want an error", in, got)
		}
	}
}

func TestTrimStart(t *testing.T) {
	if got := trimStart("aé", 1); got != "" {
		t.Errorf("trimStart cut a character: %q", got)
	}
	if got := trimStart("abc", 2); got != "bc" {
		t.Errorf("trimStart = %q", got)
	}
}
