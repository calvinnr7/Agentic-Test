/**
 * Shared "Session IDs" panel + clipboard helpers.
 *
 * Pages provide the markup; this module fills it and handles copy:
 *
 *   - INLINE  — pages that own their layout (miaw-streaming) author two
 *               `.agent-session-id-row` rows with `#conversationIdValue` /
 *               `#messagingSessionIdValue` spans and matching `.agent-copy-btn`
 *               buttons, then call AgentSessionIds.attach() on DOMContentLoaded.
 *
 *   - EMBEDDED-SDK — pages that delegate the chat UI to Salesforce's Embedded
 *               Service SDK (embedded-bubble/-chat/-split/-fullscreen/-launcher)
 *               get the Conversation ID row from response-timer.js, then call
 *               attach() + mountEmbeddedSdkBridge() to feed it.
 *
 * Both paths feed the same setIds() function.
 *
 * The Embedded-Service hook (mountEmbeddedSdkBridge) listens for
 * onEmbeddedMessageSent / onEmbeddedMessagingConversationOpened events and
 * extracts the IDs from the SCRT2 conversationEntry payload — same shape the
 * Heroku proxy already parses on the headless pages.
 */
(function (global) {
    'use strict';

    const state = {
        conversationId: null,
        messagingSessionId: null
    };

    function setValueAndEnable(valueElId, btnId, value) {
        if (!value) return;
        const valueEl = document.getElementById(valueElId);
        const btn = document.getElementById(btnId);
        if (valueEl) {
            valueEl.textContent = value;
            valueEl.classList.remove('empty');
            valueEl.title = value;
        }
        if (btn) btn.disabled = false;
    }

    async function copyValue(btn) {
        const targetId = btn.getAttribute('data-target');
        const valueEl = document.getElementById(targetId);
        const value = valueEl?.textContent?.trim();
        if (!value || valueEl.classList.contains('empty')) return;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(value);
            } else {
                const ta = document.createElement('textarea');
                ta.value = value;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            const label = btn.querySelector('.copy-label');
            const original = label ? label.textContent : null;
            btn.classList.add('copied');
            if (label) label.textContent = 'Copied';
            setTimeout(() => {
                btn.classList.remove('copied');
                if (label && original !== null) label.textContent = original;
            }, 1500);
        } catch (err) {
            console.error('[SessionIds] Clipboard copy failed:', err);
        }
    }

    /**
     * Wire up copy buttons. Idempotent — safe to call multiple times.
     */
    function attach() {
        document.querySelectorAll('.agent-copy-btn').forEach(btn => {
            if (btn.dataset.agentWired === '1') return;
            btn.dataset.agentWired = '1';
            btn.addEventListener('click', () => copyValue(btn));
        });
    }

    /**
     * Push values into the visible panel (inline OR floating).
     * Called by the page's data source (SSE handler or SDK event listener).
     *
     * Updates the panel whenever the incoming value differs from what's
     * already there. The previous "first-write-wins" guard caused stale IDs
     * on the SDK pages when the embedded chat created a new conversation
     * after the page already had one cached.
     */
    function setIds({ conversationId, messagingSessionId } = {}) {
        if (conversationId && conversationId !== state.conversationId) {
            state.conversationId = conversationId;
            setValueAndEnable('conversationIdValue', 'copyConversationIdBtn', conversationId);
        }
        if (messagingSessionId && messagingSessionId !== state.messagingSessionId) {
            state.messagingSessionId = messagingSessionId;
            setValueAndEnable('messagingSessionIdValue', 'copyMessagingSessionIdBtn', messagingSessionId);
        }
    }

    /**
     * Subscribe to Salesforce Embedded Service SDK lifecycle events and read the
     * conversation ID from the SDK's persisted localStorage / sessionStorage.
     *
     * The Salesforce SDK persists per-deployment keys with two well-known formats:
     *   - ESW_CONVERSATION_ID_<deploymentName>
     *   - ESW_<deploymentName>_CONVERSATION_ID
     * Both shapes have shipped in different SDK versions, so we probe both.
     *
     * Messaging Session ID is NOT exposed by the SDK on the host page. The SDK
     * keeps it inside its iframe; only the entryPayload events on the SCRT2 SSE
     * stream carry it. So embedded-SDK pages can only show Conversation ID.
     *
     * @param {string} [deploymentName] - Optional. If known, used as a hint when
     *   probing the storage keys. If omitted the function tries every ESW_ key.
     */
    function mountEmbeddedSdkBridge(deploymentName) {
        let pollHandle = null;

        function readConversationIdFromStorage() {
            const stores = [];
            try { if (window.localStorage) stores.push(window.localStorage); } catch (_) {}
            try { if (window.sessionStorage) stores.push(window.sessionStorage); } catch (_) {}

            for (const store of stores) {
                const len = store.length;
                for (let i = 0; i < len; i++) {
                    const k = store.key(i);
                    if (!k || !k.startsWith('ESW_')) continue;
                    if (deploymentName && !k.includes(deploymentName)) continue;
                    if (!/CONVERSATION_ID/i.test(k)) continue;
                    const v = store.getItem(k);
                    if (v && /^[0-9a-f-]{16,}$/i.test(v)) return v;
                }
            }
            return null;
        }

        function tryReadAndSet() {
            const id = readConversationIdFromStorage();
            if (id) setIds({ conversationId: id });
        }

        /**
         * Run a short burst of polls (30s, 500ms apart) to catch the moment
         * the SDK writes a new conversation ID to storage. Re-armable — called
         * on initial mount AND on every SDK lifecycle event so a *new*
         * conversation that starts later in the page lifecycle is captured.
         */
        function armPoll() {
            if (pollHandle) clearInterval(pollHandle);
            let attempts = 0;
            const startedAtId = state.conversationId;
            pollHandle = setInterval(() => {
                attempts++;
                tryReadAndSet();
                // Stop once we've observed a NEW id (different from when we
                // armed) or after 30s — whichever comes first.
                if ((state.conversationId && state.conversationId !== startedAtId) || attempts >= 60) {
                    clearInterval(pollHandle);
                    pollHandle = null;
                }
            }, 500);
        }

        function handleEvent(event) {
            try {
                const detail = event?.detail || event?.data || {};
                const directId = detail.conversationId
                    || detail.conversation?.conversationId
                    || detail.conversationEntry?.entryPayload?.conversationIdentifier;
                if (directId) setIds({ conversationId: directId });
            } catch (_) {}
            tryReadAndSet();
        }

        function handleConversationOpened(event) {
            handleEvent(event);
            // SDK just opened a (possibly new) conversation — re-arm the poll
            // in case storage hasn't been written yet.
            armPoll();
        }

        function handleConversationClosed() {
            // Reset the panel back to "waiting…" so the next conversation's ID
            // visibly populates instead of leaving a stale value on screen.
            reset();
            const valueEl = document.getElementById('conversationIdValue');
            const btn = document.getElementById('copyConversationIdBtn');
            if (valueEl) {
                valueEl.textContent = 'waiting…';
                valueEl.classList.add('empty');
                valueEl.removeAttribute('title');
            }
            if (btn) btn.disabled = true;
            armPoll();
        }

        // Subscribe to the documented SDK lifecycle events.
        window.addEventListener('onEmbeddedMessagingReady', handleEvent);
        window.addEventListener('onEmbeddedMessagingConversationOpened', handleConversationOpened);
        window.addEventListener('onEmbeddedMessagingFirstBotMessageSent', handleEvent);
        window.addEventListener('onEmbeddedMessagingConversationParticipantChanged', handleEvent);
        window.addEventListener('onEmbeddedMessageSent', handleEvent);
        window.addEventListener('onEmbeddedMessagingConversationClosed', handleConversationClosed);
        window.addEventListener('onEmbeddedMessagingWindowClosed', handleConversationClosed);

        // Initial 30s burst (page may load before SDK persists storage).
        armPoll();
    }

    /**
     * Clear the cached IDs so the next session repopulates the panel instead of
     * comparing against (and rejecting) a stale value in setIds(). Called by the
     * page's New Conversation handler and by handleConversationClosed().
     */
    function reset() {
        state.conversationId = null;
        state.messagingSessionId = null;
    }

    global.AgentSessionIds = {
        attach,
        setIds,
        mountEmbeddedSdkBridge,
        reset,
        getState: () => ({ ...state })
    };
})(window);
