# Nola chat launcher (hosted in Salesforce)

`nola-launcher.js` replaces Salesforce's default chat button on the website with the Nola button, and shows the chat in a panel at the bottom right.

- Desktop: a speech-bubble icon + "Help". Mobile (640px or less): the round speech-bubble button alone, and the chat opens full screen. No picture of Nola is used anywhere (Corporate Affairs decision, Nov 2026); the NL logo shows once, in the chat window header.
- Every change to this file needs a new Salesforce resource name (`_v3`, `_v4`, ...) because Salesforce serves an old file at an unchanged URL for a long time. An old paste that still has a `data-avatar` attribute is simply ignored.
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
<script src="https://<ESW site URL>/sfsites/c/resource/TWG_AG_NL_Launcher_v3"
        data-label="Help"></script>
```

**2. Add one line inside `initEmbeddedMessaging()`, before `embeddedservice_bootstrap.init(...)`:**

```js
window.NolaLauncher && NolaLauncher.applySettings();
```

Full example (Salesforce's standard Code Snippet with the one added line):

```html
<script src="https://<ESW site URL>/sfsites/c/resource/TWG_AG_NL_Launcher_v3"
        data-label="Help"></script>
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
| `data-label` | `Help` | Button text |
| `data-aria-label` | label + ", chat with Nola" | Accessible name (screen readers; the only name on mobile, where the text is hidden) |
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
| Name | `TWG_AG_NL_Launcher_v3` (v1.2.0). Earlier: `TWG_AG_NL_Launcher` (v1.0.0, has a face button), `_v2` (v1.1.0, face on desktop) - do not use |
| Content | `nola-launcher.min.js` |
| Content type | `application/javascript` |
| Cache control | Public |

Salesforce keeps serving the old file at an unchanged URL for a long time after an update (seen: 40+ seconds in the org, up to 45 days per the cache header). So an update is deployed as a **new** resource name (`_v4`, ...) and the website changes that one word in its script URL.

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
