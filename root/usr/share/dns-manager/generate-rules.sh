#!/bin/sh
set -e

. /lib/functions.sh
config_load dns-manager
config_get CHINA_DNS main china_dns "223.5.5.5:53, 223.6.6.6:53"
config_get URL main chinalist_url "https://raw.githubusercontent.com/pexcn/daily/gh-pages/chinalist/chinalist.txt"
config_get RULES main forwarding_rules "/etc/dnscrypt-proxy2/forwarding-rules.txt"
CUSTOM_FILE="/etc/dns-manager/custom-chinalist.txt"
BASE="/etc/dns-manager/chinalist.txt"

mkdir -p /etc/dns-manager /etc/dnscrypt-proxy2

if [ "$SKIP_DOWNLOAD" = "1" ] && [ -s "$BASE" ]; then
	SRC="$BASE"
	echo "Using cached chinalist ($(wc -l < "$SRC") domains)"
else
	echo "Downloading chinalist..."
	if curl -sL "$URL" -o /tmp/chinalist_remote.txt && [ -s /tmp/chinalist_remote.txt ]; then
		SRC=/tmp/chinalist_remote.txt
		cp /tmp/chinalist_remote.txt "$BASE"
		echo "Downloaded $(wc -l < "$SRC") domains, updated base list"
	else
		echo "Download failed, using bundled base list"
		SRC="$BASE"
	fi
fi

echo "Merging with custom domains..."
{
	cat "$SRC"
	[ -f "$CUSTOM_FILE" ] && cat "$CUSTOM_FILE"
} | sort -u > /tmp/chinalist_merged.txt

MERGED=$(grep -cve '^\s*$' /tmp/chinalist_merged.txt)
CUSTOM_COUNT=0
[ -f "$CUSTOM_FILE" ] && CUSTOM_COUNT=$(grep -cve '^\s*$' "$CUSTOM_FILE" || echo 0)
echo "Base: $(wc -l < "$SRC"), Custom: $CUSTOM_COUNT, Merged: $MERGED"

echo "Generating forwarding-rules..."
awk -v dns="$CHINA_DNS" 'NF {print $0 "  " dns}' /tmp/chinalist_merged.txt > /tmp/forwarding-rules.new
if cmp -s /tmp/forwarding-rules.new "$RULES" 2>/dev/null; then
	echo "Rules unchanged ($(wc -l < "$RULES") lines), dnscrypt-proxy restart skipped"
	rm -f /tmp/forwarding-rules.new
else
	mv /tmp/forwarding-rules.new "$RULES"
	echo "Rules: $(wc -l < "$RULES") lines"
	echo "Restarting dnscrypt-proxy..."
	/etc/init.d/dnscrypt-proxy restart 2>/dev/null || true
fi

rm -f /tmp/chinalist_remote.txt /tmp/chinalist_merged.txt
echo "DONE"
