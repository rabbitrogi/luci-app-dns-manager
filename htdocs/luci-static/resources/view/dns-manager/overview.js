'use strict';
'require form';
'require poll';
'require rpc';
'require ui';
'require uci';
'require view';

var callStatus     = rpc.declare({ object: 'dns-manager', method: 'status' });
var callGetCustom  = rpc.declare({ object: 'dns-manager', method: 'get_local_list' });
var callSaveCustom = rpc.declare({ object: 'dns-manager', method: 'save_local_list', params: ['data'] });
var callGenerate   = rpc.declare({ object: 'dns-manager', method: 'generate_rules' });
var callExtract    = rpc.declare({ object: 'dns-manager', method: 'extract_domains', params: ['count'] });
var callWarmup     = rpc.declare({ object: 'dns-manager', method: 'warmup' });
var callRestartDnp = rpc.declare({ object: 'dns-manager', method: 'restart_dnp' });
var callRestartAgh = rpc.declare({ object: 'dns-manager', method: 'restart_agh' });

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('dns-manager'),
			L.resolveDefault(callGetCustom(), { data: '' })
		]);
	},

	render: function(data) {
		var self = this;
		this.customContent = (data[1] && data[1].data) || '';
		var topCount = uci.get('dns-manager', 'main', 'top_domains_count') || '300';

		var m = new form.Map('dns-manager', _('DNS Manager'),
			_('dnscrypt-proxy forwarding + AdGuardHome + cache warmup'));

		var s = m.section(form.NamedSection, 'main', 'dns-manager', _('Basic Settings'));
		s.anonymous = true;
		s.addremove = false;
		s.option(form.Value, 'china_dns', _('China DNS'),
			_('e.g. 223.5.5.5:53, 119.29.29.29:53'));
		s.option(form.Value, 'chinalist_url', _('Chinalist URL'));
		s.option(form.Value, 'forwarding_rules', _('Forwarding Rules Path'));
		s.option(form.Value, 'top_domains_count', _('Top Domains Count'));
		s.option(form.Value, 'warmup_batch', _('Warmup Batch Size'));
		s.option(form.Flag, 'warmup_enabled', _('Enable Boot Warmup'));

		return Promise.resolve(m.render()).then(function(mapEl) {
			var statusEl = self.buildStatus();
			var actionEl = self.buildActions(topCount);
			var customEl = self.buildCustomDomains(self.customContent);

			poll.add(function() {
				return callStatus().then(function(res) {
					self.setDot('dm-dnp', res.dnp);
					self.setDot('dm-agh', res.agh);
					var e = document.getElementById('dm-rules');
					if (e) e.innerHTML = '<b>' + (res.rules || 0) + '</b> ' + _('rules');
				}).catch(function() {});
			}, 5);

			return E('div', {}, [statusEl, actionEl, customEl, mapEl]);
		});
	},

	buildCustomDomains: function(content) {
		var wrap = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Custom China Domains')),
			E('div', { 'class': 'cbi-section-descr' },
				_('One domain per line. Merged with downloaded chinalist on update.')),
			E('p', {}, E('textarea', {
				'id': 'sys-custom-domains',
				'class': 'cbi-input-textarea',
				'style': 'width:100%',
				'rows': 10,
				'spellcheck': 'false',
				'wrap': 'off'
			}, [content || '']))
		]);

		var saveStatus = E('span', { 'style': 'margin-left:8px;font-size:13px' });
		var saveBtn = E('button', {
			'class': 'cbi-button cbi-button-save',
			'style': 'margin-bottom:10px',
			'click': function(ev) {
				var b = ev.currentTarget;
				var ta = document.getElementById('sys-custom-domains');
				if (!ta) return;
				var value = (ta.value || '').replace(/\r\n/g, '\n');
				b.disabled = true;
				b.textContent = _('Saving...');
				callSaveCustom(value).then(function() {
					b.disabled = false;
					b.textContent = _('Save Custom Domains');
					ta.value = value;
					saveStatus.innerHTML = '';
					saveStatus.appendChild(E('span', { 'style': 'color:green' }, _('Saved')));
					setTimeout(function() { saveStatus.innerHTML = ''; }, 5000);
				}).catch(function(err) {
					b.disabled = false;
					b.textContent = _('Save Custom Domains');
					saveStatus.innerHTML = '';
					saveStatus.appendChild(E('span', { 'style': 'color:red' },
						_('Error: ') + (err.message || err)));
				});
			}
		}, _('Save Custom Domains'));

		wrap.insertBefore(E('p', { 'style': 'margin-bottom:0' }, [saveBtn, saveStatus]),
			wrap.lastChild);
		return wrap;
	},

	handleSave: function(ev) {
		var tasks = [];
		document.querySelectorAll('.cbi-map').forEach(function(map) {
			tasks.push(DOM.callClassMethod(map, 'save'));
		});
		return Promise.all(tasks);
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			return ui.changes.apply(mode == '0');
		});
	},

	handleReset: function(ev) {
		var tasks = [];
		document.querySelectorAll('.cbi-map').forEach(function(map) {
			tasks.push(DOM.callClassMethod(map, 'reset'));
		});
		var ta = document.getElementById('sys-custom-domains');
		if (ta) ta.value = this.customContent || '';
		return Promise.all(tasks);
	},

	setDot: function(id, running) {
		var e = document.getElementById(id);
		if (!e) return;
		e.innerHTML = '';
		e.appendChild(E('span', { 'class': 'dm-d ' + (running ? 'dm-g' : 'dm-r') }));
		e.appendChild(E('b', {}, running ? 'RUNNING' : 'STOPPED'));
	},

	buildStatus: function() {
		var el = E('div', { 'class': 'cbi-section' });
		el.appendChild(E('style',
			'.dm-s{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}' +
			'.dm-c{border:1px solid #ccc;border-radius:4px;padding:8px 16px;min-width:160px}' +
			'.dm-c h4{margin:0 0 3px}' +
			'.dm-d{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}' +
			'.dm-g{background:#4caf50}.dm-r{background:#f44336}' +
			'.dm-b{margin:10px 0;display:flex;gap:8px;flex-wrap:wrap}'));
		el.appendChild(E('h3', {}, _('Service Status')));
		el.appendChild(E('div', { 'class': 'dm-s' }, [
			E('div', { 'class': 'dm-c' }, [
				E('h4', {}, 'dnscrypt-proxy'),
				E('p', { 'id': 'dm-dnp' }, [E('em', {}, _('Loading...'))])
			]),
			E('div', { 'class': 'dm-c' }, [
				E('h4', {}, 'AdGuardHome'),
				E('p', { 'id': 'dm-agh' }, [E('em', {}, _('Loading...'))])
			]),
			E('div', { 'class': 'dm-c' }, [
				E('h4', {}, _('Forwarding Rules')),
				E('p', { 'id': 'dm-rules' }, [E('em', {}, _('Loading...'))])
			])
		]));
		var row = E('div', { 'class': 'dm-b' });
		row.appendChild(this.rpcBtn(_('Restart dnscrypt-proxy'), callRestartDnp));
		row.appendChild(this.rpcBtn(_('Restart AdGuardHome'), callRestartAgh));
		el.appendChild(row);
		return el;
	},

	buildActions: function(topCount) {
		var el = E('div', { 'class': 'cbi-section' });
		el.appendChild(E('h3', {}, _('Domain List & Cache')));
		var row = E('div', { 'class': 'dm-b' });
		row.appendChild(this.rpcBtn(_('Update Domain List'), callGenerate));
		row.appendChild(this.rpcBtn(_('Extract Top Domains'), function() { return callExtract(topCount); }));
		row.appendChild(this.rpcBtn(_('Warmup Cache Now'), callWarmup));
		el.appendChild(row);

		var host = window.location.hostname;
		var url = 'http://' + host + ':3000';
		el.appendChild(E('h3', {}, _('AdGuardHome')));
		el.appendChild(E('p', {}, [_('Web UI: '), E('a', { href: url, target: '_blank' }, url)]));
		el.appendChild(E('button', {
			'class': 'cbi-button cbi-button-action',
			'click': function() {
				var f = document.getElementById('dm-agh-frame');
				if (f) f.style.display = f.style.display === 'none' ? 'block' : 'none';
			}
		}, _('Toggle Embedded View')));
		el.appendChild(E('iframe', {
			'id': 'dm-agh-frame', 'src': url,
			'style': 'width:100%;height:600px;border:1px solid #ccc;display:none;margin-top:6px'
		}));
		return el;
	},

	rpcBtn: function(label, fn) {
		var status = E('span', { 'style': 'margin-left:8px;font-size:13px' });
		var btn = E('button', {
			'class': 'cbi-button cbi-button-positive',
			'click': function(ev) {
				var b = ev.currentTarget;
				var orig = b.textContent;
				b.disabled = true;
				b.textContent = _('Running...');
				status.innerHTML = '';
				status.appendChild(E('em', { 'style': 'color:#888' }, _('Please wait...')));
				var r = typeof fn === 'function' ? fn() : fn;
				r.then(function(res) {
					b.disabled = false;
					b.textContent = orig;
					var msg = ((res && res.stdout) || '').trim() || _('Done');
					var code = (res && res.code !== undefined) ? res.code : 0;
					status.innerHTML = '';
					status.appendChild(E('span', { 'style': 'color:' + (code === 0 ? 'green' : 'red') },
						msg.replace(/\n/g, ' ')));
					setTimeout(function() { status.innerHTML = ''; }, 10000);
				}).catch(function(err) {
					b.disabled = false;
					b.textContent = orig;
					status.innerHTML = '';
					status.appendChild(E('span', { 'style': 'color:red' },
						_('Error: ') + (err.message || err)));
				});
			}
		}, label);
		var wrap = E('span', { 'style': 'white-space:nowrap' });
		wrap.appendChild(btn);
		wrap.appendChild(status);
		return wrap;
	}
});
