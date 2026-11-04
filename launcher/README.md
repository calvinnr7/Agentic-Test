# Nola chat launcher (hosted in Salesforce)

`nola-launcher.js` replaces Salesforce's default chat button on the website with the Nola button, and shows the chat in a panel at the bottom right.

- Desktop: Nola's face + "Chat with Nola". Mobile (640px or less): Nola's face only, and the chat opens full screen.
- Uses Salesforce Enhanced Chat v2 **inline mode** and documented APIs only (`displayMode`, `targetElement`, `disableInlineAutoLaunch`, `hideChatButtonOnLoad`, `utilAPI.launchChat()`). No CSS on Salesforce's own elements.
- No org IDs or secrets in the file. Those stay in the website's Salesforce snippet.
- The chat window itself (header, branding) is unchanged: it comes from the Embedded Service deployment.

## Files

| File | Use |
|---|---|
| `nola-launcher.js` | Readable source |
| `nola-launcher.min.js` | Minified copy (same behaviour). Use this as the static resource |

## What the website pastes (one time)

Two changes to the page that already has the Nola chat snippet:

**1. Load the launcher before Salesforce's snippet** (a plain `<script>`, no `defer` or `async`):

```html
<script src="https://<ESW site URL>/sfsites/c/resource/TWG_AG_NL_Launcher"
        data-avatar="https://<ESW site URL>/sfsites/c/resource/TWG_AG_NL_Avatar_512"
        data-label="Chat with Nola"></script>
```

**2. Add one line inside `initEmbeddedMessaging()`, before `embeddedservice_bootstrap.init(...)`:**

```js
window.NolaLauncher && NolaLauncher.applySettings();
```

Full example (Salesforce's standard Code Snippet with the one added line):

```html
<script src="https://<ESW site URL>/sfsites/c/resource/TWG_AG_NL_Launcher"
        data-avatar="https://<ESW site URL>/sfsites/c/resource/TWG_AG_NL_Avatar_512"
        data-label="Chat with Nola"></script>
<script type="text/javascript">
  function initEmbeddedMessaging() {
    try {
      embeddedservice_bootstrap.settings.language = 'en_US';
      embeddedservice_bootstrap.settings.enableUserInputForConversationWithBot = false;
      window.NolaLauncher && NolaLauncher.applySettings();   // added line

      embeddedservice_bootstrap.init(
        '<ORG_ID>',
        'TWG_AG_NL_Web',
        'https://<ESW site URL>',
        { scrt2URL: '<SCRT2_URL>' }
      );
    } catch (err) {
      console.error('Error loading Embedded Messaging: ', err);
    }
  }
</script>
<script type="text/javascript" src="https://<ESW site URL>/assets/js/bootstrap.min.js" onload="initEmbeddedMessaging()"></script>
```

If the launcher file fails to load, or the added line is missing, the page keeps Salesforce's standard chat button and nothing breaks. A console message explains why.

## Optional settings (on the launcher's `<script>` tag)

| Attribute | Default | Meaning |
|---|---|---|
| `data-avatar` | none | URL of Nola's face image |
| `data-label` | `Chat with Nola` | Button text and accessible name |
| `data-position` | `24px,24px` | Bottom and right offsets of the button and panel |

## Environment values

| | Dev (twg-dev) | UAT (twg-uat) |
|---|---|---|
| ESW site URL | `https://twg--agentforce.sandbox.my.site.com/ESWTWGAGNLWeb1791378486755` | `https://twg--uat.sandbox.my.site.com/ESWTWGAGNLWeb1792712493328` |
| Org ID | `00DBn00000BpIe5` | `00D9D0000001WTy` |
| scrt2 URL | `https://twg--agentforce.sandbox.my.salesforce-scrt.com` | From UAT Setup > Embedded Service Deployments > Code Snippet |

Static resources load from `<ESW site URL>/sfsites/c/resource/<name>`. The `<ESW site URL>/resource/<name>` path returns 404.

## Salesforce static resource

| | |
|---|---|
| Name | `TWG_AG_NL_Launcher` |
| Content | `nola-launcher.min.js` |
| Content type | `application/javascript` |
| Cache control | Public |

Browsers may keep the old file for a while after an update. To force the new one, add a version to the URL on the website, for example `.../TWG_AG_NL_Launcher?v=2`.

## Behaviour

| Customer action | Result |
|---|---|
| Page loads | Only the Nola button shows |
| Clicks the Nola button | Chat opens in the panel (`launchChat()`) |
| Minimises (our button or Salesforce's chevron) | Panel hides, Nola button returns, conversation keeps going |
| Clicks the Nola button again | Same conversation comes back |
| Ends the chat, then clicks again | New conversation (`launchChat({ shouldStartNewConversation: true })`, falling back to `clearSession()` then `launchChat()`) |

## Known limits

- Requires an Enhanced Chat v2 deployment (inline mode is v2 only).
- The button shows whenever Salesforce's chat is ready. The Nola channel has no business hours today; if they're added later, the button still shows outside them.
- Load the launcher once per page. A second copy is ignored.
