# luci-app-dns-manager

一个统一的 LuCI 应用，用于在 OpenWrt 上管理 DNS 分流，基于 [dnscrypt-proxy2](https://github.com/DNSCrypt/dnscrypt-proxy) 和 [AdGuardHome](https://github.com/AdguardTeam/AdGuardHome)。

## 架构

```
客户端
  │
  ▼
AdGuardHome (:53)          ← 广告过滤 + DNS 缓存 + 访问日志
  │
  ▼
dnscrypt-proxy (:9053)     ← 加密 DNS + 中国域名分流
  ├─ 中国域名 → 中国 DNS (明文 UDP, 如 223.5.5.5:53)
  └─ 其他域名  → 加密 DoH (Cloudflare, NextDNS, ...)
```

## 功能特性

- **DNS 分流** — 利用 dnscrypt-proxy2 的 `forwarding_rules`，将中国域名路由到国内 DNS，其他流量走加密 DoH/DNSCrypt。

- **自定义域名列表** — 添加需要走中国 DNS 但不在公共列表中的内网/私有域名。每次更新时与下载的 chinalist 合并（不累积）。

- **一键更新** — 下载最新的中国域名列表，合并自定义域名，生成转发规则，重启 dnscrypt-proxy。

- **DNS 缓存预热** — 从 AdGuardHome 的查询日志中提取高频域名，开机后自动预解析。

- **安全设计** — 使用专用 rpcd 后端，仅暴露严格的 ubus 方法，禁止从 Web 界面执行任意命令。

## 系统要求

- OpenWrt 22.03 或更高版本
- `dnscrypt-proxy2`、`adguardhome`、`curl`、`dig`

## 安装

**重要：** AdGuardHome 默认监听 53 端口，与 dnsmasq 冲突。请先修改 dnsmasq 端口：

```bash
uci set dhcp.@dnsmasq[0].port=54
uci commit dhcp
/etc/init.d/dnsmasq restart
```

```bash
scp luci-app-dns-manager_0.1.0-r1_all.ipk root@路由器:/tmp/
opkg install /tmp/luci-app-dns-manager_0.1.0-r1_all.ipk
```

## 配置

在 LuCI 中导航到 **服务 → DNS Manager**。

### 如何找到你所在网络最快的 DNS 服务器

固定 `server_names` 之前，先找出从你的网络访问最快的域名服务器：

1. 保持 `server_names` 注释状态（默认）
2. 重启 dnscrypt-proxy：`/etc/init.d/dnscrypt-proxy restart`
3. 查看启动日志中的延迟排序：
   ```bash
   logread | grep "ms " | grep NOTICE | tail -30
   ```
4. 从列表中选取前 15-20 个服务器
5. 写入 `/etc/dnscrypt-proxy2/dnscrypt-proxy.toml`：
   ```toml
   server_names = ['server1', 'server2', ...]
   ```

不同地区和 ISP 的最快服务器列表不同，需要根据实际网络环境自行测量。

### 推荐设置

```toml
# 固定你测出的最快服务器
server_names = ['your-fastest-servers...']

# 从最快的 5 个服务器中随机选择（速度和冗余的最佳平衡）
lb_strategy = 'p5'

cache_size = 16384
forwarding_rules = '/etc/dnscrypt-proxy2/forwarding-rules.txt'
bootstrap_resolvers = ['223.5.5.5:53', '119.29.29.29:53']
ignore_system_dns = true
```

**为什么选 `p5`？** `p5` 策略从最快的 5 个服务器中随机选 1 个。对比测试表明，它优于 `wp2`（默认）、`p2`、`p6`、`p9` —— 平均延迟更低，一致性更好，5 个服务器提供足够的冗余。

### AdGuardHome 配置

将上游 DNS 指向 dnscrypt-proxy：

```yaml
dns:
  upstream_dns:
    - 127.0.0.1:9053
```

## 致谢

- **[dnscrypt-proxy2](https://github.com/DNSCrypt/dnscrypt-proxy)** by Frank Denis
- **[AdGuardHome](https://github.com/AdguardTeam/AdGuardHome)** by AdGuard
- **[chinadns-ng](https://github.com/zfl9/chinadns-ng)** by Otokaze
- **[pexcn/daily](https://github.com/pexcn/daily)** — 中国域名列表

## 许可证

GPL-2.0
