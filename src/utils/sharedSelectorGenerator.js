/**
 * Shared Selector Generator
 * Used by both content.js (recording) and elementDetector.js (scanning)
 * to ensure identical selectors for the same elements
 */

class SharedSelectorGenerator {
    constructor() {
        this.priorityList = [
            { type: 'data-testid', score: 100 },
            { type: 'role', score: 80 },
            { type: 'id', score: 60 },
            { type: 'name', score: 50 },
            { type: 'css', score: 10 }
        ];
    }

    /**
     * Generate the best selector for an element
     * @param {HTMLElement} element - The DOM element
     * @returns {string} - The generated selector
     */
    generateSelector(element) {
        // Priority 1: data-testid or similar test attributes (Highest Priority)
        const testAttributes = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'data-automation-id'];
        for (const attr of testAttributes) {
            const value = element.getAttribute(attr);
            if (value) {
                return `[${attr}="${value}"]`;
            }
        }

        // Priority 2: ARIA Role + Name (for better semantic selectors)
        const roleSelector = this.generateRoleSelector(element);
        if (roleSelector) {
            return roleSelector;
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
        return this.generatePathSelector(element);
    }

    /**
     * Generate role-based selector
     * @param {HTMLElement} element
     * @returns {string|null}
     */
    generateRoleSelector(element) {
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

        return null;
    }

    /**
     * Generate path-based selector
     * @param {HTMLElement} element
     * @returns {string}
     */
    generatePathSelector(element) {
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
}

// Export for use in both content.js and elementDetector.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedSelectorGenerator;
}
