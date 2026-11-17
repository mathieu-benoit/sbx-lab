package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	gopty "github.com/aymanbagabas/go-pty"
)

const scrollbackBytes = 256 * 1024

// terminal is one tab: a shell on this machine in a pseudo-terminal (a pty on macOS and Linux,
// ConPTY on Windows), with the recent output kept to replay it to a page that connects later.
type terminal struct {
	id  string
	hub *hub

	mu         sync.Mutex
	pty        gopty.Pty
	cmd        *gopty.Cmd
	scrollback string
	exited     bool
	// Input sent before the shell reads it would be echoed raw: hold it until the shell is ready.
	ready   bool
	pending []func()
	// Whether the program in the terminal asked for bracketed paste (\e[?2004h): zsh at its
	// prompt, and agent CLIs such as Copilot. Then a pasted block arrives as one piece of text.
	bracketedPaste bool
	started        time.Time
	readyTimer     *time.Timer
	// The end of the last read when it cut a UTF-8 character in two
	partial []byte
}

func shellCommand() (string, []string) {
	if runtime.GOOS == "windows" {
		return "powershell.exe", nil
	}
	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}
	return shell, []string{"-l"}
}

func shellEnv(id string) []string {
	env := make([]string, 0, len(os.Environ())+3)
	for _, kv := range os.Environ() {
		name, _, _ := strings.Cut(kv, "=")
		switch strings.ToUpper(name) {
		case "LABSPACE_TOKEN", "TERM", "COLORTERM", "LABSPACE_TERMINAL":
			continue
		}
		env = append(env, kv)
	}
	return append(env, "TERM=xterm-256color", "COLORTERM=truecolor", "LABSPACE_TERMINAL="+id)
}

// startTerminal starts a shell for the tab id. previous is the scrollback of the tab's last
// shell, when it exited.
func startTerminal(h *hub, id, previous string, cols, rows int) (*terminal, error) {
	p, err := gopty.New()
	if err != nil {
		return nil, err
	}
	if err := p.Resize(cols, rows); err != nil {
		p.Close()
		return nil, err
	}
	name, args := shellCommand()
	path, err := exec.LookPath(name)
	if err != nil {
		p.Close()
		return nil, err
	}
	cmd := p.Command(path, args...)
	cmd.Dir = h.workspace
	cmd.Env = shellEnv(id)
	if err := cmd.Start(); err != nil {
		p.Close()
		return nil, err
	}
	// The shell has its own end of the pty: closing ours lets a read end when the shell exits.
	if up, ok := p.(gopty.UnixPty); ok {
		up.Slave().Close()
	}

	t := &terminal{id: id, hub: h, pty: p, cmd: cmd, started: time.Now()}
	if previous != "" {
		t.scrollback = previous + "\r\n\x1b[2m[new shell]\x1b[0m\r\n"
	}
	// Some shells (or slow login profiles) print nothing for a while; don't wait forever.
	time.AfterFunc(3*time.Second, t.markReady)
	go t.readLoop()
	go t.waitLoop()
	return t, nil
}

func (t *terminal) markReady() {
	t.mu.Lock()
	if t.ready {
		t.mu.Unlock()
		return
	}
	t.ready = true
	pending := t.pending
	t.pending = nil
	t.mu.Unlock()
	for _, send := range pending {
		send()
	}
}

// whenReady runs f now if the shell is ready, or once it is.
func (t *terminal) whenReady(f func()) {
	t.mu.Lock()
	if !t.ready {
		t.pending = append(t.pending, f)
		t.mu.Unlock()
		return
	}
	t.mu.Unlock()
	f()
}

func (t *terminal) isExited() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.exited
}

func (t *terminal) writeRaw(data string) {
	if !t.isExited() {
		t.pty.Write([]byte(data))
	}
}

// write sends what is typed in the page.
func (t *terminal) write(data string) {
	t.whenReady(func() { t.writeRaw(data) })
}

