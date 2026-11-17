// Labspace bridge: terminals of your own machine, for the Labspace interface.
//
// The Labspace interface, started with WORKSPACE_TYPE=ttyd, shows http://localhost:8085 in its
// right panel and sends its buttons to this server:
//
//	POST /api/command {cmd, terminalId?}  types cmd into a terminal and presses Enter
//	POST /api/save    {filePath, body}    writes a file, relative to the workspace (or ~/...)
//
// Both need "Authorization: Bearer $LABSPACE_TOKEN".
//
// The page at / is a set of xterm.js tabs, each one a real shell on this machine (a pty, or
// ConPTY on Windows). A Run button with `terminal-id=<name>` opens (or reuses) the tab of that
// name: the lab uses terminal-2, terminal-3 and terminal-4, shown as "Terminal 2"…
//
// It listens on 127.0.0.1 only, and checks the Host and Origin headers, so that another web
// page or another machine can't type into your shell.
//
// Environment: LABSPACE_TOKEN (required, 16+ characters), LABSPACE_WORKSPACE (the folder the
// shells start in, and where Save writes; the current folder by default), BRIDGE_PORT (8085),
// BRIDGE_BIND (127.0.0.1).
package main

import (
	"context"
	"crypto/subtle"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/coder/websocket"
)

//go:generate go run ./internal/fetchxterm public/vendor

//go:embed public/index.html public/vendor
var public embed.FS

// Blocks without a terminal-id run in Terminal 1; the lab names the others terminal-2, -3, -4
const defaultTerminal = "terminal-1"

var version = "dev"

func main() {
	if len(os.Args) > 1 && (os.Args[1] == "--version" || os.Args[1] == "version") {
		fmt.Println(version)
		return
	}
	token := os.Getenv("LABSPACE_TOKEN")
	if len(token) < 16 {
		log.Fatal("LABSPACE_TOKEN must be set (16+ characters). Start the bridge with labspace-local/start.sh.")
	}
	port := 8085
	if p := os.Getenv("BRIDGE_PORT"); p != "" {
		n, err := strconv.Atoi(p)
		if err != nil {
			log.Fatalf("BRIDGE_PORT: %v", err)
		}
		port = n
	}
	bind := os.Getenv("BRIDGE_BIND")
	if bind == "" {
		bind = "127.0.0.1"
	}
	workspace := os.Getenv("LABSPACE_WORKSPACE")
	if workspace == "" {
		workspace = "."
	}
	workspace, err := filepath.Abs(workspace)
	if err != nil {
		log.Fatal(err)
	}

	h := newHub(workspace)
	srv := &http.Server{Handler: newServer(h, token, port)}
	ln, err := net.Listen("tcp", net.JoinHostPort(bind, strconv.Itoa(port)))
	if err != nil {
		log.Fatal(err)
	}
	log.SetFlags(0)
	log.Printf("Labspace bridge %s on http://localhost:%d (shells start in %s)", version, port, workspace)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stop
		h.killAll()
		os.Exit(0)
	}()
	if err := srv.Serve(ln); err != nil {
		log.Fatal(err)
	}
}

// ---------------------------------------------------------------- terminals and pages

type message struct {
	T      string   `json:"t"`
	ID     string   `json:"id,omitempty"`
	IDs    []string `json:"ids,omitempty"`
	Focus  string   `json:"focus,omitempty"`
	Data   string   `json:"data"` // always sent: the page writes it to xterm.js as is
	Replay bool     `json:"replay,omitempty"`
}

// client is an open WebSocket of the terminal page. Messages go through a queue, so a slow page
// doesn't hold up the shells.
type client struct {
	conn *websocket.Conn
	send chan []byte
}

type hub struct {
	workspace string

	mu         sync.Mutex
	terminals  map[string]*terminal
	order      []string // tab ids, in the order they were opened
	clients    map[*client]bool
	inputOwner *client
	cols, rows int
}

func newHub(workspace string) *hub {
	return &hub{workspace: workspace, terminals: map[string]*terminal{}, clients: map[*client]bool{}, cols: 100, rows: 30}
}

func encode(m message) []byte {
	b, _ := json.Marshal(m)
	return b
}

func (h *hub) broadcast(m message) {
	data := encode(m)
	h.mu.Lock()
	defer h.mu.Unlock()
	for c := range h.clients {
		select {
		case c.send <- data:
		default: // too far behind: drop the page, it reconnects and gets the scrollback
			go c.conn.CloseNow()
		}
	}
}

func (h *hub) listMessage(focus string) message {
	return message{T: "list", IDs: append([]string{}, h.order...), Focus: focus}
}

