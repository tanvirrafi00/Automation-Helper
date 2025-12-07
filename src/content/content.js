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
        }
        return true;
    });

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

    // Record click events
    document.addEventListener('click', (e) => {
        if (!isRecording) return;

        const element = e.target;
        // Ignore clicks on our overlay
        if (overlay && overlay.contains(element)) return;

        highlightElement(element);

        const selector = generateSelector(element);
        const elementType = getElementType(element);
        const elementName = generateElementName(element, elementType);

        const step = {
            action: 'click',
            selector: selector,
            elementName: elementName,
            elementType: elementType,
            elementName: elementName,
            elementType: elementType,
            url: window.location.href,
            timestamp: Date.now()
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

    // Record input events
    document.addEventListener('input', (e) => {
        if (!isRecording) return;

        const element = e.target;

        highlightElement(element);

        const selector = generateSelector(element);
        const elementType = getElementType(element);
        const elementName = generateElementName(element, elementType);

        const step = {
            action: 'fill',
            selector: selector,
            value: element.value,
            elementName: elementName,
            elementType: elementType,
            elementName: elementName,
            elementType: elementType,
            url: window.location.href,
            timestamp: Date.now()
        };

        updateOverlay(`Filled: ${elementName}`);

        // Send to background/popup
        chrome.runtime.sendMessage({
            type: 'RECORDED_STEP',
            step: step,
            pageName: currentPageName,
            testName: currentTestName,
            testCase: currentTestCase
        });

    }, true);

    // Record select changes
    document.addEventListener('change', (e) => {
        if (!isRecording) return;

        const element = e.target;
        if (element.tagName.toLowerCase() !== 'select') return;

        highlightElement(element);

        const selector = generateSelector(element);
        const elementType = 'select';
        const elementName = generateElementName(element, elementType);

        const step = {
            action: 'select',
            selector: selector,
            value: element.value,
            elementName: elementName,
            elementType: elementType,
            elementName: elementName,
            elementType: elementType,
            url: window.location.href,
            timestamp: Date.now()
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
        // Priority 1: ID
        if (element.id) {
            return `#${element.id}`;
        }

        // Priority 2: data-testid or similar
        const testId = element.getAttribute('data-testid') ||
            element.getAttribute('data-test') ||
            element.getAttribute('data-cy');
        if (testId) {
            return `[data-testid="${testId}"]`;
        }

        // Priority 3: name attribute
        if (element.name) {
            return `[name="${element.name}"]`;
        }

        // Priority 4: Generate path-based selector
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

    // ElementDetector class (inline for content script)
    class ElementDetector {
        constructor() {
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
                    const sel = generateSelector(el);

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
