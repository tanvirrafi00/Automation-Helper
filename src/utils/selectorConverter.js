/**
 * Selector Converter
 * Converts Playwright-specific selectors to vanilla CSS selectors for browser execution
 */

class SelectorConverter {
    /**
     * Convert Playwright selector to vanilla CSS selector
     * @param {string} selector - Playwright selector (may include role=, text=, etc.)
     * @returns {string} - Vanilla CSS selector
     */
    static toVanillaCSS(selector) {
        if (!selector) return selector;

        // Check if it's a Playwright role selector
        if (selector.startsWith('role=')) {
            return this.convertRoleSelector(selector);
        }

        // Check if it's a Playwright text selector
        if (selector.startsWith('text=')) {
            return this.convertTextSelector(selector);
        }

        // Already a vanilla CSS selector
        return selector;
    }

    /**
     * Convert role selector to CSS
     * Example: role=button[name="LOGIN"] → button[aria-label="LOGIN"], button:contains("LOGIN")
     * @param {string} roleSelector
     * @returns {string}
     */
    static convertRoleSelector(roleSelector) {
        // Parse: role=button[name="LOGIN"]
        const match = roleSelector.match(/role=(\w+)(?:\[name="([^"]+)"\])?/);

        if (!match) {
            console.warn(`Could not parse role selector: ${roleSelector}`);
            return roleSelector;
        }

        const [, role, name] = match;

        // Map ARIA roles to HTML elements
        const roleToElement = {
            'button': 'button, [role="button"], input[type="button"], input[type="submit"]',
            'link': 'a, [role="link"]',
            'textbox': 'input[type="text"], input:not([type]), textarea, [role="textbox"]',
            'checkbox': 'input[type="checkbox"], [role="checkbox"]',
            'radio': 'input[type="radio"], [role="radio"]',
            'combobox': 'select, [role="combobox"]',
            'listbox': 'select, [role="listbox"]',
            'option': 'option, [role="option"]',
            'tab': '[role="tab"]',
            'tabpanel': '[role="tabpanel"]',
            'dialog': '[role="dialog"], dialog',
            'alert': '[role="alert"]',
            'menu': '[role="menu"]',
            'menuitem': '[role="menuitem"]'
        };

        const baseSelector = roleToElement[role] || `[role="${role}"]`;

        if (!name) {
            return baseSelector;
        }

        // Try multiple strategies to find element by name
        // 1. aria-label
        // 2. Text content (we'll need to handle this in the execution layer)
        // 3. value attribute
        // 4. title attribute

        // For now, return a selector that checks aria-label, then we'll add text matching in execution
        return `${baseSelector}[aria-label="${name}"]`;
    }

    /**
     * Convert text selector to CSS
     * Example: text="Login" → *:contains("Login")
     * Note: :contains() is not standard CSS, so this needs special handling
     * @param {string} textSelector
     * @returns {string}
     */
    static convertTextSelector(textSelector) {
        const match = textSelector.match(/text="([^"]+)"/);

        if (!match) {
            console.warn(`Could not parse text selector: ${textSelector}`);
            return textSelector;
        }

        const text = match[1];

        // Return a data attribute we can use for matching
        // The actual matching will need to be done in JavaScript
        return `[data-text-content="${text}"]`;
    }

    /**
     * Find element using Playwright-style selector in vanilla JS
     * This handles role and text selectors properly
     * @param {string} selector - Playwright selector
     * @param {Document|Element} context - Search context (default: document)
     * @returns {Element|null}
     */
    static findElement(selector, context = document) {
        // Handle role selectors with name attribute
        if (selector.startsWith('role=')) {
            return this.findByRole(selector, context);
        }

        // Handle text selectors
        if (selector.startsWith('text=')) {
            return this.findByText(selector, context);
        }

        // Standard CSS selector
        return context.querySelector(selector);
    }

    /**
     * Find element by ARIA role and name
     * @param {string} roleSelector - e.g., role=button[name="LOGIN"]
     * @param {Document|Element} context
     * @returns {Element|null}
     */
    static findByRole(roleSelector, context = document) {
        const match = roleSelector.match(/role=(\w+)(?:\[name="([^"]+)"\])?/);

        if (!match) return null;

        const [, role, name] = match;

        // Map roles to element selectors
        const roleToSelector = {
            'button': 'button, [role="button"], input[type="button"], input[type="submit"]',
            'link': 'a, [role="link"]',
            'textbox': 'input[type="text"], input:not([type]), textarea, [role="textbox"]',
            'checkbox': 'input[type="checkbox"], [role="checkbox"]',
            'radio': 'input[type="radio"], [role="radio"]',
            'combobox': 'select, [role="combobox"]',
            'listbox': 'select, [role="listbox"]'
        };

        const baseSelector = roleToSelector[role] || `[role="${role}"]`;
        const elements = context.querySelectorAll(baseSelector);

        if (!name) {
            return elements[0] || null;
        }

        // Find element by name (check aria-label, text content, value, title)
        for (const el of elements) {
            if (el.getAttribute('aria-label') === name ||
                el.textContent?.trim() === name ||
                el.value === name ||
                el.title === name ||
                el.getAttribute('name') === name) {
                return el;
            }
        }

        return null;
    }

    /**
     * Find element by text content
     * @param {string} textSelector - e.g., text="Login"
     * @param {Document|Element} context
     * @returns {Element|null}
     */
    static findByText(textSelector, context = document) {
        const match = textSelector.match(/text="([^"]+)"/);

        if (!match) return null;

        const text = match[1];
        const elements = context.querySelectorAll('*');

        for (const el of elements) {
            if (el.textContent?.trim() === text) {
                return el;
            }
        }

        return null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectorConverter;
}
