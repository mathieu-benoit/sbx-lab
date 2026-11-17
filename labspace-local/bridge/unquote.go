package main

import (
	"regexp"
	"strings"
)

var quoteMarker = regexp.MustCompile(`^ {0,3}> ?`)

// unquote removes the quote markers of a code block inside a quote or an alert (> [!TIP]), as
// many levels as every line has. The interface takes a block's code from the raw Markdown, where
// every line of such a block still starts with the quote's "> ", which the shell would read as a
// redirection (fixed upstream by dockersamples/labspace-infra#234).
func unquote(code string) string {
	lines := strings.Split(code, "\n")
	for {
		for _, line := range lines {
			if !quoteMarker.MatchString(line) {
				return strings.Join(lines, "\n")
			}
		}
		for i, line := range lines {
			lines[i] = quoteMarker.ReplaceAllString(line, "")
		}
	}
}