// run types a Run block and presses Enter. With bracketed paste, a multi-line block is pasted
// whole, so a prompt reaches the agent as one message and a shell gets every line before Enter;
// without it, each line is typed and entered in turn.
func (t *terminal) run(text string) {
	t.whenReady(func() {
		lines := strings.TrimRight(strings.NewReplacer("\r\n", "\n", "\r", "\n").Replace(text), "\n")
		t.mu.Lock()
		paste := t.bracketedPaste
		t.mu.Unlock()
		if paste {
			t.writeRaw("\x1b[200~" + strings.ReplaceAll(lines, "\n", "\r") + "\x1b[201~")
			// Enter as its own key press, once the program has taken the paste in
			time.AfterFunc(60*time.Millisecond, func() { t.writeRaw("\r") })
		} else {
			t.writeRaw(strings.ReplaceAll(lines, "\n", "\r") + "\r")
		}
	})
}

func (t *terminal) resize(cols, rows int) {
	if !t.isExited() {
		t.pty.Resize(cols, rows)
	}
}

func (t *terminal) kill() {
	if t.cmd.Process != nil {
		t.cmd.Process.Kill()
	}
	t.pty.Close()
}

func (t *terminal) readLoop() {
	buf := make([]byte, 32*1024)
	for {
		n, err := t.pty.Read(buf)
		if n > 0 {
			t.output(buf[:n])
		}
		if err != nil {
			return
		}
	}
}

// output records and forwards what the shell printed, in whole UTF-8 characters.
func (t *terminal) output(chunk []byte) {
	t.mu.Lock()
	data := append(t.partial, chunk...)
	cut := len(data)
	// Keep an incomplete character at the end for the next read (at most 3 bytes)
	for i := len(data) - 1; i >= 0 && i >= len(data)-3; i-- {
		if utf8.RuneStart(data[i]) {
			if !utf8.FullRune(data[i:]) {
				cut = i
			}
			break
		}
	}
	t.partial = append([]byte(nil), data[cut:]...)
	text := string(data[:cut])
	if text == "" {
		t.mu.Unlock()
		return
	}

	on := strings.LastIndex(text, "\x1b[?2004h")
	off := strings.LastIndex(text, "\x1b[?2004l")
	if on != off {
		t.bracketedPaste = on > off
	}
	// Input typed before the shell's line editor reads it is echoed raw (a stray "^[[201~"
	// around a paste). The prompt is no sign: zsh themes with an "instant prompt"
	// (powerlevel10k) draw it, with bracketed paste on, at once, while the shell still loads for
	// a few hundred milliseconds. So wait for the output to pause, and at least a second after
	// the start.
	if !t.ready {
		if t.readyTimer != nil {
			t.readyTimer.Stop()
		}
		wait := max(300*time.Millisecond, time.Second-time.Since(t.started))
		t.readyTimer = time.AfterFunc(wait, t.markReady)
	}
	t.scrollback = trimStart(t.scrollback+text, scrollbackBytes)
	t.mu.Unlock()

	t.hub.broadcast(message{T: "out", ID: t.id, Data: text})
}

func (t *terminal) waitLoop() {
	t.cmd.Wait()
	code := -1
	if t.cmd.ProcessState != nil {
		code = t.cmd.ProcessState.ExitCode()
	}
	// Let the last output arrive (ConPTY keeps its pipe open until the console is closed)
	time.Sleep(200 * time.Millisecond)
	t.pty.Close()

	note := fmt.Sprintf("\r\n\x1b[2m[shell exited with code %d; the next command starts a new one]\x1b[0m\r\n", code)
	t.mu.Lock()
	t.exited = true
	t.scrollback += note
	t.mu.Unlock()
	t.hub.broadcast(message{T: "out", ID: t.id, Data: note})
}

func (t *terminal) snapshot() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.scrollback
}

// trimStart keeps the last n bytes of s, starting on a whole UTF-8 character.
func trimStart(s string, n int) string {
	if len(s) <= n {
		return s
	}
	s = s[len(s)-n:]
	for i := 0; i < len(s) && i < utf8.UTFMax; i++ {
		if utf8.RuneStart(s[i]) {
			return s[i:]
		}
	}
	return "" // only the end of a character
}
