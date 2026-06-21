include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-dns-manager
PKG_VERSION:=0.1.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for DNS Manager (dnscrypt-proxy + AdGuardHome)
LUCI_DESCRIPTION:=Unified DNS management: dnscrypt-proxy forwarding rules, AdGuardHome cache warmup, China domain list update.
LUCI_DEPENDS:=+dnscrypt-proxy2 +adguardhome +curl
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

define Package/$(PKG_NAME)/conffiles
/etc/config/dns-manager
/etc/dns-manager/custom-chinalist.txt
endef

# call BuildPackage - OpenWrt buildroot signature
