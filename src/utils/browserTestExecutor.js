/**
 * Browser Test Executor
 * Executes tests in the browser context using Chrome extension APIs
 * Adapts TestRunner to work without Playwright
 */

class BrowserTestExecutor {
    constructor() {
        this.currentExecution = null;
        this.isExecuting = false;
    }

    /**
     * Execute a complete test case
     * @param {Object} testCase - Test case with steps
     * @param {Object} pageObjects - Page objects for the test
     * @param {number} tabId - Chrome tab ID to execute in
     * @returns {Promise<Object>} - Test results
     */
    async executeTestCase(testCase, pageObjects, tabId) {
        const startTime = Date.now();
        this.isExecuting = true;

        const result = {
            name: testCase.name,
            status: 'running',
            duration: 0,
            steps: [],
            error: null,
            screenshot: null
        };

        console.log(`🚀 Executing test case: ${testCase.name}`);

        try {
            for (let i = 0; i < testCase.steps.length; i++) {
                const step = testCase.steps[i];

                if (!this.isExecuting) {
                    result.status = 'cancelled';
                    break;
                }

                const stepResult = await this.executeStep(step, tabId, i + 1);
                result.steps.push(stepResult);

                if (stepResult.status === 'failed') {
                    result.status = 'failed';
                    result.error = stepResult.error;
                    result.screenshot = stepResult.screenshot;
                    console.error(`❌ Test failed at step ${i + 1}: ${stepResult.error}`);
                    break;
                }
            }

            // Mark remaining steps as skipped if test failed
            if (result.status === 'failed') {
                for (let i = result.steps.length; i < testCase.steps.length; i++) {
                    const step = testCase.steps[i];
                    result.steps.push({
                        index: i + 1,
                        action: step.action,
                        element: step.elementName || step.selector,
                        status: 'skipped',
                        duration: 0
                    });
                }
            }

            if (result.status === 'running') {
                result.status = 'passed';
                console.log(`✅ Test passed: ${testCase.name}`);
            }

        } catch (error) {
            result.status = 'failed';
            result.error = error.message;
            result.screenshot = await this.captureScreenshot(tabId);
            console.error(`❌ Test execution error: ${error.message}`);
        }

        result.duration = Date.now() - startTime;
        this.isExecuting = false;

        return result;
    }

    /**
     * Execute a single test step
     * @param {Object} step - Step to execute
     * @param {number} tabId - Chrome tab ID
     * @param {number} index - Step index
     * @returns {Promise<Object>} - Step result
     */
    async executeStep(step, tabId, index) {
        const startTime = Date.now();

        const stepResult = {
            index: index,
            action: step.action,
            element: step.elementName || step.selector,
            value: step.value || null,
            status: 'running',
            error: null,
            duration: 0,
            screenshot: null
        };

        console.log(`  ▶️ Step ${index}: ${step.action} ${stepResult.element}`);

        try {
            // Execute the step in the content script
            const response = await this.sendToContentScript(tabId, {
                type: 'EXECUTE_STEP',
                step: step
            });

            if (response && response.success) {
                stepResult.status = 'passed';
                console.log(`  ✅ Step ${index} passed`);
            } else {
                throw new Error(response?.error || 'Step execution failed');
            }

        } catch (error) {
            stepResult.status = 'failed';
            stepResult.error = error.message;
            stepResult.screenshot = await this.captureScreenshot(tabId);
            console.error(`  ❌ Step ${index} failed: ${error.message}`);
        }

        stepResult.duration = Date.now() - startTime;
        return stepResult;
    }

    /**
     * Send message to content script and wait for response
     * @param {number} tabId - Chrome tab ID
     * @param {Object} message - Message to send
     * @returns {Promise<Object>} - Response from content script
     */
    async sendToContentScript(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Capture screenshot of the tab
     * @param {number} tabId - Chrome tab ID
     * @returns {Promise<string>} - Base64 screenshot data URL
     */
    async captureScreenshot(tabId) {
        return new Promise((resolve) => {
            try {
                chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        console.error('Screenshot capture failed:', chrome.runtime.lastError);
                        resolve(null);
                    } else {
                        resolve(dataUrl);
                    }
                });
            } catch (error) {
                console.error('Screenshot capture error:', error);
                resolve(null);
            }
        });
    }

    /**
     * Wait for element to be present
     * @param {number} tabId - Chrome tab ID
     * @param {string} selector - Element selector
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<boolean>}
     */
    async waitForElement(tabId, selector, timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const response = await this.sendToContentScript(tabId, {
                type: 'CHECK_ELEMENT_EXISTS',
                selector: selector
            });

            if (response && response.exists) {
                return true;
            }

            await this.sleep(100);
        }

        throw new Error(`Element not found: ${selector} (timeout: ${timeout}ms)`);
    }

    /**
     * Sleep for specified duration
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Cancel current execution
     */
    cancel() {
        this.isExecuting = false;
        console.log('⏹️ Test execution cancelled');
    }

    /**
     * Get current execution status
     * @returns {boolean}
     */
    isRunning() {
        return this.isExecuting;
    }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserTestExecutor;
}
