/**
 * Visual Step Execution Tracker
 * Provides real-time visual feedback during test execution
 */

class StepExecutionTracker {
    constructor() {
        this.currentStepIndex = -1;
        this.totalSteps = 0;
        this.statusBanner = null;
        this.progressBar = null;
    }

    /**
     * Initialize execution tracking for a test case
     * @param {Array} steps - Array of test steps
     * @param {HTMLElement} container - Container element for steps list
     */
    init(steps, container) {
        this.totalSteps = steps.length;
        this.currentStepIndex = -1;
        this.container = container;

        // Add status banner
        this.createStatusBanner();

        // Add progress bar
        this.createProgressBar();

        // Mark all steps as pending
        this.markAllStepsPending();
    }

    /**
     * Create status banner showing execution state
     */
    createStatusBanner() {
        // Remove existing banner if any
        const existing = document.querySelector('.execution-status-banner');
        if (existing) existing.remove();

        this.statusBanner = document.createElement('div');
        this.statusBanner.className = 'execution-status-banner running';
        this.statusBanner.innerHTML = `
            <span class="execution-status-icon">⚙️</span>
            <span>Preparing to execute ${this.totalSteps} steps...</span>
        `;

        // Insert before steps list
        if (this.container) {
            this.container.parentElement.insertBefore(this.statusBanner, this.container);
        }
    }

    /**
     * Create progress bar
     */
    createProgressBar() {
        // Remove existing progress bar if any
        const existing = document.querySelector('.execution-progress');
        if (existing) existing.remove();

        const progressContainer = document.createElement('div');
        progressContainer.className = 'execution-progress';
        progressContainer.innerHTML = '<div class="execution-progress-bar" style="width: 0%"></div>';

        this.progressBar = progressContainer.querySelector('.execution-progress-bar');

        // Insert after status banner
        if (this.statusBanner) {
            this.statusBanner.parentElement.insertBefore(progressContainer, this.statusBanner.nextSibling);
        }
    }

    /**
     * Mark all steps as pending
     */
    markAllStepsPending() {
        const stepItems = this.container.querySelectorAll('.step-item');
        stepItems.forEach(item => {
            item.classList.add('pending');
            item.classList.remove('executing', 'passed', 'failed');

            // Add pending badge
            const existingBadge = item.querySelector('.step-status-badge');
            if (existingBadge) existingBadge.remove();

            const badge = document.createElement('span');
            badge.className = 'step-status-badge pending';
            badge.textContent = 'PENDING';
            item.appendChild(badge);
        });
    }

    /**
     * Mark a step as currently executing
     * @param {number} stepIndex - Index of the step (0-based)
     */
    executeStep(stepIndex) {
        this.currentStepIndex = stepIndex;

        const stepItems = this.container.querySelectorAll('.step-item');
        const currentStep = stepItems[stepIndex];

        if (!currentStep) return;

        // Remove previous executing state
        stepItems.forEach(item => item.classList.remove('executing'));

        // Mark current step as executing
        currentStep.classList.remove('pending', 'passed', 'failed');
        currentStep.classList.add('executing');

        // Update badge
        const badge = currentStep.querySelector('.step-status-badge');
        if (badge) {
            badge.className = 'step-status-badge executing';
            badge.textContent = 'EXECUTING';
        }

        // Scroll into view
        currentStep.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Update status banner
        this.updateStatusBanner(`Executing step ${stepIndex + 1} of ${this.totalSteps}...`);

        // Update progress
        this.updateProgress();
    }

    /**
     * Mark a step as passed
     * @param {number} stepIndex
     */
    passStep(stepIndex) {
        const stepItems = this.container.querySelectorAll('.step-item');
        const step = stepItems[stepIndex];

        if (!step) return;

        step.classList.remove('executing', 'pending', 'failed');
        step.classList.add('passed');

        const badge = step.querySelector('.step-status-badge');
        if (badge) {
            badge.className = 'step-status-badge passed';
            badge.textContent = '✓ PASSED';
        }

        this.updateProgress();
    }

    /**
     * Mark a step as failed
     * @param {number} stepIndex
     * @param {string} error
     */
    failStep(stepIndex, error) {
        const stepItems = this.container.querySelectorAll('.step-item');
        const step = stepItems[stepIndex];

        if (!step) return;

        step.classList.remove('executing', 'pending', 'passed');
        step.classList.add('failed');

        const badge = step.querySelector('.step-status-badge');
        if (badge) {
            badge.className = 'step-status-badge failed';
            badge.textContent = '✗ FAILED';
        }

        // Add error message
        if (error) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'step-error-message';
            errorDiv.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 4px; padding-left: 20px;';
            errorDiv.textContent = `Error: ${error}`;
            step.appendChild(errorDiv);
        }

        this.updateProgress();
        this.updateStatusBanner(`Step ${stepIndex + 1} failed: ${error}`, 'failed');
    }

    /**
     * Update status banner
     * @param {string} message
     * @param {string} status - 'running', 'passed', 'failed'
     */
    updateStatusBanner(message, status = 'running') {
        if (!this.statusBanner) return;

        this.statusBanner.className = `execution-status-banner ${status}`;

        const icons = {
            running: '⚙️',
            passed: '✓',
            failed: '✗'
        };

        this.statusBanner.innerHTML = `
            <span class="execution-status-icon">${icons[status]}</span>
            <span>${message}</span>
        `;
    }

    /**
     * Update progress bar
     */
    updateProgress() {
        if (!this.progressBar) return;

        const progress = ((this.currentStepIndex + 1) / this.totalSteps) * 100;
        this.progressBar.style.width = `${progress}%`;
    }

    /**
     * Complete execution
     * @param {boolean} success
     */
    complete(success) {
        const status = success ? 'passed' : 'failed';
        const message = success
            ? `✓ All ${this.totalSteps} steps executed successfully!`
            : `✗ Execution failed`;

        this.updateStatusBanner(message, status);

        if (success) {
            this.progressBar.style.width = '100%';
        }
    }

    /**
     * Clean up
     */
    cleanup() {
        if (this.statusBanner) this.statusBanner.remove();
        const progressContainer = document.querySelector('.execution-progress');
        if (progressContainer) progressContainer.remove();

        // Remove all badges and states
        const stepItems = this.container.querySelectorAll('.step-item');
        stepItems.forEach(item => {
            item.classList.remove('executing', 'passed', 'failed', 'pending');
            const badge = item.querySelector('.step-status-badge');
            if (badge) badge.remove();
            const errorMsg = item.querySelector('.step-error-message');
            if (errorMsg) errorMsg.remove();
        });
    }
}

// Export for use in popup.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StepExecutionTracker;
}
