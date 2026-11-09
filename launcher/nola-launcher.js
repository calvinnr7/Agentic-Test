/*!
 * nola-launcher.js - Nola chat launcher for Salesforce Enhanced Chat v2 (inline mode)
 *
 * Replaces Salesforce's default chat button with the Nola button (desktop: speech-bubble
 * icon + "Help"; mobile: the speech-bubble icon alone) and renders the chat inside our
 * own panel. No picture of Nola is used anywhere (Corporate Affairs decision, Nov 2026). Documented settings and APIs only (displayMode,
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

  var VERSION = '1.2.0';
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
    'display:flex;align-items:center;gap:10px;padding:10px 22px 10px 14px;border:3px solid #FFD400;',
    'border-radius:999px;background:#E20512;color:#fff;font:700 16px/1 -apple-system,BlinkMacSystemFont,',
    '"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}',
    '#nola-launch[hidden]{display:none}',
    '#nola-launch:hover{background:#A61F25}',
    '#nola-launch:focus-visible{outline:3px solid #243C94;outline-offset:3px}',
    // speech-bubble icon (desktop beside the label, mobile on its own)
    '#nola-launch .nola-launch-bubble{display:block;width:30px;height:30px;flex:none}',
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
    // Mobile: round speech-bubble button, no face (Nola appears once the chat is open)
    '#nola-launch{width:60px;height:60px;padding:0;gap:0;justify-content:center;border:0;',
    'background:linear-gradient(145deg,#F2303A 0%,#E20512 55%,#B8040F 100%);',
    'box-shadow:0 8px 20px rgba(226,5,18,.38),0 2px 6px rgba(0,0,0,.22);right:16px;bottom:16px;',
    '-webkit-tap-highlight-color:transparent;transition:transform .12s ease,box-shadow .12s ease}',
    '#nola-launch:hover{background:linear-gradient(145deg,#F2303A 0%,#E20512 55%,#B8040F 100%)}',
    '#nola-launch:active{transform:scale(.94);box-shadow:0 4px 12px rgba(226,5,18,.35),0 1px 4px rgba(0,0,0,.2)}',
    '#nola-launch .nola-launch-label{display:none}',
    '#nola-launch .nola-launch-bubble{display:block;width:34px;height:34px}',
    '#nola-panel{inset:0;width:auto;height:auto;max-width:none;max-height:none;border-radius:0}',
    '#nola-panel-min{top:auto;bottom:12px;right:12px}}',
    '@media (prefers-reduced-motion:reduce){#nola-launch,#nola-panel{transition:none!important;animation:none!important}}'
  ].join('');

  // Mobile icon: white speech bubble with three dots, plus a small yellow sparkle (AI cue)
  var BUBBLE = '<svg class="nola-launch-bubble" viewBox="0 0 34 34" aria-hidden="true" focusable="false">' +
    '<path fill="#fff" d="M6 8h16a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4H14l-5.5 4.5V25H6a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4z"/>' +
    '<circle cx="8.5" cy="16.5" r="1.7" fill="#E20512"/><circle cx="14" cy="16.5" r="1.7" fill="#E20512"/>' +
    '<circle cx="19.5" cy="16.5" r="1.7" fill="#E20512"/>' +
    '<path fill="#FFDD02" d="M27 1.5l1.3 3.7L32 6.5l-3.7 1.3L27 11.5l-1.3-3.7L22 6.5l3.7-1.3z"/></svg>';

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
    btn.insertAdjacentHTML('beforeend', BUBBLE);
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
