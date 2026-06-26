#!/bin/sh

DOMAINS_FILE="/etc/dns-warmup/top-domains.txt"
DNS_SERVER="127.0.0.1"
DNS_PORT="53"
BATCH=20
MAX_WAIT=60

[ ! -f "$DOMAINS_FILE" ] && echo "[warmup] no domain list" && exit 0

wait_for_dns() {
    for i in $(seq 1 $MAX_WAIT); do
        dig @"$DNS_SERVER" -p "$DNS_PORT" google.com +short +time=1 +tries=1 >/dev/null 2>&1 && return 0
        sleep 1
    done
    echo "[warmup] DNS not ready after ${MAX_WAIT}s, aborting"
    exit 1
}

warmup() {
    wait_for_dns
    total=$(wc -l < "$DOMAINS_FILE")
    count=0
    echo "[warmup] starting ($total domains, batch=$BATCH)"
    while read -r domain; do
        [ -z "$domain" ] && continue
        dig @"$DNS_SERVER" -p "$DNS_PORT" "$domain" A +short +time=2 +tries=1 >/dev/null 2>&1 &
        count=$((count + 1))
        [ $((count % BATCH)) -eq 0 ] && wait
    done < "$DOMAINS_FILE"
    wait
    echo "[warmup] done ($count domains queried)"
}

warmup
