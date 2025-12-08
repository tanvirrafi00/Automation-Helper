/**
 * Test Results Manager
 * Handles storage and retrieval of test execution results
 */

class TestResultsManager {
    constructor() {
        this.storageKey = 'testResults';
        this.maxHistory = 10; // Keep last 10 test runs
    }

    /**
     * Save test results
     * @param {Object} results - Test execution results
     * @returns {Promise<void>}
     */
    async saveResults(results) {
        try {
            // Get existing results
            const history = await this.getResultsHistory();

            // Add new results to the beginning
            history.unshift({
                id: this.generateId(),
                ...results
            });

            // Keep only last N results
            const trimmedHistory = history.slice(0, this.maxHistory);

            // Save to chrome.storage
            await chrome.storage.local.set({
                [this.storageKey]: trimmedHistory
            });

            console.log('✅ Test results saved');
        } catch (error) {
            console.error('Failed to save test results:', error);
        }
    }

    /**
     * Get results history
     * @returns {Promise<Array>}
     */
    async getResultsHistory() {
        try {
            const data = await chrome.storage.local.get(this.storageKey);
            return data[this.storageKey] || [];
        } catch (error) {
            console.error('Failed to get results history:', error);
            return [];
        }
    }

    /**
     * Get latest results
     * @returns {Promise<Object|null>}
     */
    async getLatestResults() {
        const history = await this.getResultsHistory();
        return history.length > 0 ? history[0] : null;
    }

    /**
     * Get results by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getResultsById(id) {
        const history = await this.getResultsHistory();
        return history.find(r => r.id === id) || null;
    }

    /**
     * Clear all results
     * @returns {Promise<void>}
     */
    async clearResults() {
        await chrome.storage.local.remove(this.storageKey);
        console.log('✅ Test results cleared');
    }

    /**
     * Generate unique ID
     * @returns {string}
     */
    generateId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Export results as JSON
     * @param {Object} results
     * @returns {string}
     */
    exportAsJSON(results) {
        return JSON.stringify(results, null, 2);
    }

    /**
     * Export results as HTML report
     * @param {Object} results
     * @returns {string}
     */
    exportAsHTML(results) {
        const passedCount = results.passed;
        const failedCount = results.failed;
        const totalCount = results.totalTests;
        const passRate = ((passedCount / totalCount) * 100).toFixed(1);

        let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Report - ${results.suiteName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { padding: 15px; border-radius: 6px; text-align: center; }
        .stat-card.passed { background: #e8f5e9; border-left: 4px solid #4CAF50; }
        .stat-card.failed { background: #ffebee; border-left: 4px solid #f44336; }
        .stat-card.total { background: #e3f2fd; border-left: 4px solid #2196F3; }
        .stat-card.duration { background: #fff3e0; border-left: 4px solid #ff9800; }
        .stat-value { font-size: 32px; font-weight: bold; margin: 5px 0; }
        .stat-label { color: #666; font-size: 14px; }
        .test-case { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 6px; }
        .test-case.passed { border-left: 4px solid #4CAF50; }
        .test-case.failed { border-left: 4px solid #f44336; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .test-name { font-size: 18px; font-weight: bold; }
        .test-status { padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .test-status.passed { background: #4CAF50; color: white; }
        .test-status.failed { background: #f44336; color: white; }
        .steps { margin-top: 10px; }
        .step { padding: 8px; margin: 5px 0; border-radius: 4px; display: flex; align-items: center; gap: 10px; }
        .step.passed { background: #f1f8f4; }
        .step.failed { background: #fef1f1; }
        .step.skipped { background: #f5f5f5; color: #999; }
        .step-icon { font-size: 16px; }
        .error-message { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 4px; }
        .screenshot { max-width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Test Report: ${results.suiteName}</h1>
        <p><strong>Executed:</strong> ${new Date(results.timestamp).toLocaleString()}</p>
        
        <div class="summary">
            <div class="stat-card total">
                <div class="stat-value">${totalCount}</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card passed">
                <div class="stat-value">${passedCount}</div>
                <div class="stat-label">Passed (${passRate}%)</div>
            </div>
            <div class="stat-card failed">
                <div class="stat-value">${failedCount}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card duration">
                <div class="stat-value">${(results.duration / 1000).toFixed(1)}s</div>
                <div class="stat-label">Duration</div>
            </div>
        </div>
        
        <h2>Test Cases</h2>
`;

        results.testCases.forEach(testCase => {
            html += `
        <div class="test-case ${testCase.status}">
            <div class="test-header">
                <div class="test-name">${testCase.name}</div>
                <div>
                    <span class="test-status ${testCase.status}">${testCase.status.toUpperCase()}</span>
                    <span style="margin-left: 10px; color: #666;">${testCase.duration}ms</span>
                </div>
            </div>
`;

            if (testCase.error) {
                html += `<div class="error-message"><strong>Error:</strong> ${testCase.error}</div>`;
            }

            if (testCase.steps && testCase.steps.length > 0) {
                html += `<div class="steps">`;
                testCase.steps.forEach(step => {
                    const icon = step.status === 'passed' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
                    html += `
                    <div class="step ${step.status}">
                        <span class="step-icon">${icon}</span>
                        <span>Step ${step.index}: ${step.action} ${step.element}${step.value ? ` = "${step.value}"` : ''}</span>
                        <span style="margin-left: auto; color: #666;">${step.duration}ms</span>
                    </div>
`;
                    if (step.error) {
                        html += `<div class="error-message" style="margin-left: 30px;"><strong>Error:</strong> ${step.error}</div>`;
                    }
                    if (step.screenshot) {
                        html += `<img src="${step.screenshot}" class="screenshot" alt="Failure screenshot" style="margin-left: 30px;">`;
                    }
                });
                html += `</div>`;
            }

            html += `</div>`;
        });

        html += `
    </div>
</body>
</html>
`;
        return html;
    }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestResultsManager;
}
