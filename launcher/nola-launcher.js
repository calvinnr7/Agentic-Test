/*!
 * nola-launcher.js - Nola chat launcher for Salesforce Enhanced Chat v2 (inline mode)
 *
 * Replaces Salesforce's default chat button with the Nola button and renders the
 * chat inside our own panel. Documented settings and APIs only (displayMode,
 * targetElement, disableInlineAutoLaunch, hideChatButtonOnLoad, utilAPI.launchChat).
 * No CSS on Salesforce's own elements.
 *
 * HOW TO USE (one-time change on the website):
 *   1. Load this file BEFORE Salesforce's chat snippet:
 *        <script src=".../resource/TWG_AG_NL_Launcher"
 *                data-avatar=".../resource/TWG_AG_NL_Avatar_512"
 *                data-label="Chat with Nola"></script>
 *   2. In the snippet's initEmbeddedMessaging(), before embeddedservice_bootstrap.init(...):
 *        window.NolaLauncher && NolaLauncher.applySettings();
 *
 * If the call is missing, or this file loads after init() has run, the page keeps
 * Salesforce's standard chat button (nothing breaks) and a console warning explains why.
 *
 * Optional data-* attributes on this file's <script> tag:
 *   data-avatar    image URL for Nola's face
 *   data-label     button text (default "Chat with Nola")
 *   data-position  "bottom,right" offsets (default "24px,24px")
 *
 * No org ids or secrets in this file; they stay in the site's Salesforce snippet.
 */
