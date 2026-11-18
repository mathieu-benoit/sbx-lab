#!/bin/sh
# Scan each image given as an argument with Trivy, straight from its registry,
# applying the VEX statements of vex-repository.yaml, and print one line per
# image: its total number of vulnerabilities, and how many are critical or high.
set -eu

# Trivy reads its VEX repositories from ~/.trivy/vex/repository.yaml.
if [ ! -f "$HOME/.trivy/vex/repository.yaml" ]; then
  mkdir -p "$HOME/.trivy/vex"
  cp /usr/local/share/trivy/vex-repository.yaml "$HOME/.trivy/vex/repository.yaml"
fi

for image in "$@"; do
  printf '%-26s ' "$image"
  trivy image --image-src remote --scanners vuln --vex repo --no-progress --quiet \
    --format template --template '
{{- $total := 0 }}{{ $critical := 0 }}{{ $high := 0 }}
{{- range . }}{{ range .Vulnerabilities }}
{{- $total = add $total 1 }}
{{- if eq .Severity "CRITICAL" }}{{ $critical = add $critical 1 }}{{ end }}
{{- if eq .Severity "HIGH" }}{{ $high = add $high 1 }}{{ end }}
{{- end }}{{ end -}}
{{ $total }} vulnerabilities ({{ $critical }} critical, {{ $high }} high)
' "$image"
done
