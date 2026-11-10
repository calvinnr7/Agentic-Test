/*!
 * nola-launcher.js - Nola chat launcher for Salesforce Enhanced Chat v2 (inline mode)
 *
 * Replaces Salesforce's default chat button with the Nola button (desktop: the Nola-Bot
 * mascot + "Help"; mobile: the mascot alone) and renders the chat inside our own panel.
 * The mascot is a friendly robot, embedded in this file (no extra image file to host).
 * No picture of a person is used (Corporate Affairs decision, Nov 2026). Documented settings and APIs only (displayMode,
 * targetElement, disableInlineAutoLaunch, hideChatButtonOnLoad, utilAPI.launchChat).
 * No CSS on Salesforce's own elements.
 *
 * HOW TO USE (one-time change on the website):
 *   1. Load this file BEFORE Salesforce's chat snippet:
 *        <script src=".../resource/TWG_AG_NL_Launcher_v3" data-label="Help"></script>
 *   2. In the snippet's initEmbeddedMessaging(), before embeddedservice_bootstrap.init(...):
 *        window.NolaLauncher && NolaLauncher.applySettings();
 *
 * If the call is missing, or this file loads after init() has run, the page keeps
 * Salesforce's standard chat button (nothing breaks) and a console warning explains why.
 *
 * Optional data-* attributes on this file's <script> tag:
 *   data-label     button text (default "Help")
 *   data-aria-label  accessible name (default: label + ", chat with Nola")
 *   data-position  "bottom,right" offsets (default "24px,24px")
 *
 * No org ids or secrets in this file; they stay in the site's Salesforce snippet.
 */
(function () {
  'use strict';
  if (window.NolaLauncher) return; // load once per page

  var VERSION = '1.3.0';
  var script = document.currentScript;
  function attr(name, fallback) {
    var v = script && script.getAttribute(name);
    return v ? v : fallback;
  }
  var cfg = {
    label: attr('data-label', 'Help'),
    position: attr('data-position', '24px,24px').split(',')
  };
  cfg.aria = attr('data-aria-label', cfg.label + ', chat with Nola');
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
    // Nola-Bot mascot (desktop beside the label, mobile on its own)
    '#nola-launch .nola-launch-icon{display:block;width:44px;height:44px;border-radius:50%;border:2px solid #FFD400;object-fit:cover;flex:none}',
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
    // Mobile: round mascot button with the yellow ring (label hidden)
    '#nola-launch{width:64px;height:64px;padding:0;gap:0;justify-content:center;right:16px;bottom:16px;',
    '-webkit-tap-highlight-color:transparent;transition:transform .12s ease,box-shadow .12s ease}',
    '#nola-launch:active{transform:scale(.94)}',
    '#nola-launch .nola-launch-label{display:none}',
    '#nola-launch .nola-launch-icon{width:58px;height:58px;border:0}',
    '#nola-panel{inset:0;width:auto;height:auto;max-width:none;max-height:none;border-radius:0}',
    '#nola-panel-min{top:auto;bottom:12px;right:12px}}',
    '@media (prefers-reduced-motion:reduce){#nola-launch,#nola-panel{transition:none!important;animation:none!important}}'
  ].join('');

  // Nola-Bot mascot (JPEG, 144px, embedded so the launcher stays one self-contained file)
  var ICON = '<img class="nola-launch-icon" alt="" width="44" height="44" src="data:image/jpeg;base64,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">';

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
    btn.setAttribute('aria-label', cfg.aria);
    btn.insertAdjacentHTML('beforeend', ICON);
    var text = document.createElement('span');
    text.className = 'nola-launch-label';
    text.textContent = cfg.label;
    btn.appendChild(text);

    panel = document.createElement('div');
    panel.id = 'nola-panel';
    panel.className = 'nola-hidden';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat with Nola');
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
