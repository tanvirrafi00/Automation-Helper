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
        `;

        const title = document.createElement('div');
        title.textContent = '🔴 Recording...';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        title.style.color = '#ef4444';

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
        if (message.type === 'DETECT_ELEMENTS') {
            const elements = detectElements();
            sendResponse({ elements });
        } else if (message.type === 'START_RECORDING') {
            isRecording = true;
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
            replaySteps(message.steps);
            sendResponse({ status: 'replaying' });
        } else if (message.type === 'CAPTURE_SCREENSHOT') {
            // Request background to capture tab
            chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, (response) => {
                sendResponse({ screenshotUrl: response.dataUrl });
            });
            return true; // Async response
        }
        return true;
    });

    // Replay recorded steps
    async function replaySteps(steps) {
        createOverlay();
        updateOverlay('Replaying steps...');

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            updateOverlay(`Executing: ${step.action} on ${step.elementName}`);

            // Notify popup
            chrome.runtime.sendMessage({
                type: 'REPLAY_PROGRESS',
                stepIndex: i,
                status: 'running'
            });

            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay for visibility

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
                        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (response) => {
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

        updateOverlay('Replay complete!');
        setTimeout(removeOverlay, 2000);
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

    // ElementDetector class (inline for content script)
    class ElementDetector {
        constructor() {
            this.elementTypes = {
                button: ['button', '[type="button"]', '[type="submit"]', '[role="button"]'],
                input: ['input[type="text"]', 'input[type="email"]', 'input[type="password"]', 'input[type="number"]'],
                checkbox: ['input[type="checkbox"]'],
                radio: ['input[type="radio"]'],
                select: ['select'],
                link: ['a[href]'],
                textarea: ['textarea']
            };
        }

        detectElements() {
            const elements = [];
            const allSelectors = Object.values(this.elementTypes).flat();

            allSelectors.forEach(selector => {
                const found = document.querySelectorAll(selector);
                found.forEach((el, index) => {
                    const type = getElementType(el);
                    const name = generateElementName(el, type);
                    const sel = generateSelector(el);

                    elements.push({
                        name,
                        type,
                        selector: sel,
                        text: el.textContent?.trim().substring(0, 50) || '',
                        placeholder: el.placeholder || ''
                    });
                });
            });

            return elements;
        }
    }
}
