// Command fetchxterm downloads the xterm.js files that the bridge serves and embeds, from the npm
// registry, at pinned versions checked against their npm integrity hash.
//
//	go generate ./...   (runs: go run ./internal/fetchxterm public/vendor)
package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha512"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

type pkg struct {
	url       string
	integrity string
	files     map[string]string // path in the tarball -> file name in the output folder
}

var packages = []pkg{
	{
		url:       "https://registry.npmjs.org/@xterm/xterm/-/xterm-6.0.0.tgz",
		integrity: "sha512-TQwDdQGtwwDt+2cgKDLn0IRaSxYu1tSUjgKarSDkUM0ZNiSRXFpjxEsvc/Zgc5kq5omJ+V0a8/kIM2WD3sMOYg==",
		files:     map[string]string{"package/css/xterm.css": "xterm.css", "package/lib/xterm.js": "xterm.js"},
	},
	{
		url:       "https://registry.npmjs.org/@xterm/addon-fit/-/addon-fit-0.11.0.tgz",
		integrity: "sha512-jYcgT6xtVYhnhgxh3QgYDnnNMYTcf8ElbxxFzX0IZo+vabQqSPAjC3c1wJrKB5E19VwQei89QCiZZP86DCPF7g==",
		files:     map[string]string{"package/lib/addon-fit.js": "addon-fit.js"},
	},
}

func main() {
	if len(os.Args) != 2 {
		log.Fatal("usage: fetchxterm <out-dir>")
	}
	out := os.Args[1]
	if err := os.MkdirAll(out, 0o755); err != nil {
		log.Fatal(err)
	}
	for _, p := range packages {
		if err := fetch(p, out); err != nil {
			log.Fatalf("%s: %v", p.url, err)
		}
	}
}

func fetch(p pkg, out string) error {
	res, err := http.Get(p.url)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %s", res.Status)
	}
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	sum := sha512.Sum512(body)
	if got := "sha512-" + base64.StdEncoding.EncodeToString(sum[:]); got != p.integrity {
		return fmt.Errorf("integrity mismatch: got %s", got)
	}
	gz, err := gzip.NewReader(bytes.NewReader(body))
	if err != nil {
		return err
	}
	tr := tar.NewReader(gz)
	left := len(p.files)
	for left > 0 {
		h, err := tr.Next()
		if err != nil {
			return fmt.Errorf("%d file(s) not found in the package: %w", left, err)
		}
		name, ok := p.files[h.Name]
		if !ok {
			continue
		}
		data, err := io.ReadAll(tr)
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(out, name), data, 0o644); err != nil {
			return err
		}
		left--
	}
	return nil
}