// ensure returns the running shell of tab id, and starts one if there is none.
func (h *hub) ensure(id string) (*terminal, error) {
	h.mu.Lock()
	existing := h.terminals[id]
	if existing != nil && !existing.isExited() {
		h.mu.Unlock()
		return existing, nil
	}
	previous := ""
	if existing != nil {
		previous = existing.snapshot()
	}
	t, err := startTerminal(h, id, previous, h.cols, h.rows)
	if err != nil {
		h.mu.Unlock()
		return nil, err
	}
	if existing == nil {
		h.order = append(h.order, id)
	}
	h.terminals[id] = t
	list := h.listMessage(id)
	h.mu.Unlock()
	h.broadcast(list)
	return t, nil
}

func (h *hub) close(id string) {
	h.mu.Lock()
	t := h.terminals[id]
	if t == nil {
		h.mu.Unlock()
		return
	}
	delete(h.terminals, id)
	for i, other := range h.order {
		if other == id {
			h.order = append(h.order[:i], h.order[i+1:]...)
			break
		}
	}
	focus := ""
	if len(h.order) > 0 {
		focus = h.order[0]
	}
	list := h.listMessage(focus)
	h.mu.Unlock()
	t.kill()
	h.broadcast(list)
}

func (h *hub) resize(id string, cols, rows int) {
	h.mu.Lock()
	h.cols, h.rows = min(cols, 500), min(rows, 200)
	t := h.terminals[id]
	cols, rows = h.cols, h.rows
	h.mu.Unlock()
	if t != nil {
		t.resize(cols, rows)
	}
}

func (h *hub) killAll() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for _, t := range h.terminals {
		t.kill()
	}
}

// ---------------------------------------------------------------- HTTP

func newServer(h *hub, token string, port int) http.Handler {
	// Requests must name this server: blocks DNS rebinding from a web page.
	allowedHosts := map[string]bool{}
	for _, host := range []string{"localhost", "127.0.0.1", "[::1]", "host.docker.internal"} {
		allowedHosts[fmt.Sprintf("%s:%d", host, port)] = true
	}
	// The terminal page is the only page allowed to open the WebSocket.
	allowedOrigins := []string{fmt.Sprintf("localhost:%d", port), fmt.Sprintf("127.0.0.1:%d", port)}

	staticFiles := map[string][2]string{
		"/":             {"public/index.html", "text/html; charset=utf-8"},
		"/xterm.css":    {"public/vendor/xterm.css", "text/css"},
		"/xterm.js":     {"public/vendor/xterm.js", "text/javascript"},
		"/addon-fit.js": {"public/vendor/addon-fit.js", "text/javascript"},
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowedHosts[r.Host] {
			sendJSON(w, http.StatusForbidden, map[string]any{"error": "unexpected Host header"})
			return
		}

		if r.Method == http.MethodGet && r.URL.Path == "/ws" {
			serveWebSocket(h, w, r, allowedOrigins)
			return
		}

		if file, ok := staticFiles[r.URL.Path]; ok && r.Method == http.MethodGet {
			body, err := public.ReadFile(file[0])
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", file[1])
			w.Header().Set("Cache-Control", "no-store")
			// Only the Labspace interface may frame the terminal page
			w.Header().Set("Content-Security-Policy", "frame-ancestors http://localhost:3030 http://127.0.0.1:3030")
			w.Write(body)
			return
		}

		if r.Method == http.MethodGet && r.URL.Path == "/healthz" {
			sendJSON(w, http.StatusOK, map[string]any{"ok": true})
			return
		}

		if r.Method == http.MethodPost && strings.HasPrefix(r.URL.Path, "/api/") {
			expected := "Bearer " + token
			if subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte(expected)) != 1 {
				sendJSON(w, http.StatusUnauthorized, map[string]any{"error": "bad token"})
				return
			}
			if err := handleAPI(h, w, r); err != nil {
				sendJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
			}
			return
		}

		sendJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
	})
}

func sendJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}

