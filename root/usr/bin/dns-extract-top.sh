#!/bin/sh

LOG="/var/lib/adguardhome/data/querylog.json"
OUTDIR="/etc/dns-warmup"
OUTFILE="$OUTDIR/top-domains.txt"
TOPN="${1:-300}"

[ ! -f "$LOG" ] && echo "[extract] no querylog found: $LOG" && exit 1

mkdir -p "$OUTDIR"

grep -o '"QH":"[^"]*"' "$LOG" \
  | cut -d'"' -f4 \
  | grep -vE '\.(in-addr|ip6)\.arpa$' \
  | grep -vE '^(localhost|ip6-|broadcast)' \
  | sort | uniq -c | sort -rn | head -"$TOPN" | awk '{print $2}' > "$OUTFILE.tmp"

mv "$OUTFILE.tmp" "$OUTFILE"

echo "[extract] $(wc -l < "$OUTFILE") domains → $OUTFILE"
