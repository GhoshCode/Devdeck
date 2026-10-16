// Applies the saved theme before the app renders, so the page never flashes
// the wrong theme. An external file (not an inline <script>) because the MV3
// extension's Content Security Policy blocks inline scripts.
// Keep in sync with src/lib/skin.ts (skinFor) and src/lib/appearance.ts.
(function () {
  try {
    var data = JSON.parse(localStorage.getItem('devdeck') || '{}');
    var s = (data && data.state && data.state.settings) || {};
    var mode = s.themeMode || 'dark';
    var look = s;
    // "Auto": the OS decides the mode; that mode's remembered look decides the skin.
    if (s.followSystem && window.matchMedia) {
      var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      if (system !== mode) {
        mode = system;
        look = (s.modeLooks && s.modeLooks[system]) || {
            presetTheme: 'default-' + system,
            accentColor: system === 'light' ? '#007aff' : '#ff2e9a',
            backgroundImage: null,
          };
      }
    }
    var html = document.documentElement;
    html.setAttribute('data-theme', mode);
    var sonoma =
      mode === 'light' && !look.backgroundImage && (!look.presetTheme || look.presetTheme === 'default-light');
    if (sonoma) html.setAttribute('data-skin', 'sonoma');
    if (s.reduceTransparency) html.setAttribute('data-reduce-transparency', '');
    var accent = look.accentColor || s.accentColor;
    if (accent) {
      html.style.setProperty('--color-accent', accent);
      html.style.setProperty('--user-accent', accent);
    }
  } catch (e) {
    // Unreadable storage: the app applies the theme once it loads.
  }
})();
