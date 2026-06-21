# luci-app-dns-manager

A unified LuCI application for managing DNS split-routing on OpenWrt, powered by [dnscrypt-proxy2](https://github.com/DNSCrypt/dnscrypt-proxy) and [AdGuardHome](https://github.com/AdguardTeam/AdGuardHome).

## Architecture

```
Client
  │
  ▼
AdGuardHome (:53)          ← Ad blocking + DNS cache + query log
  │
  ▼
dnscrypt-proxy (:9053)     ← Encrypted DNS + China domain split routing
  ├─ China domains → China DNS (plain UDP, e.g. 223.5.5.5:53)
  └─ Other domains  → Encrypted DoH (Cloudflare, NextDNS, ...)
```

## Features

- **DNS Split Routing** — Uses dnscrypt-proxy2's `forwarding_rules` to route China domains to domestic DNS servers, while all other traffic goes through encrypted DoH/DNSCrypt resolvers.

- **Custom Domain List** — Add internal/private domains that need China DNS resolution but are not in public lists. Merged with the downloaded chinalist on each update (no accumulation).

- **One-Click Update** — Download the latest China domain list, merge with your custom domains, generate forwarding rules, and restart dnscrypt-proxy.

- **DNS Cache Warmup** — Extracts the most frequently queried domains from AdGuardHome's query log and pre-resolves them at boot.

- **Security** — Uses a dedicated rpcd backend with strictly scoped ubus methods. No arbitrary command execution from the web interface.

## Requirements

- OpenWrt 22.03 or later
- `dnscrypt-proxy2`
- `adguardhome`
- `curl`
- `dig`

## Installation

**Important:** AdGuardHome listens on port 53, which conflicts with OpenWrt's default dnsmasq. You must change dnsmasq's port first:

```bash
uci set dhcp.@dnsmasq[0].port=54
uci commit dhcp
/etc/init.d/dnsmasq restart
```

```bash
scp luci-app-dns-manager_0.1.0-r1_all.ipk root@router:/tmp/
opkg install /tmp/luci-app-dns-manager_0.1.0-r1_all.ipk
```

## Configuration

Navigate to **Services → DNS Manager** in LuCI.

### Finding Your Fastest Servers

Before pinning `server_names`, find which servers are fastest from your network:

1. Leave `server_names` commented out (default)
2. Restart dnscrypt-proxy: `/etc/init.d/dnscrypt-proxy restart`
3. Check the startup log for sorted latencies:
   ```bash
   logread | grep "ms " | grep NOTICE | tail -30
   ```
4. Pick the top 15-20 servers from the list
5. Set them in `/etc/dnscrypt-proxy2/dnscrypt-proxy.toml`:
   ```toml
   server_names = ['server1', 'server2', ...]
   ```

The server list varies by region and ISP. What works well on one network may be slow on another.

### Recommended Settings

```toml
# Pin your fastest servers (found via the method above)
server_names = ['your-fastest-servers...']

# Pick randomly from the fastest 5 (best balance of speed and redundancy)
lb_strategy = 'p5'

cache_size = 16384
forwarding_rules = '/etc/dnscrypt-proxy2/forwarding-rules.txt'
bootstrap_resolvers = ['223.5.5.5:53', '119.29.29.29:53']
ignore_system_dns = true
```

**Why `p5`?** The `p5` strategy selects randomly from the top 5 fastest servers. Comparative testing showed it outperforms `wp2` (default), `p2`, `p6`, and `p9` — providing lower average latency, better consistency, and sufficient redundancy across 5 servers.

### AdGuardHome

Point AdGuardHome's upstream to dnscrypt-proxy:

```yaml
dns:
  upstream_dns:
    - 127.0.0.1:9053
```

## Credits

- **[dnscrypt-proxy2](https://github.com/DNSCrypt/dnscrypt-proxy)** by Frank Denis
- **[AdGuardHome](https://github.com/AdguardTeam/AdGuardHome)** by AdGuard
- **[chinadns-ng](https://github.com/zfl9/chinadns-ng)** by Otokaze
- **[pexcn/daily](https://github.com/pexcn/daily)** — China domain lists

## License

GPL-2.0
