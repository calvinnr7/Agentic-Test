// Dual Response Timer for Salesforce Embedded Messaging
class ResponseTimer {
    constructor() {
        this.startTime = null;
        this.firstTokenTime = null;
        this.completeTime = null;
        this.timerInterval = null;
        this.isRunning = false;
        this.firstTokenReceived = false;
        this.completeDebounceTimer = null;

        this.createTimerUI();
        this.initializeTimer();
    }

    createTimerUI() {
        const timerContainer = document.createElement('div');
        timerContainer.id = 'response-timer';
        timerContainer.innerHTML = `
            <div class="timer-card">
                <div class="timer-header">
                    <span class="timer-icon">⏱️</span>
                    <span class="timer-label">Response Metrics</span>
                </div>
                <div class="timer-metrics">
                    <div class="metric-row">
                        <span class="metric-label">First Token:</span>
                        <div class="metric-value">
                            <span id="ttft-value" class="timer-value">0.0</span>
                            <span class="timer-unit">s</span>
                        </div>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Complete:</span>
                        <div class="metric-value">
                            <span id="total-value" class="timer-value">0.0</span>
                            <span class="timer-unit">s</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(timerContainer);
        this.appendConversationRow(timerContainer.querySelector('.timer-card'));
        this.makeCollapsible(timerContainer);
    }

    /**
     * Wrap the timer card in a click-to-expand pill so it never overlaps page
     * content. Collapsed by default; expands on click and stays open until the
     * user clicks the pill again. Adds an explicit toggle button so the affordance
     * is discoverable.
     *
     * Persistence: the chosen state survives reloads via sessionStorage so a
     * user who expanded once isn't re-collapsed on every navigation.
     */
    makeCollapsible(root) {
        const STATE_KEY = 'agent_response_timer_expanded';
        const card = root.querySelector('.timer-card');
        if (!card) return;

        // Build a small pill that's always visible. The card sits inside it.
        root.classList.add('timer-collapsible');

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'timer-toggle';
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', 'Show response metrics and conversation ID');

        const icon = document.createElement('span');
        icon.className = 'timer-toggle-icon';
        icon.textContent = '⏱';
        toggleBtn.appendChild(icon);

        const label = document.createElement('span');
        label.className = 'timer-toggle-label';
        label.textContent = 'Metrics';
        toggleBtn.appendChild(label);

        const chevron = document.createElement('span');
        chevron.className = 'timer-toggle-chevron';
        chevron.textContent = '▸';
        toggleBtn.appendChild(chevron);

        // Insert the toggle BEFORE the card and start collapsed unless saved state says otherwise.
        root.insertBefore(toggleBtn, card);

        let initial = 'collapsed';
        try {
            if (sessionStorage.getItem(STATE_KEY) === 'expanded') initial = 'expanded';
        } catch (_) {}
        root.dataset.state = initial;
        toggleBtn.setAttribute('aria-expanded', initial === 'expanded' ? 'true' : 'false');

        toggleBtn.addEventListener('click', () => {
            const next = root.dataset.state === 'expanded' ? 'collapsed' : 'expanded';
            root.dataset.state = next;
            toggleBtn.setAttribute('aria-expanded', next === 'expanded' ? 'true' : 'false');
            try { sessionStorage.setItem(STATE_KEY, next); } catch (_) {}
        });
    }

    /**
     * Append a "Conversation ID" row to the existing Response Metrics card.
     * Built with createElement (not innerHTML) to keep the markup safe and
     * to reuse the IDs the shared AgentSessionIds module already populates.
     * Appended at the bottom of the card, separated by the same border line
     * used between the existing metric rows.
     */
    appendConversationRow(card) {
        if (!card) return;

        const wrap = document.createElement('div');
        wrap.className = 'timer-conversation-id';

        const label = document.createElement('span');
        label.className = 'metric-label';
        label.textContent = 'Session ID';
        wrap.appendChild(label);

        const valueRow = document.createElement('div');
        valueRow.className = 'timer-conversation-id-row';

        const value = document.createElement('span');
        value.className = 'timer-conversation-id-value agent-session-id-value empty';
        value.id = 'conversationIdValue';
        value.textContent = 'waiting…';
        valueRow.appendChild(value);

        const btn = document.createElement('button');
        btn.id = 'copyConversationIdBtn';
        btn.className = 'agent-copy-btn timer-copy-btn';
        btn.dataset.target = 'conversationIdValue';
        btn.disabled = true;
        btn.title = 'Copy Session ID';

        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('width', '11');
        svg.setAttribute('height', '11');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', '9'); rect.setAttribute('y', '9');
        rect.setAttribute('width', '13'); rect.setAttribute('height', '13');
        rect.setAttribute('rx', '2'); rect.setAttribute('ry', '2');
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
        svg.appendChild(rect);
        svg.appendChild(p);
        btn.appendChild(svg);
        const lbl = document.createElement('span');
        lbl.className = 'copy-label';
        lbl.textContent = 'Copy';
        btn.appendChild(lbl);
        valueRow.appendChild(btn);

        wrap.appendChild(valueRow);
        card.appendChild(wrap);

        if (window.AgentSessionIds && window.AgentSessionIds.attach) {
            window.AgentSessionIds.attach();
        }
    }

    initializeTimer() {
        console.log('Initializing Salesforce Embedded Messaging event listeners...');

        // Listen for when a message is sent (by user, bot, or agent)
        window.addEventListener('onEmbeddedMessageSent', (event) => {
            console.log('onEmbeddedMessageSent event received:', event);
            this.handleMessageSent(event);
        });

        // Listen for when messaging is ready
        window.addEventListener('onEmbeddedMessagingReady', () => {
            console.log('Embedded messaging is ready');
        });

        // Listen for conversation participant changes (bot/agent joins)
        window.addEventListener('onEmbeddedMessagingConversationParticipantChanged', (event) => {
            console.log('Participant changed:', event);
        });

        console.log('Event listeners registered successfully');
    }

    handleMessageSent(event) {
        try {
            const eventData = event.detail || event.data || {};
            console.log('=== Message Event Received ===');

            // Extract conversationEntry which contains the actual sender info
            const conversationEntry = eventData.conversationEntry || {};
            const entryType = conversationEntry.entryType; // "Message" or "StreamingToken"
            const senderObj = conversationEntry.sender || {};
            const senderRole = senderObj.role; // "EndUser" or "Chatbot"

            console.log('Entry Type:', entryType);
            console.log('Sender Role:', senderRole);
            console.log('Timer running:', this.isRunning);
            console.log('First token received:', this.firstTokenReceived);

            // User message detection
            if (senderRole === 'EndUser') {
                console.log('✓ User message detected - resetting and starting timers');
                this.resetTimers();
                this.startTimers();
            }
            // Bot/Agent response detection
            else if (senderRole === 'Chatbot' || senderRole === 'Agent' || senderRole === 'Bot') {
                if (this.isRunning) {
                    // First token from bot - record TTFT
                    if (!this.firstTokenReceived) {
                        console.log('✓ First token received from bot (TTFT)');
                        this.recordFirstToken();
                    } else {
                        console.log('✓ Additional streaming token from bot');
                    }

                    // Debounce to detect when response is complete
                    this.debounceComplete();
                } else {
                    console.log('⚠ Bot message but timer not running - ignoring (response already complete)');
                }
            }
            // Unknown sender
            else {
                console.log('⚠ Unknown sender role:', senderRole);
            }
        } catch (error) {
            console.error('Error handling message event:', error);
        }
    }

    startTimers() {
        if (this.isRunning) {
            console.log('Timers already running');
            return;
        }

        console.log('Starting response timers');
        this.isRunning = true;
        this.startTime = Date.now();
        this.firstTokenReceived = false;
        this.firstTokenTime = null;
        this.completeTime = null;

        this.timerInterval = setInterval(() => {
            this.updateDisplay();
        }, 100); // Update every 100ms for smooth display
    }

    recordFirstToken() {
        this.firstTokenReceived = true;
        this.firstTokenTime = Date.now();

        const ttft = (this.firstTokenTime - this.startTime) / 1000;
        console.log(`TTFT: ${ttft.toFixed(3)}s`);

        this.updateTTFTDisplay(ttft);
    }

    debounceComplete() {
        // Clear existing debounce timer
        if (this.completeDebounceTimer) {
            clearTimeout(this.completeDebounceTimer);
        }

        // Set new debounce timer - if no new messages for 500ms, consider complete
        this.completeDebounceTimer = setTimeout(() => {
            this.recordComplete();
        }, 500);
    }

    recordComplete() {
        if (!this.isRunning) return;

        console.log('Response complete detected');
        this.isRunning = false;
        this.completeTime = Date.now();

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        const totalTime = (this.completeTime - this.startTime) / 1000;
        const ttft = this.firstTokenTime ? (this.firstTokenTime - this.startTime) / 1000 : 0;

        console.log(`Total time: ${totalTime.toFixed(3)}s`);

        this.updateTTFTDisplay(ttft);
        this.updateTotalDisplay(totalTime);
        this.updateCardColor(ttft);
    }

    updateDisplay() {
        if (!this.startTime || !this.isRunning) return;

        const elapsed = (Date.now() - this.startTime) / 1000;

        // Update TTFT display
        if (this.firstTokenReceived && this.firstTokenTime) {
            const ttft = (this.firstTokenTime - this.startTime) / 1000;
            this.updateTTFTDisplay(ttft);
        } else {
            this.updateTTFTDisplay(elapsed);
        }

        // Update total display (always shows elapsed)
        this.updateTotalDisplay(elapsed);

        // Update color based on TTFT (or current elapsed if no first token yet)
        const referenceTime = this.firstTokenReceived && this.firstTokenTime
            ? (this.firstTokenTime - this.startTime) / 1000
            : elapsed;
        this.updateCardColor(referenceTime);
    }

    updateTTFTDisplay(time) {
        const ttftElement = document.getElementById('ttft-value');
        if (ttftElement) {
            ttftElement.textContent = time.toFixed(1);
        }
    }

    updateTotalDisplay(time) {
        const totalElement = document.getElementById('total-value');
        if (totalElement) {
            totalElement.textContent = time.toFixed(1);
        }
    }

    updateCardColor(ttft) {
        const timerCard = document.querySelector('.timer-card');
        if (!timerCard) return;

        timerCard.classList.remove('timer-green', 'timer-yellow', 'timer-red');

        if (ttft <= 8) {
            timerCard.classList.add('timer-green');
        } else if (ttft <= 10) {
            timerCard.classList.add('timer-yellow');
        } else {
            timerCard.classList.add('timer-red');
        }
    }

    resetTimers() {
        this.startTime = null;
        this.firstTokenTime = null;
        this.completeTime = null;
        this.firstTokenReceived = false;

        if (this.completeDebounceTimer) {
            clearTimeout(this.completeDebounceTimer);
            this.completeDebounceTimer = null;
        }

        this.updateTTFTDisplay(0);
        this.updateTotalDisplay(0);

        const timerCard = document.querySelector('.timer-card');
        if (timerCard) {
            timerCard.classList.remove('timer-green', 'timer-yellow', 'timer-red');
        }
    }

    // Manual control methods (can be called from console for testing)
    manualStart() {
        this.resetTimers();
        this.startTimers();
    }

    manualFirstToken() {
        if (this.isRunning && !this.firstTokenReceived) {
            this.recordFirstToken();
        }
    }

    manualComplete() {
        if (this.isRunning) {
            this.recordComplete();
        }
    }
}

// Initialize timer when document is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.responseTimer = new ResponseTimer();
    });
} else {
    window.responseTimer = new ResponseTimer();
}

// Expose manual controls globally for testing
window.startResponseTimer = () => window.responseTimer && window.responseTimer.manualStart();
window.firstTokenReceived = () => window.responseTimer && window.responseTimer.manualFirstToken();
window.responseComplete = () => window.responseTimer && window.responseTimer.manualComplete();

console.log('Dual Response Timer loaded. Manual testing: startResponseTimer(), firstTokenReceived(), responseComplete()');