func handleAPI(h *hub, w http.ResponseWriter, r *http.Request) error {
	var body struct {
		Cmd        *string `json:"cmd"`
		TerminalID string  `json:"terminalId"`
		FilePath   string  `json:"filePath"`
		Body       *string `json:"body"`
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024+1))
	if err != nil {
		return err
	}
	if len(raw) > 1024*1024 {
		return errors.New("body too large")
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &body); err != nil {
			return err
		}
	}

	switch r.URL.Path {
	case "/api/command":
		if body.Cmd == nil || *body.Cmd == "" {
			return errors.New("missing cmd")
		}
		cmd := unquote(*body.Cmd)
		id := body.TerminalID
		if id == "" {
			id = defaultTerminal
		}
		if len(id) > 64 {
			return errors.New("terminalId too long")
		}
		t, err := h.ensure(id)
		if err != nil {
			return err
		}
		t.run(cmd)
		h.broadcast(message{T: "focus", ID: id})
		first, _, more := strings.Cut(cmd, "\n")
		if more {
			first += " …"
		}
		log.Printf("[run:%s] %s", id, first)
		sendJSON(w, http.StatusOK, map[string]any{"ok": true})
		return nil

	case "/api/save":
		if body.Body == nil {
			return errors.New("missing body")
		}
		target, err := resolveSavePath(h.workspace, body.FilePath)
		if err != nil {
			return err
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(target, []byte(unquote(*body.Body)), 0o644); err != nil {
			return err
		}
		log.Printf("[save] %s", target)
		sendJSON(w, http.StatusOK, map[string]any{"ok": true, "path": target})
		return nil
	}
	sendJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
	return nil
}

// resolveSavePath applies the rules of the Labspace VS Code extension: relative to the
// workspace, or ~/ for the home folder.
func resolveSavePath(workspace, filePath string) (string, error) {
	if filePath == "" {
		return "", errors.New("missing filePath")
	}
	base, rel := workspace, filePath
	if filePath == "~" || strings.HasPrefix(filePath, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		base, rel = home, strings.TrimPrefix(strings.TrimPrefix(filePath, "~"), "/")
	}
	target := filepath.Clean(filepath.Join(base, filepath.FromSlash(rel)))
	// An absolute path ("/etc/x", "C:\\x", or "\\x" on Windows) is not under the base
	if filepath.IsAbs(rel) || filepath.VolumeName(rel) != "" || strings.HasPrefix(rel, "/") || strings.HasPrefix(rel, "\\") ||
		!strings.HasPrefix(target, filepath.Clean(base)+string(filepath.Separator)) {
		if base == workspace {
			return "", errors.New("path leaves the workspace")
		}
		return "", errors.New("path leaves the home folder")
	}
	return target, nil
}

// ---------------------------------------------------------------- WebSocket

// Several pages may show the same shells (two browser tabs, a reload). Each xterm.js answers
// the queries programs send to the terminal (background color, cursor position, device
// attributes), so only one page may send input: the last one connected or used. Otherwise the
// extra answers arrive in the shell as typed text, like "11;rgb:0b0b/1010/2020".
func serveWebSocket(h *hub, w http.ResponseWriter, r *http.Request, origins []string) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: origins})
	if err != nil {
		return
	}
	// The scrollback replay can be large
	conn.SetReadLimit(1 << 20)
	c := &client{conn: conn, send: make(chan []byte, 1024)}
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	if _, err := h.ensure(defaultTerminal); err != nil {
		conn.Close(websocket.StatusInternalError, err.Error())
		return
	}
	h.mu.Lock()
	h.clients[c] = true
	h.inputOwner = c
	c.send <- encode(h.listMessage(defaultTerminal))
	for _, id := range h.order {
		c.send <- encode(message{T: "out", ID: id, Data: h.terminals[id].snapshot(), Replay: true})
	}
	h.mu.Unlock()

	go func() {
		defer cancel()
		for {
			select {
			case data := <-c.send:
				wctx, wcancel := context.WithTimeout(ctx, 10*time.Second)
				err := conn.Write(wctx, websocket.MessageText, data)
				wcancel()
				if err != nil {
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}()

	defer func() {
		h.mu.Lock()
		delete(h.clients, c)
		if h.inputOwner == c {
			h.inputOwner = nil
			for other := range h.clients {
				h.inputOwner = other
			}
		}
		h.mu.Unlock()
		conn.CloseNow()
	}()

	for {
		_, raw, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var msg struct {
			T    string `json:"t"`
			ID   string `json:"id"`
			Data string `json:"data"`
			Cols int    `json:"cols"`
			Rows int    `json:"rows"`
		}
		if json.Unmarshal(raw, &msg) != nil {
			continue
		}
		if msg.T == "claim" {
			h.mu.Lock()
			h.inputOwner = c
			h.mu.Unlock()
			continue
		}
		if msg.ID == "" || len(msg.ID) > 64 {
			continue
		}
		switch msg.T {
		case "in":
			h.mu.Lock()
			owner := h.inputOwner == c
			h.mu.Unlock()
			if owner {
				if t, err := h.ensure(msg.ID); err == nil {
					t.write(msg.Data)
				}
			}
		case "resize":
			if msg.Cols > 0 && msg.Rows > 0 {
				h.resize(msg.ID, msg.Cols, msg.Rows)
			}
		case "open":
			h.ensure(msg.ID)
		case "close":
			h.close(msg.ID)
		}
	}
}
