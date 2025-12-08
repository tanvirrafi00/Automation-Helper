// Content script for element detection and step recording

if (window.hasRun) {
    // Prevent multiple injections
} else {
    window.hasRun = true;

    let isRecording = false;
    let currentPageName = '';
    let currentTestName = '';
    let currentTestCase = '';

    // Inject interceptor script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/interceptor.js');
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);

    // Inject SelectorConverter for test execution
    const selectorConverterScript = document.createElement('script');
    selectorConverterScript.src = chrome.runtime.getURL('src/utils/selectorConverter.js');
    selectorConverterScript.onload = function () {
        console.log('✅ SelectorConverter loaded in page context');
        this.remove();
    };
    (document.head || document.documentElement).appendChild(selectorConverterScript);

    // Overlay management
    let overlay = null;

    function createOverlay() {
        if (overlay) return;

        overlay = document.createElement('div');
        overlay.id = 'automation-helper-overlay';
        overlay.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 999999;
            font-family: sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            min-width: 200px;
            cursor: move;
            user-select: none;
        `;

        // Make draggable
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        overlay.addEventListener("mousedown", dragStart);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("mousemove", drag);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === overlay || overlay.contains(e.target)) {
                isDragging = true;
            }
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, overlay);
            }
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = "translate3d(" + xPos + "px, " + yPos + "px, 0)";
        }

        const title = document.createElement('div');
        title.textContent = '🔴 Recording...';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.color = '#ef4444';
        title.style.cursor = 'move';

        const status = document.createElement('div');
        status.id = 'automation-helper-status';
        status.textContent = 'Waiting for interaction...';
        status.style.fontSize = '12px';

        overlay.appendChild(title);
        overlay.appendChild(status);
        document.body.appendChild(overlay);
    }

    function updateOverlay(text) {
        if (!overlay) return;
        const status = overlay.querySelector('#automation-helper-status');
        if (status) status.textContent = text;
    }

    function removeOverlay() {
        if (overlay) {
            overlay.remove();
            overlay = null;
        }
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PING') {
            // Respond to ping to confirm content script is loaded
            sendResponse({ status: 'ready' });
        } else if (message.type === 'DETECT_ELEMENTS') {
            const elements = detectElements();
            sendResponse({ elements });
        } else if (message.type === 'START_RECORDING') {
            isRecording = true;
            isReplaying = false;
            currentPageName = message.pageName;
            currentTestName = message.testName;
            currentTestCase = message.testCaseName;
            createOverlay();
            sendResponse({ status: 'recording' });
        } else if (message.type === 'STOP_RECORDING') {
            isRecording = false;
            removeOverlay();
            sendResponse({ status: 'stopped' });
        } else if (message.type === 'REPLAY_STEPS') {
            isReplaying = true;
            replaySteps(message.steps);
            sendResponse({ status: 'replaying' });
        } else if (message.type === 'STOP_REPLAY') {
            isReplaying = false;
            updateOverlay('Replay stopped by user.');
            setTimeout(removeOverlay, 1500);
            sendResponse({ status: 'stopped' });
        } else if (message.type === 'CAPTURE_SCREENSHOT') {
            // Request background to capture tab
            chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (response) => {
                sendResponse({ screenshotUrl: response?.dataUrl });
            });
            return true; // Async response
        } else if (message.type === 'GET_STATUS') {
            sendResponse({ isRecording, isReplaying });
        } else if (message.type === 'EXECUTE_STEP') {
            // Execute a test step
            executeTestStep(message.step)
                .then(result => sendResponse({ success: true, result }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true; // Async response
        } else if (message.type === 'CHECK_ELEMENT_EXISTS') {
            // Check if element exists on page
            try {
                // Use SelectorConverter if available, otherwise standard querySelector
                const element = window.SelectorConverter
                    ? SelectorConverter.findElement(message.selector)
                    : document.querySelector(message.selector);
                sendResponse({ exists: !!element });
            } catch (error) {
                sendResponse({ exists: false, error: error.message });
            }
        }
        return true;
    });

    /**
     * Execute a single test step
     * @param {Object} step - Step to execute
     * @returns {Promise<Object>} - Execution result
     */
    async function executeTestStep(step) {
        console.log(`Executing step: ${step.action} on ${step.selector}`);

        try {
            // Find element using SelectorConverter for role selectors
            let element;

            if (step.selector.startsWith('role=') || step.selector.startsWith('text=')) {
                // Use SelectorConverter for Playwright-style selectors
                if (window.SelectorConverter) {
                    element = SelectorConverter.findElement(step.selector);
                } else {
                    throw new Error('SelectorConverter not loaded');
                }
            } else {
                // Standard CSS selector
                element = document.querySelector(step.selector);
            }

            if (!element) {
                throw new Error(`Element not found: ${step.selector}`);
            }

            // Execute action based on step type
            switch (step.action) {
                case 'click':
                    element.click();
                    break;

                case 'fill':
                    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                        element.value = step.value || '';
                        // Trigger input event for frameworks
                        element.dispatchEvent(new Event('input', { bubbles: true }));
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        throw new Error(`Cannot fill non-input element: ${element.tagName}`);
                    }
                    break;

                case 'select':
                    if (element.tagName === 'SELECT') {
                        element.value = step.value || '';
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        throw new Error(`Cannot select on non-select element: ${element.tagName}`);
                    }
                    break;

                case 'navigate':
                    window.location.href = step.value;
                    // Wait for navigation
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    break;

                case 'assertion':
                    // Handle assertions
                    if (step.type === 'toBeVisible') {
                        const isVisible = element.offsetParent !== null;
                        if (!isVisible) {
                            throw new Error(`Assertion failed: Element is not visible`);
                        }
                    } else if (step.type === 'toHaveText') {
                        const text = element.textContent.trim();
                        if (text !== step.value) {
                            throw new Error(`Assertion failed: Expected "${step.value}", got "${text}"`);
                        }
                    }
                    break;

                default:
                    throw new Error(`Unknown action: ${step.action}`);
            }

            console.log(`✅ Step executed successfully`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Step execution failed:`, error);
            throw error;
        }
    }

    // Replay recorded steps
    async function replaySteps(steps) {
        createOverlay();
        updateOverlay('Replaying steps...');

        for (let i = 0; i < steps.length; i++) {
            if (!isReplaying) {
                console.log('Replay stopped by user');
                break;
            }

            const step = steps[i];
            updateOverlay(`Executing: ${step.action} on ${step.elementName}`);

            // Notify popup
            chrome.runtime.sendMessage({
                type: 'REPLAY_PROGRESS',
                stepIndex: i,
                status: 'running'
            });

            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for visibility

            if (!isReplaying) break; // Check again after delay

            try {
                const element = document.querySelector(step.selector);
                if (!element) {
                    console.error(`Element not found: ${step.selector}`);
                    updateOverlay(`Error: Element not found ${step.elementName}`);

                    chrome.runtime.sendMessage({
                        type: 'REPLAY_PROGRESS',
                        stepIndex: i,
                        status: 'failed',
                        error: 'Element not found'
                    });

                    // Optional: Stop on error? For now, continue or maybe stop
                    // isReplaying = false; 
                    continue;
                }

                highlightElement(element);

                if (step.action === 'click') {
                    element.click();
                } else if (step.action === 'fill') {
                    element.value = step.value;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (step.action === 'select') {
                    element.value = step.value;
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                } else if (step.action === 'screenshot') {
                    // Request screenshot
                    await new Promise(resolve => {
                        chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (response) => {
                            // In a real replay, we might want to save this somewhere
                            // For now, we just simulate the delay
                            setTimeout(resolve, 500);
                        });
                    });
                }

                chrome.runtime.sendMessage({
                    type: 'REPLAY_PROGRESS',
                    stepIndex: i,
                    status: 'success'
                });

            } catch (e) {
                console.error(`Error executing step: ${e.message}`);
                chrome.runtime.sendMessage({
                    type: 'REPLAY_PROGRESS',
                    stepIndex: i,
                    status: 'failed',
                    error: e.message
                });
            }
        }

        if (isReplaying) {
            updateOverlay('Replay complete!');
            setTimeout(removeOverlay, 2000);
            isReplaying = false;
        }

        // Notify popup that replay is done (either finished or stopped)
        chrome.runtime.sendMessage({ type: 'REPLAY_COMPLETE' });
    }

    function highlightElement(element) {
        const originalBorder = element.style.border;
        element.style.border = '2px solid #ef4444';
        setTimeout(() => {
            element.style.border = originalBorder;
        }, 800);
    }

    // Detect all interactive elements on the page
    function detectElements() {
        const detector = new ElementDetector();
        return detector.detectElements();
    }

    // Helper to capture screenshot
    async function captureScreenshot() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' });
            return response && response.dataUrl ? response.dataUrl : null;
        } catch (err) {
            console.error('Failed to capture screenshot:', err);
            return null;
        }
    }

    // Record click events
    document.addEventListener('click', async (e) => {
        if (!isRecording) return;

        const element = e.target;
        // Ignore clicks on our overlay
        if (overlay && overlay.contains(element)) return;

        highlightElement(element);

        const selector = generateSelector(element);
        const elementType = getElementType(element);
        const elementName = generateElementName(element, elementType);

        // Capture screenshot
        const screenshot = await captureScreenshot();

        const step = {
            action: 'click',
            selector: selector,
            elementName: elementName,
            elementType: elementType,
            url: window.location.href,
            timestamp: Date.now(),
            screenshot: screenshot // Add screenshot
        };

        updateOverlay(`Clicked: ${elementName}`);

        // Send to background/popup
        chrome.runtime.sendMessage({
            type: 'RECORDED_STEP',
            step: step,
            pageName: currentPageName,
            testName: currentTestName,
            testCase: currentTestCase
        });

    }, true);

    // Debounce timers for input fields (to avoid recording every keystroke)
    const inputDebounceTimers = new Map();
    const INPUT_DEBOUNCE_DELAY = 500; // Wait 500ms after last keystroke

    // Record input events (debounced to capture final value only)
    document.addEventListener('input', async (e) => {
        if (!isRecording) return;

        const element = e.target;

        // Only debounce for text inputs, not for other input types
        const inputType = element.type?.toLowerCase();
        const shouldDebounce = ['text', 'password', 'email', 'search', 'tel', 'url', 'number'].includes(inputType) ||
            element.tagName.toLowerCase() === 'textarea';

        if (!shouldDebounce) {
            // For checkboxes, radio buttons, etc., record immediately
            recordInputStep(element);
            return;
        }

        // Clear existing timer for this element
        const elementKey = generateSelector(element);
        if (inputDebounceTimers.has(elementKey)) {
            clearTimeout(inputDebounceTimers.get(elementKey));
        }

        // Highlight element while typing
        highlightElement(element);
        updateOverlay(`Typing in: ${generateElementName(element, getElementType(element))}`);

        // Set new timer - only record after user stops typing
        const timer = setTimeout(async () => {
            await recordInputStep(element);
            inputDebounceTimers.delete(elementKey);
        }, INPUT_DEBOUNCE_DELAY);

        inputDebounceTimers.set(elementKey, timer);

    }, true);

    // Helper function to record input step
    async function recordInputStep(element) {
        highlightElement(element);

        const selector = generateSelector(element);
        const elementType = getElementType(element);
        const elementName = generateElementName(element, elementType);

        // Skip screenshot for input to keep it responsive
        const screenshot = null;

        const step = {
            action: 'fill',
            selector: selector,
            value: element.value,
            elementName: elementName,
            elementType: elementType,
            url: window.location.href,
            timestamp: Date.now(),
            screenshot: screenshot
        };

        updateOverlay(`Filled: ${elementName} = "${element.value}"`);

        // Send to background/popup
        chrome.runtime.sendMessage({
            type: 'RECORDED_STEP',
            step: step,
            pageName: currentPageName,
            testName: currentTestName,
            testCase: currentTestCase
        });
    }

    // Record select changes
    document.addEventListener('change', async (e) => {
        if (!isRecording) return;

        const element = e.target;
        if (element.tagName.toLowerCase() !== 'select') return;

        highlightElement(element);

        const selector = generateSelector(element);
        const elementType = 'select';
        const elementName = generateElementName(element, elementType);

        const screenshot = await captureScreenshot();

        const step = {
            action: 'select',
            selector: selector,
            value: element.value,
            elementName: elementName,
            elementType: elementType,
            url: window.location.href,
            timestamp: Date.now(),
            screenshot: screenshot
        };

        updateOverlay(`Selected: ${elementName}`);

        // Send to background/popup
        chrome.runtime.sendMessage({
            type: 'RECORDED_STEP',
            step: step,
            pageName: currentPageName,
            testName: currentTestName,
            testCase: currentTestCase
        });

    }, true);

    // Generate robust selector
    function generateSelector(element) {
        // Match SelectorEngine priority order for consistency

        // Priority 1: data-testid or similar test attributes (Highest Priority)
        const testAttributes = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'data-automation-id'];
        for (const attr of testAttributes) {
            const value = element.getAttribute(attr);
            if (value) {
                return `[${attr}="${value}"]`;
            }
        }

        // Priority 2: ARIA Role + Name (for better semantic selectors)
        const role = element.getAttribute('role');
        const ariaLabel = element.getAttribute('aria-label');
        const textContent = element.textContent?.trim();

        // For buttons, use role-based selector if available
        if (role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(role)) {
            const name = ariaLabel || textContent;
            if (name && name.length < 50) { // Avoid very long text
                return `role=${role}[name="${name}"]`;
            }
        } else if (element.tagName === 'BUTTON' || (element.tagName === 'INPUT' && element.type === 'submit')) {
            // Implicit button role
            const btnName = element.innerText || element.value || ariaLabel;
            if (btnName && btnName.length < 50) {
                return `role=button[name="${btnName}"]`;
            }
        }

        // Priority 3: ID (but avoid dynamic IDs)
        if (element.id) {
            // Skip IDs that look dynamic (contain long numbers or hashes)
            if (!/\d{3,}$/.test(element.id) && !/^[a-f0-9]{10,}$/i.test(element.id)) {
                return `#${element.id}`;
            }
        }

        // Priority 4: name attribute
        if (element.name) {
            return `[name="${element.name}"]`;
        }

        // Priority 5: Generate path-based selector (fallback)
        return generatePathSelector(element);
    }

    // Generate path-based selector
    function generatePathSelector(element) {
        const path = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();

            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            }

            // Add nth-of-type if needed
            const siblings = Array.from(current.parentNode?.children || [])
                .filter(el => el.tagName === current.tagName);

            if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += `:nth-of-type(${index})`;
            }

            path.unshift(selector);
            current = current.parentNode;

            // Limit path depth
            if (path.length >= 5) break;
        }

        return path.join(' > ');
    }

    // Get element type
    function getElementType(element) {
        const tag = element.tagName.toLowerCase();
        const type = element.getAttribute('type');
        const role = element.getAttribute('role');

        if (tag === 'button' || type === 'button' || type === 'submit' || role === 'button') {
            return 'button';
        }
        if (tag === 'input') {
            if (type === 'checkbox') return 'checkbox';
            if (type === 'radio') return 'radio';
            return 'input';
        }
        if (tag === 'select') return 'select';
        if (tag === 'textarea') return 'textarea';
        if (tag === 'a') return 'link';

        return 'element';
    }

    // Generate meaningful element name
    function generateElementName(element, type) {
        let name = '';

        // Try ID
        if (element.id) {
            name = sanitizeName(element.id);
            return `${name}${capitalize(type)}`;
        }

        // Try name attribute
        if (element.name) {
            name = sanitizeName(element.name);
            return `${name}${capitalize(type)}`;
        }

        // Try aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            name = sanitizeName(ariaLabel);
            return `${name}${capitalize(type)}`;
        }

        // Try placeholder
        if (element.placeholder) {
            name = sanitizeName(element.placeholder);
            return `${name}${capitalize(type)}`;
        }

        // Try text content
        if (element.textContent && element.textContent.trim().length < 30) {
            name = sanitizeName(element.textContent.trim());
            return `${name}${capitalize(type)}`;
        }

        // Fallback
        return `${type}Element`;
    }

    // Sanitize name for use as variable
    function sanitizeName(str) {
        return str
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .map((word, index) => {
                if (index === 0) return word.toLowerCase();
                return capitalize(word);
            })
            .join('');
    }

    // Capitalize first letter
    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Modal detection functions
    function detectActiveModal() {
        // Check for common modal patterns
        const modalSelectors = [
            '[role="dialog"][aria-modal="true"]',
            '[role="alertdialog"]',
            '.modal.show',  // Bootstrap
            '.modal.in',    // Bootstrap 3
            '.MuiDialog-root [role="dialog"]',  // Material UI
            '[data-modal="true"]',
            'dialog[open]'  // HTML5 dialog
        ];

        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && isModalVisible(modal)) {
                return modal;
            }
        }

        // Check for generic modals with high z-index
        const allElements = document.querySelectorAll('[role="dialog"], .modal, .dialog');
        for (const el of allElements) {
            if (isModalVisible(el)) {
                const zIndex = parseInt(window.getComputedStyle(el).zIndex);
                if (zIndex > 1000) {
                    return el;
                }
            }
        }

        return null;
    }

    function isModalVisible(element) {
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            element.offsetWidth > 0 &&
            element.offsetHeight > 0;
    }

    function getModalName(modal) {
        // Try to get modal title or heading
        const title = modal.querySelector('h1, h2, h3, h4, [role="heading"], .modal-title, .dialog-title');
        if (title && title.textContent.trim()) {
            return sanitizeName(title.textContent.trim()) + 'Modal';
        }

        // Try aria-label
        const ariaLabel = modal.getAttribute('aria-label') || modal.getAttribute('aria-labelledby');
        if (ariaLabel) {
            const labelEl = document.getElementById(ariaLabel);
            if (labelEl) {
                return sanitizeName(labelEl.textContent.trim()) + 'Modal';
            }
            return sanitizeName(ariaLabel) + 'Modal';
        }

        // Fallback
        return 'Modal';
    }

    function showModalDetectionBadge(modalName) {
        // Remove existing badge if any
        const existing = document.getElementById('modal-scan-indicator');
        if (existing) existing.remove();

        const badge = document.createElement('div');
        badge.id = 'modal-scan-indicator';
        badge.textContent = `🎯 Scanning ${modalName} Only`;
        badge.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 999999;
            font-family: sans-serif;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(badge);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            badge.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => badge.remove(), 300);
        }, 4000);
    }

    // SelectorEngine class (inline for content script)
    class SelectorEngine {
        constructor() {
            this.priorityList = [
                { type: 'data-testid', score: 100 },
                { type: 'role', score: 80 },
                { type: 'id', score: 60 },
                { type: 'name', score: 50 },
                { type: 'text', score: 40 },
                { type: 'class', score: 20 },
                { type: 'css', score: 10 },
                { type: 'xpath', score: 5 }
            ];
        }

        calculateScore(type) {
            const priority = this.priorityList.find(p => p.type === type);
            return priority ? priority.score : 0;
        }

        getPossibleSelectors(element) {
            const selectors = [];

            // 1. Data Test ID
            const testAttributes = [
                'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-automation-id',
                'data-component', 'data-widget'
            ];
            for (const attr of testAttributes) {
                if (element.hasAttribute(attr)) {
                    const value = element.getAttribute(attr);
                    const selector = `[${attr}="${CSS.escape(value)}"]`;
                    if (this.isUnique(selector)) {
                        selectors.push({
                            type: 'data-testid',
                            value: selector,
                            score: this.calculateScore('data-testid'),
                            originalAttribute: attr
                        });
                    }
                }
            }

            // 2. ARIA Role + Name
            const role = element.getAttribute('role');
            const ariaLabel = element.getAttribute('aria-label');
            const textContent = element.textContent?.trim();
            const name = ariaLabel || textContent;

            if (role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(role)) {
                selectors.push({
                    type: 'role',
                    value: `role=${role}[name="${name}"]`,
                    score: this.calculateScore('role'),
                    details: { role, name }
                });
            } else if (element.tagName === 'BUTTON' || (element.tagName === 'INPUT' && element.type === 'submit')) {
                const btnName = element.innerText || element.value || element.getAttribute('aria-label');
                if (btnName) {
                    selectors.push({
                        type: 'role',
                        value: `role=button[name="${btnName}"]`,
                        score: this.calculateScore('role'),
                        details: { role: 'button', name: btnName }
                    });
                }
            }

            // 3. Unique ID
            if (element.id) {
                const selector = `#${CSS.escape(element.id)}`;
                if (this.isUnique(selector)) {
                    if (!/\d{3,}$/.test(element.id) && !/^[a-f0-9]{10,}$/i.test(element.id)) {
                        selectors.push({
                            type: 'id',
                            value: selector,
                            score: this.calculateScore('id')
                        });
                    }
                }
            }

            // 4. Name Attribute
            if (element.name) {
                const selector = `[name="${CSS.escape(element.name)}"]`;
                if (this.isUnique(selector)) {
                    selectors.push({
                        type: 'name',
                        value: selector,
                        score: this.calculateScore('name')
                    });
                }
            }

            // 5. Unique Text
            if (['BUTTON', 'A', 'LABEL', 'SPAN', 'DIV'].includes(element.tagName)) {
                const text = element.textContent?.trim();
                if (text && text.length > 0 && text.length < 50) {
                    selectors.push({
                        type: 'text',
                        value: `text=${text}`,
                        score: this.calculateScore('text'),
                        details: { text }
                    });
                }
            }

            // 6. Class Combinations
            if (element.className && typeof element.className === 'string') {
                const classes = element.className.split(/\s+/).filter(c => c.trim().length > 0);
                const validClasses = classes.filter(c => !['active', 'focus', 'hover', 'selected', 'disabled', 'ng-touched', 'ng-dirty', 'ng-valid', 'ng-invalid'].includes(c));

                if (validClasses.length > 0) {
                    for (const cls of validClasses) {
                        const selector = `.${CSS.escape(cls)}`;
                        if (this.isUnique(selector)) {
                            selectors.push({
                                type: 'class',
                                value: selector,
                                score: this.calculateScore('class')
                            });
                        }
                    }
                    if (validClasses.length > 1) {
                        const selector = '.' + validClasses.map(c => CSS.escape(c)).join('.');
                        if (this.isUnique(selector)) {
                            selectors.push({
                                type: 'class',
                                value: selector,
                                score: this.calculateScore('class')
                            });
                        }
                    }
                }
            }

            // 7. Structural CSS (Fallback)
            const cssPath = this.generatePathSelector(element);
            selectors.push({
                type: 'css',
                value: cssPath,
                score: this.calculateScore('css')
            });

            return selectors;
        }

        getBestSelector(element) {
            const candidates = this.getPossibleSelectors(element);
            candidates.sort((a, b) => b.score - a.score);
            return candidates[0];
        }

        isUnique(selector) {
            try {
                return document.querySelectorAll(selector).length === 1;
            } catch (e) {
                return false;
            }
        }

        generatePathSelector(element) {
            const path = [];
            let current = element;

            while (current && current.nodeType === Node.ELEMENT_NODE) {
                let selector = current.tagName.toLowerCase();

                if (current.id) {
                    selector += `#${CSS.escape(current.id)}`;
                    path.unshift(selector);
                    break;
                }

                let classSelector = '';
                if (current.className && typeof current.className === 'string') {
                    const classes = current.className.split(/\s+/).filter(c => c.trim().length > 0);
                    const validClasses = classes.filter(c => !['active', 'focus', 'hover', 'selected', 'disabled', 'ng-touched', 'ng-dirty', 'ng-valid', 'ng-invalid'].includes(c));
                    if (validClasses.length > 0) {
                        classSelector = '.' + validClasses.map(c => CSS.escape(c)).join('.');
                    }
                }

                const siblings = Array.from(current.parentNode?.children || []);
                const sameTagSiblings = siblings.filter(el => el.tagName === current.tagName);

                if (sameTagSiblings.length > 1) {
                    if (classSelector) {
                        const sameTagAndClassSiblings = sameTagSiblings.filter(el => {
                            return el.matches(current.tagName.toLowerCase() + classSelector);
                        });

                        if (sameTagAndClassSiblings.length === 1) {
                            selector += classSelector;
                        } else {
                            const index = sameTagSiblings.indexOf(current) + 1;
                            selector += `:nth-of-type(${index})`;
                        }
                    } else {
                        const index = sameTagSiblings.indexOf(current) + 1;
                        selector += `:nth-of-type(${index})`;
                    }
                } else if (classSelector) {
                    if (['div', 'span'].includes(current.tagName.toLowerCase())) {
                        selector += classSelector;
                    }
                }

                path.unshift(selector);
                current = current.parentNode;
                if (path.length >= 5) break;
            }
            return path.join(' > ');
        }
    }

    // ElementDetector class (inline for content script)
    class ElementDetector {
        constructor() {
            this.selectorEngine = new SelectorEngine();
            this.elementTypes = {
                button: ['button', '[type="button"]', '[type="submit"]', '[role="button"]'],
                input: [
                    'input[type="text"]',
                    'input[type="email"]',
                    'input[type="password"]',
                    'input[type="number"]',
                    'input[type="search"]',
                    'input[type="tel"]',
                    'input[type="url"]',
                    'input[type="date"]',
                    'input[type="time"]',
                    'input[type="datetime-local"]',
                    'input[type="month"]',
                    'input[type="week"]',
                    'input[type="color"]',
                    'input[type="file"]',
                    'input[type="range"]',
                    'input:not([type])' // Generic inputs without type
                ],
                checkbox: ['input[type="checkbox"]'],
                radio: ['input[type="radio"]'],
                select: ['select'],
                link: ['a[href]'],
                textarea: ['textarea']
            };
        }

        isElementVisible(element) {
            // Check if element is visible
            const style = window.getComputedStyle(element);
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                element.offsetWidth > 0 &&
                element.offsetHeight > 0;
        }

        detectElements() {
            const elements = [];
            const processedElements = new Set(); // Track processed elements to avoid duplicates
            const nameCounter = {}; // Track name usage for uniqueness
            const allSelectors = Object.values(this.elementTypes).flat();

            // Check if there's an active modal
            const activeModal = detectActiveModal();
            const scanRoot = activeModal || document.body;

            // Show visual feedback if scanning a modal
            if (activeModal) {
                const modalName = getModalName(activeModal);
                showModalDetectionBadge(modalName);
                console.log(`🎯 Modal detected: Scanning only elements within "${modalName}"`);
            }

            allSelectors.forEach(selector => {
                const found = scanRoot.querySelectorAll(selector);
                found.forEach((el) => {
                    // Skip if already processed
                    if (processedElements.has(el)) return;

                    // Skip if not visible
                    if (!this.isElementVisible(el)) return;

                    // If scanning a modal, ensure element is within the modal
                    if (activeModal && !activeModal.contains(el)) return;

                    const type = getElementType(el);
                    let name = generateElementName(el, type);

                    // Use SelectorEngine
                    const bestSelectorObj = this.selectorEngine.getBestSelector(el);
                    const sel = bestSelectorObj.value;

                    // Ensure unique names
                    if (nameCounter[name]) {
                        nameCounter[name]++;
                        name = `${name}${nameCounter[name]}`;
                    } else {
                        nameCounter[name] = 0;
                    }

                    elements.push({
                        name,
                        type,
                        selector: sel,
                        selectorObject: bestSelectorObj, // Store full object
                        text: el.textContent?.trim().substring(0, 50) || '',
                        placeholder: el.placeholder || ''
                    });

                    processedElements.add(el);
                });
            });

            return elements;
        }
    }
}
