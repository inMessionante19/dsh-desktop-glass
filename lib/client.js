window.__ModuleLoader__.load({
  id: 'dsh-desktop-glass',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const DEFAULTS = { enabled: true, mode: 'glass', tint: 8 };
    const KEY = 'dsh-desktop-glass.preferences.v2';
    function apply(ctx) {
      let stored;
      try { stored = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { stored = {}; }
      if (!stored || typeof stored !== 'object' || Array.isArray(stored)) stored = {};
      let preferences = {
        enabled: typeof stored.enabled === 'boolean' ? stored.enabled : DEFAULTS.enabled,
        mode: stored.mode === 'transparent' ? 'transparent' : DEFAULTS.mode,
        tint: Number.isFinite(stored.tint) ? Math.max(0, Math.min(60, stored.tint)) : DEFAULTS.tint
      };
      const bridge = globalThis.__DSH_NATIVE_GLASS__;
      let snapshot = { ...preferences, ready: false, error: '' };
      const listeners = new Set();
      const publish = changes => { snapshot = { ...snapshot, ...changes }; for (const listener of listeners) listener(); };
      let disposed = false;
      let generation = 0;
      const style = document.createElement('style');
      style.id = 'dsh-desktop-glass-style';
      style.textContent = `
html[data-dsh-glass], html[data-dsh-glass] body { background:transparent !important; }
html[data-dsh-glass] body {
  isolation:isolate;
  --dsw-alias-bg-base:transparent !important;
  --dsw-alias-bg-module-platform:rgb(var(--dsh-glass-rgb) / .08) !important;
  --dsw-alias-bg-layer-1:rgb(var(--dsh-glass-rgb) / .08) !important;
  --dsw-alias-bg-layer-2:rgb(var(--dsh-glass-rgb) / .18) !important;
  --dsw-alias-bg-layer-3:rgb(var(--dsh-glass-rgb) / .32) !important;
  --dsw-alias-bg-layer-4:rgb(var(--dsh-glass-rgb) / .45) !important;
  --dsw-specific-sidebar-fill:rgb(var(--dsh-glass-rgb) / .04) !important;
  --dsw-specific-input-major:rgb(var(--dsh-glass-rgb) / .30) !important;
  --dsw-specific-bubble:rgb(var(--dsh-glass-rgb) / .18) !important;
}
#dsh-desktop-glass-veil { display:none; position:fixed; inset:0; z-index:-1; pointer-events:none; background:rgb(var(--dsh-glass-rgb) / var(--dsh-glass-tint)); }
html[data-dsh-glass=glass] #dsh-desktop-glass-veil { display:block; }
html[data-dsh-glass=transparent] body {
  --dsw-alias-bg-module-platform:transparent !important;
  --dsw-alias-bg-layer-1:transparent !important;
  --dsw-alias-bg-layer-2:transparent !important;
  --dsw-alias-bg-layer-3:transparent !important;
  --dsw-alias-bg-layer-4:transparent !important;
  --dsw-specific-sidebar-fill:transparent !important;
  --dsw-specific-input-major:transparent !important;
  --dsw-specific-bubble:transparent !important;
}
html[data-dsh-glass] :is([role=dialog],[role=menu],[role=listbox]) {
  --dsw-alias-bg-base:rgb(var(--dsh-glass-rgb)) !important;
  --dsw-alias-bg-module-platform:rgb(var(--dsh-glass-rgb)) !important;
  --dsw-alias-bg-layer-1:rgb(var(--dsh-glass-rgb)) !important;
  --dsw-alias-bg-layer-2:rgb(var(--dsh-glass-rgb)) !important;
  --dsw-alias-bg-layer-3:rgb(var(--dsh-glass-rgb)) !important;
  --dsw-alias-bg-layer-4:rgb(var(--dsh-glass-rgb)) !important;
}
.dsh-glass-settings { display:grid;gap:12px;padding:16px 0;color:var(--dsw-alias-label-primary);font:inherit; }
.dsh-glass-settings label { display:flex;align-items:center;justify-content:space-between;gap:20px;font-size:13px; }
.dsh-glass-settings input[type=range] { width:170px;accent-color:#6589cd; }
.dsh-glass-settings select { padding:6px 10px;border:1px solid var(--dsw-alias-border-l3,#8885);border-radius:7px;background:var(--dsw-alias-bg-layer-2,#8882);color:inherit;font:inherit; }
.dsh-glass-settings small { color:var(--dsw-alias-label-secondary);line-height:1.6; }
.dsh-glass-settings button { cursor:pointer;padding:6px 10px;border:1px solid var(--dsw-alias-border-l3,#8885);border-radius:7px;background:var(--dsw-alias-bg-layer-2,#8882);color:inherit;font:inherit;font-size:12px; }
`;
      const veil = document.createElement('div');
      veil.id = 'dsh-desktop-glass-veil';
      veil.setAttribute('aria-hidden', 'true');
      const properties = ['--dsh-glass-rgb', '--dsh-glass-tint'];
      const previous = new Map(properties.map(key => [key, [document.body.style.getPropertyValue(key), document.body.style.getPropertyPriority(key)]]));
      function syncStyle() {
        const dark = document.body.hasAttribute('data-ds-dark-theme') || document.documentElement.hasAttribute('data-ds-dark-theme');
        document.body.style.setProperty('--dsh-glass-rgb', dark ? '24 25 29' : '249 250 252');
        document.body.style.setProperty('--dsh-glass-tint', String(preferences.tint / 100));
        if (preferences.enabled && snapshot.ready) document.documentElement.setAttribute('data-dsh-glass', preferences.mode);
        else document.documentElement.removeAttribute('data-dsh-glass');
      }
      async function syncNative() {
        const revision = ++generation;
        if (!bridge || bridge.version < 3 || typeof bridge.setEnabled !== 'function') {
          publish({ ready: false, error: '原生桌面适配尚未加载。请安装原生适配后，从托盘完全退出并重新打开 Harness。' });
          syncStyle();
          return;
        }
        if (!preferences.enabled) { publish({ ready: false }); syncStyle(); }
        try {
          const result = await bridge.setEnabled(preferences.enabled, preferences.mode);
          if (disposed || revision !== generation) return;
          if (!result.supported) throw new Error('当前系统不支持原生窗口背景。');
          publish({ ready: result.enabled, error: '' });
        } catch (error) {
          if (!disposed && revision === generation) publish({ ready: false, error: error.message });
        }
        if (!disposed && revision === generation) syncStyle();
      }
      function update(patch) {
        const oldEnabled = preferences.enabled;
        const oldMode = preferences.mode;
        preferences = { ...preferences, ...patch };
        try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Storage unavailable. */ }
        publish(preferences);
        syncStyle();
        if (oldEnabled !== preferences.enabled || oldMode !== preferences.mode || !snapshot.ready) void syncNative();
      }
      function Settings() {
        const state = React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => snapshot);
        return h('section', { className: 'dsh-glass-settings', 'aria-label': '桌面背景效果' },
          h('label', null, h('strong', null, '桌面背景效果'), h('input', { type: 'checkbox', checked: state.enabled, 'aria-label': '启用桌面背景效果', onChange: e => update({ enabled: e.target.checked }) })),
          h('label', null, h('span', null, '背景模式'), h('select', { value: state.mode, 'aria-label': '背景模式', onChange: e => update({ mode: e.target.value }) }, h('option', { value: 'glass' }, '毛玻璃'), h('option', { value: 'transparent' }, '完全透明'))),
          state.mode === 'glass' && h('label', null, h('span', null, `附加遮罩 ${state.tint}%`), h('input', { type: 'range', min: 0, max: 60, step: 1, value: state.tint, 'aria-label': '附加遮罩', onChange: e => update({ tint: Number(e.target.value) }) })),
          h('small', { role: 'status' }, state.error || (state.ready ? (state.mode === 'glass' ? '毛玻璃已启用 · 失去焦点后保持模糊' : '完全透明已启用 · 无背景模糊和遮罩') : '已恢复原界面')),
          h('div', { style: { display: 'flex', gap: 8 } }, h('button', { type: 'button', onClick: () => update(DEFAULTS) }, '重置效果'), h('button', { type: 'button', onClick: () => update({ enabled: false }) }, '恢复原界面')),
          h('small', null, '实时显示窗口后方的 Wallpaper Engine 壁纸或其他窗口，文字和控件保持清晰。选择会自动保存。Ctrl + Alt + G 开关效果。'));
      }
      ctx.effect(() => {
        document.head.append(style);
        document.body.prepend(veil);
        const observer = new MutationObserver(syncStyle);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
        const onKey = event => {
          if (event.ctrlKey && event.altKey && !event.shiftKey && event.code === 'KeyG' && !event.repeat) { event.preventDefault(); update({ enabled: !preferences.enabled }); }
        };
        document.addEventListener('keydown', onKey);
        syncStyle();
        void syncNative();
        return () => {
          disposed = true; generation++;
          observer.disconnect();
          document.removeEventListener('keydown', onKey);
          document.documentElement.removeAttribute('data-dsh-glass');
          style.remove(); veil.remove();
          for (const [key, [value, priority]] of previous) {
            if (value) document.body.style.setProperty(key, value, priority);
            else document.body.style.removeProperty(key);
          }
          if (bridge?.version >= 2) void bridge.setEnabled(false).catch(() => {});
          listeners.clear();
        };
      }, 'desktop-glass: native Acrylic and reversible foreground styles');
      ctx.slots.inject('settings.general.item', () => ctx.slots.register({ name: 'settings.general.item', id: 'desktop-glass', order: 12 }, Settings));
    }
    return { name: 'dsh-desktop-glass', inject: ['slots'], apply };
  }
});
