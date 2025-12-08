/**
 * Test Runner
 * Executes test cases step-by-step and captures results
 */

class TestRunner {
    constructor() {
        this.currentExecution = null;
        this.results = null;
    }

    /**
     * Run an entire test suite
     * @param {Object} testSpec - Test specification with test cases
     * @param {Object} pageObjects - Page objects for the test
     * @param {Object} page - Browser page/tab to run tests in
     * @returns {Promise<Object>} - Test results
     */
    async runTestSuite(testSpec, pageObjects, page) {
        const startTime = Date.now();

        this.results = {
            suiteName: testSpec.name,
            status: 'running',
            totalTests: testSpec.testCases.length,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0,
            timestamp: new Date().toISOString(),
            testCases: []
        };

        console.log(`🚀 Starting test suite: ${testSpec.name}`);

        for (const testCase of testSpec.testCases) {
            try {
                const result = await this.runTestCase(testCase, pageObjects, page, testSpec);
                this.results.testCases.push(result);

                if (result.status === 'passed') {
                    this.results.passed++;
                } else if (result.status === 'failed') {
                    this.results.failed++;
                } else {
                    this.results.skipped++;
                }
            } catch (error) {
                console.error(`Error running test case ${testCase.name}:`, error);
                this.results.testCases.push({
                    name: testCase.name,
                    status: 'failed',
                    error: error.message,
                    steps: []
                });
                this.results.failed++;
            }
        }

        this.results.duration = Date.now() - startTime;
        this.results.status = this.results.failed > 0 ? 'failed' : 'passed';

        console.log(`✅ Test suite completed: ${this.results.passed}/${this.results.totalTests} passed`);

        return this.results;
    }

    /**
     * Run a single test case
     * @param {Object} testCase - Test case with steps
     * @param {Object} pageObjects - Page objects
     * @param {Object} page - Browser page
     * @param {Object} testSpec - Parent test spec
     * @returns {Promise<Object>} - Test case result
     */
    async runTestCase(testCase, pageObjects, page, testSpec) {
        const startTime = Date.now();

        const result = {
            name: testCase.name,
            status: 'running',
            duration: 0,
            steps: [],
            error: null,
            screenshot: null
        };

        console.log(`  📝 Running test case: ${testCase.name}`);

        for (let i = 0; i < testCase.steps.length; i++) {
            const step = testCase.steps[i];

            try {
                const stepResult = await this.executeStep(step, page, pageObjects, testSpec, i + 1);
                result.steps.push(stepResult);

                if (stepResult.status === 'failed') {
                    result.status = 'failed';
                    result.error = stepResult.error;
                    result.screenshot = stepResult.screenshot;
                    console.log(`    ❌ Step ${i + 1} failed: ${stepResult.error}`);
                    break; // Stop execution on first failure
                }
            } catch (error) {
                const stepResult = {
                    index: i + 1,
                    action: step.action,
                    element: step.elementName || step.selector,
                    status: 'failed',
                    error: error.message,
                    duration: 0,
                    screenshot: await this.captureScreenshot(page)
                };
                result.steps.push(stepResult);
                result.status = 'failed';
                result.error = error.message;
                result.screenshot = stepResult.screenshot;
                console.log(`    ❌ Step ${i + 1} failed: ${error.message}`);
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
        }

        result.duration = Date.now() - startTime;

        console.log(`  ${result.status === 'passed' ? '✅' : '❌'} Test case ${result.status}: ${testCase.name} (${result.duration}ms)`);

        return result;
    }

    /**
     * Execute a single test step
     * @param {Object} step - Step to execute
     * @param {Object} page - Browser page
     * @param {Object} pageObjects - Page objects
     * @param {Object} testSpec - Test specification
     * @param {number} index - Step index
     * @returns {Promise<Object>} - Step result
     */
    async executeStep(step, page, pageObjects, testSpec, index) {
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

        try {
            console.log(`    ▶️ Step ${index}: ${step.action} ${stepResult.element}`);

            // Find the page object and method
            let executed = false;

            if (step.pageName && step.elementName) {
                const pageObject = pageObjects[step.pageName];
                if (pageObject) {
                    // Try to execute using page object method
                    const methodName = this.getMethodName(step);
                    if (pageObject[methodName]) {
                        if (step.action === 'fill' || step.action === 'select') {
                            await pageObject[methodName](step.value);
                        } else {
                            await pageObject[methodName]();
                        }
                        executed = true;
                    }
                }
            }

            // Fallback to direct execution if no page object method
            if (!executed) {
                await this.executeDirectly(step, page);
            }

            stepResult.status = 'passed';
            stepResult.duration = Date.now() - startTime;
            console.log(`    ✅ Step ${index} passed (${stepResult.duration}ms)`);

        } catch (error) {
            stepResult.status = 'failed';
            stepResult.error = error.message;
            stepResult.duration = Date.now() - startTime;
            stepResult.screenshot = await this.captureScreenshot(page);
            console.error(`    ❌ Step ${index} failed:`, error.message);
        }

        return stepResult;
    }

    /**
     * Execute step directly using page methods
     * @param {Object} step - Step to execute
     * @param {Object} page - Browser page
     */
    async executeDirectly(step, page) {
        const selector = step.selector;

        switch (step.action) {
            case 'click':
                await page.click(selector);
                break;
            case 'fill':
                await page.fill(selector, step.value);
                break;
            case 'select':
                await page.selectOption(selector, step.value);
                break;
            case 'navigate':
                await page.goto(step.value);
                break;
            case 'assertion':
                // Handle assertions
                const element = await page.locator(selector);
                if (step.type === 'toBeVisible') {
                    await expect(element).toBeVisible();
                } else if (step.type === 'toBeEnabled') {
                    await expect(element).toBeEnabled();
                } else if (step.type === 'toHaveText') {
                    await expect(element).toHaveText(step.value);
                }
                break;
            default:
                throw new Error(`Unknown action: ${step.action}`);
        }
    }

    /**
     * Get method name from step
     * @param {Object} step
     * @returns {string}
     */
    getMethodName(step) {
        const elementName = step.elementName;
        const action = step.action;

        if (action === 'click') {
            return `click${this.capitalize(elementName)}`;
        } else if (action === 'fill') {
            return `fill${this.capitalize(elementName)}`;
        } else if (action === 'select') {
            return `select${this.capitalize(elementName)}`;
        }

        return elementName;
    }

    /**
     * Capitalize first letter
     * @param {string} str
     * @returns {string}
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Capture screenshot
     * @param {Object} page - Browser page
     * @returns {Promise<string>} - Base64 screenshot
     */
    async captureScreenshot(page) {
        try {
            const screenshot = await page.screenshot({ encoding: 'base64' });
            return `data:image/png;base64,${screenshot}`;
        } catch (error) {
            console.error('Failed to capture screenshot:', error);
            return null;
        }
    }

    /**
     * Get current results
     * @returns {Object}
     */
    getResults() {
        return this.results;
    }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestRunner;
}