(function () {
  'use strict';
  if (window.NolaLauncher) return; // load once per page

  var VERSION = '1.0.0';
  var script = document.currentScript;
  function attr(name, fallback) {
    var v = script && script.getAttribute(name);
    return v ? v : fallback;
  }
  var cfg = {
    avatar: attr('data-avatar', ''),
    label: attr('data-label', 'Chat with Nola'),
    position: attr('data-position', '24px,24px').split(',')
  };
  var bottom = (cfg.position[0] || '24px').trim();
  var right = (cfg.position[1] || cfg.position[0] || '24px').trim();

  var CSS = [
    '#nola-launch{position:fixed;right:var(--nola-right);bottom:var(--nola-bottom);z-index:2147483000;',
    'display:flex;align-items:center;gap:10px;padding:6px 22px 6px 6px;border:3px solid #FFD400;',
    'border-radius:999px;background:#E20512;color:#fff;font:700 16px/1 -apple-system,BlinkMacSystemFont,',
    '"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}',
    '#nola-launch[hidden]{display:none}',
    '#nola-launch:hover{background:#A61F25}',
    '#nola-launch:focus-visible{outline:3px solid #243C94;outline-offset:3px}',
    '#nola-launch img{width:44px;height:44px;border-radius:50%;border:2px solid #FFD400;object-fit:cover;display:block}',
    // The panel Salesforce renders the chat into: same size as its standard v2 window
    '#nola-panel{position:fixed;right:var(--nola-right);bottom:var(--nola-bottom);z-index:2147483001;',
    'width:480px;height:742px;max-width:calc(100vw - 4rem);max-height:calc(100dvh - 4rem);',
    'border-radius:20px;overflow:hidden;background:#fff;box-shadow:0 24px 60px rgba(20,24,40,.28)}',
    // Hidden with visibility (not display/removal) so the conversation stays live
    '#nola-panel.nola-hidden{visibility:hidden;pointer-events:none}',
    '#nola-inline{width:100%;height:100%}',
    '#nola-panel-min{position:absolute;top:-34px;right:0;z-index:1;border:0;border-radius:999px;',
    'padding:6px 12px;background:#E20512;color:#fff;font:700 13px/1 -apple-system,BlinkMacSystemFont,',
    '"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.2);cursor:pointer}',
    '#nola-panel-min:focus-visible{outline:3px solid #243C94;outline-offset:2px}',
    '@media (max-width:640px){',
    '#nola-launch{padding:4px;right:16px;bottom:16px}',
    '#nola-launch .nola-launch-label{display:none}',
    '#nola-launch img{width:52px;height:52px}',
    '#nola-panel{inset:0;width:auto;height:auto;max-width:none;max-height:none;border-radius:0}',
    '#nola-panel-min{top:auto;bottom:12px;right:12px}}',
    '@media (prefers-reduced-motion:reduce){#nola-launch,#nola-panel{transition:none!important;animation:none!important}}'
  ].join('');

  var btn = null, panel = null, container = null;
  var applied = false, ended = false;

  function build() {
    if (container) return;
    var host = document.body || document.documentElement;
    var style = document.createElement('style');
    style.id = 'nola-launcher-styles';
    style.textContent = CSS;
    (document.head || document.documentElement).appendChild(style);
    document.documentElement.style.setProperty('--nola-bottom', bottom);
    document.documentElement.style.setProperty('--nola-right', right);

    btn = document.createElement('button');
    btn.id = 'nola-launch';
    btn.type = 'button';
    btn.hidden = true;
    btn.setAttribute('aria-label', cfg.label);
    if (cfg.avatar) {
      var img = document.createElement('img');
      img.src = cfg.avatar;
      img.alt = '';
      img.width = 44;
      img.height = 44;
      btn.appendChild(img);
    }
    var text = document.createElement('span');
    text.className = 'nola-launch-label';
    text.textContent = cfg.label;
    btn.appendChild(text);

    panel = document.createElement('div');
    panel.id = 'nola-panel';
    panel.className = 'nola-hidden';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', cfg.label);
    var min = document.createElement('button');
    min.id = 'nola-panel-min';
    min.type = 'button';
    min.setAttribute('aria-label', 'Minimise chat');
    min.textContent = '\u2212 Minimise';
    container = document.createElement('div');
    container.id = 'nola-inline';
    panel.appendChild(min);
    panel.appendChild(container);

    host.appendChild(btn);
    host.appendChild(panel);
    btn.addEventListener('click', open);
    min.addEventListener('click', hide);
  }

  // Called from the snippet, just before embeddedservice_bootstrap.init(...).
  function applySettings() {
    var esb = window.embeddedservice_bootstrap;
    if (!esb || !esb.settings) {
      console.warn('[Nola] applySettings() needs to run inside initEmbeddedMessaging(), before init().');
      return false;
    }
    build();
    esb.settings.displayMode = 'inline';
    esb.settings.targetElement = container;
    esb.settings.disableInlineAutoLaunch = true;
    esb.settings.hideChatButtonOnLoad = true;
    applied = true;
    return true;
  }

  function api() {
    var esb = window.embeddedservice_bootstrap;
    return esb && esb.utilAPI;
  }
  function show() { panel.classList.remove('nola-hidden'); btn.hidden = true; }
  function hide() { panel.classList.add('nola-hidden'); btn.hidden = false; }

  function open() {
    var u = api();
    if (!u) return;
    show();
    // launchChat() starts the chat the first time and re-maximises a minimised one.
    // After a conversation has ended, ask v2 for a new one (ignored if still open).
    var p = ended ? u.launchChat({ shouldStartNewConversation: true }) : u.launchChat();
    p.then(function () { ended = false; })
      .catch(function (err) {
        if (ended) { restartFallback(); return; }
        console.error('[Nola] launchChat failed:', err);
        hide();
      });
  }

  // New conversation after one has ended, if shouldStartNewConversation was refused:
  // clearSession() then launchChat(). clearSession() is on userVerificationAPI on some
  // deployments and on utilAPI on others, so check both.
  function restartFallback() {
    var esb = window.embeddedservice_bootstrap || {};
    var uv = esb.userVerificationAPI, ua = esb.utilAPI;
    var clear = (uv && typeof uv.clearSession === 'function') ? function () { return uv.clearSession(); }
      : (ua && typeof ua.clearSession === 'function') ? function () { return ua.clearSession(); }
      : null;
    if (!clear) { console.error('[Nola] could not start a new conversation: clearSession() not available'); hide(); return; }
    Promise.resolve(clear())
      .then(function () { return new Promise(function (r) { setTimeout(r, 200); }); })
      .then(function () { return api().launchChat(); })
      .then(function () { ended = false; })
      .catch(function (err) { console.error('[Nola] restart failed:', err); hide(); });
  }

  // Salesforce events (always via window; never read embeddedservice_bootstrap.addEventListener)
  window.addEventListener('onEmbeddedMessagingReady', function () {
    if (!applied) {
      console.warn('[Nola] NolaLauncher.applySettings() was not called before init(); keeping Salesforce\'s standard chat button.');
      return;
    }
    if (panel.classList.contains('nola-hidden')) btn.hidden = false;
  });
  // Salesforce's own minimise (chevron in its header) would collapse the chat into its
  // own button. Re-maximise it with launchChat() and hide our panel instead.
  window.addEventListener('onEmbeddedMessagingWindowMinimized', function () {
    if (!applied) return;
    var u = api();
    if (u) u.launchChat().catch(function (err) { console.error('[Nola] re-maximise failed:', err); });
    hide();
  });
  window.addEventListener('onEmbeddedMessagingWindowClosed', function () {
    if (!applied) return;
    ended = true;
    hide();
  });
  window.addEventListener('onEmbeddedMessagingConversationClosed', function () { ended = true; });
  window.addEventListener('onEmbeddedMessagingConversationStarted', function () { ended = false; });

  window.NolaLauncher = { version: VERSION, applySettings: applySettings };
})();
