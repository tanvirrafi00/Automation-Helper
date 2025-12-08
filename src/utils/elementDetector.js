// Smart element detector and naming utility

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

    // Calculate score for a selector type
    calculateScore(type) {
        const priority = this.priorityList.find(p => p.type === type);
        return priority ? priority.score : 0;
    }

    // Get all possible selectors for an element
    getPossibleSelectors(element) {
        const selectors = [];

        // 1. Data Test ID (Highest Priority)
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
        const name = ariaLabel || textContent; // Simplified name resolution

        // Only consider role if it's a standard interactive role
        if (role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(role)) {
            // Note: getByRole is framework specific, here we store metadata
            // We'll construct the actual selector string in the CodeGenerator
            selectors.push({
                type: 'role',
                value: `role=${role}[name="${name}"]`, // Internal representation
                score: this.calculateScore('role'),
                details: { role, name }
            });
        } else if (element.tagName === 'BUTTON' || (element.tagName === 'INPUT' && element.type === 'submit')) {
            // Implicit button role
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
                // Check for dynamic IDs (simple heuristic: contains numbers at the end or looks like a hash)
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

        // 5. Unique Text (for buttons/links)
        if (['BUTTON', 'A', 'LABEL', 'SPAN', 'DIV'].includes(element.tagName)) {
            const text = element.textContent?.trim();
            if (text && text.length > 0 && text.length < 50) {
                // Check uniqueness of text content is hard without XPath or complex CSS :has-text
                // We'll optimistically add it if it looks unique-ish (not a common word like "Submit" if there are multiple)
                // For now, let's rely on the fact that code generator will handle the exact syntax
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
                // Try single classes
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
                // Try combined
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

        // 8. XPath (Last Resort - not implemented fully yet, using CSS path as proxy or could generate simple XPath)
        // selectors.push({ type: 'xpath', value: '...', score: 5 });

        return selectors;
    }

    // Get the best selector for an element (SIMPLIFIED to match content.js)
    getBestSelector(element) {
        // Priority 1: data-testid or similar test attributes
        const testAttributes = ['data-testid', 'data-test', 'data-cy', 'data-qa', 'data-automation-id'];
        for (const attr of testAttributes) {
            const value = element.getAttribute(attr);
            if (value) {
                return {
                    type: 'data-testid',
                    value: `[${attr}="${value}"]`,
                    score: 100
                };
            }
        }

        // Priority 2: ARIA Role + Name
        const role = element.getAttribute('role');
        const ariaLabel = element.getAttribute('aria-label');
        const textContent = element.textContent?.trim();

        if (role && ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox'].includes(role)) {
            const name = ariaLabel || textContent;
            if (name && name.length < 50) {
                return {
                    type: 'role',
                    value: `role=${role}[name="${name}"]`,
                    score: 80
                };
            }
        } else if (element.tagName === 'BUTTON' || (element.tagName === 'INPUT' && element.type === 'submit')) {
            const btnName = element.innerText || element.value || ariaLabel;
            if (btnName && btnName.length < 50) {
                return {
                    type: 'role',
                    value: `role=button[name="${btnName}"]`,
                    score: 80
                };
            }
        }

        // Priority 3: ID (but avoid dynamic IDs)
        if (element.id) {
            if (!/\d{3,}$/.test(element.id) && !/^[a-f0-9]{10,}$/i.test(element.id)) {
                return {
                    type: 'id',
                    value: `#${element.id}`,
                    score: 60
                };
            }
        }

        // Priority 4: name attribute
        if (element.name) {
            return {
                type: 'name',
                value: `[name="${element.name}"]`,
                score: 50
            };
        }

        // Priority 5: Generate path-based selector (fallback)
        return {
            type: 'css',
            value: this.generatePathSelector(element),
            score: 10
        };
    }

    // Helper: Check if selector is unique
    isUnique(selector) {
        try {
            return document.querySelectorAll(selector).length === 1;
        } catch (e) {
            return false;
        }
    }

    // Generate path-based selector (matches content.js)
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

class ElementDetector {
    constructor() {
        this.selectorEngine = new SelectorEngine();
        this.elementTypes = {
            button: [
                'button',
                '[type="button"]',
                '[type="submit"]',
                '[role="button"]',
                'div[role="button"]',
                'span[role="button"]',
                'a[role="button"]'
            ],
            input: [
                'input[type="text"]',
                'input[type="email"]',
                'input[type="password"]',
                'input[type="number"]',
                'input[type="tel"]',
                'input[type="url"]',
                'input[type="search"]',
                'input[type="date"]',
                'input[type="time"]',
                'input[type="datetime-local"]'
            ],
            checkbox: ['input[type="checkbox"]', '[role="checkbox"]'],
            radio: ['input[type="radio"]', '[role="radio"]'],
            select: ['select', '[role="listbox"]', '[role="combobox"]'],
            link: ['a[href]', '[role="link"]'],
            textarea: ['textarea'],
            // Additional interactive elements
            tab: ['[role="tab"]'],
            menuitem: ['[role="menuitem"]'],
            option: ['[role="option"]'],
            switch: ['[role="switch"]']
        };
    }

    // Detect all interactive elements on the page
    detectElements() {
        const elements = [];
        const seen = new Set(); // Track unique elements to avoid duplicates
        const allSelectors = Object.values(this.elementTypes).flat();

        // First pass: detect elements matching our selectors
        allSelectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            found.forEach((el, index) => {
                if (!seen.has(el)) {
                    seen.add(el);
                    const elementInfo = this.analyzeElement(el, index);
                    if (elementInfo && this.isVisible(el)) {
                        elements.push(elementInfo);
                    }
                }
            });
        });

        // Second pass: detect clickable elements with onclick or cursor:pointer
        const clickableElements = document.querySelectorAll('[onclick], [ng-click], [v-on\\:click], [@click]');
        clickableElements.forEach((el, index) => {
            if (!seen.has(el) && this.isVisible(el)) {
                seen.add(el);
                const elementInfo = this.analyzeElement(el, index);
                if (elementInfo) {
                    elements.push(elementInfo);
                }
            }
        });

        // Third pass: detect elements with cursor:pointer style (common for clickable divs/spans)
        const allElements = document.querySelectorAll('div, span, li, td, th');
        allElements.forEach((el, index) => {
            if (!seen.has(el) && this.isVisible(el)) {
                const style = window.getComputedStyle(el);
                if (style.cursor === 'pointer' || el.hasAttribute('tabindex')) {
                    seen.add(el);
                    const elementInfo = this.analyzeElement(el, index);
                    if (elementInfo) {
                        elements.push(elementInfo);
                    }
                }
            }
        });

        return elements;
    }

    // Check if element is visible
    isVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
            return false;
        }

        return true;
    }

    // Analyze a single element
    analyzeElement(element, index) {
        const type = this.getElementType(element);
        const name = this.generateElementName(element, type, index);
        // Use SelectorEngine to get the best selector object
        const bestSelectorObj = this.selectorEngine.getBestSelector(element);

        // We keep the 'selector' string property for backward compatibility
        // but also store the full selector object
        const selector = bestSelectorObj.value;

        return {
            name,
            type,
            selector, // String representation
            selectorObject: bestSelectorObj, // Full object with score and type
            text: element.textContent?.trim().substring(0, 50) || '',
            placeholder: element.placeholder || '',
            id: element.id || '',
            classes: Array.from(element.classList),
            tagName: element.tagName.toLowerCase()
        };
    }

    // Determine element type
    getElementType(element) {
        const tag = element.tagName.toLowerCase();
        const type = element.getAttribute('type');
        const role = element.getAttribute('role');

        // Check role first for semantic elements
        if (role === 'tab') return 'tab';
        if (role === 'menuitem') return 'menuitem';
        if (role === 'option') return 'option';
        if (role === 'switch') return 'switch';
        if (role === 'checkbox') return 'checkbox';
        if (role === 'radio') return 'radio';
        if (role === 'listbox' || role === 'combobox') return 'select';
        if (role === 'link') return 'link';

        // Standard HTML elements
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

        // Clickable divs/spans
        if (element.hasAttribute('onclick') || element.hasAttribute('ng-click') ||
            element.hasAttribute('v-on:click') || element.hasAttribute('@click')) {
            return 'button'; // Treat as button
        }

        const style = window.getComputedStyle(element);
        if (style.cursor === 'pointer') {
            return 'button'; // Treat clickable elements as buttons
        }

        return 'element';
    }

    // Generate meaningful element name
    generateElementName(element, type, index) {
        // Try to get name from various attributes
        let name = '';

        // 1. Try ID
        if (element.id) {
            name = this.sanitizeName(element.id);
            return `${name}${this.capitalize(type)}`;
        }

        // 2. Try name attribute
        if (element.name) {
            name = this.sanitizeName(element.name);
            return `${name}${this.capitalize(type)}`;
        }

        // 3. Try aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            name = this.sanitizeName(ariaLabel);
            return `${name}${this.capitalize(type)}`;
        }

        // 4. Try placeholder
        if (element.placeholder) {
            name = this.sanitizeName(element.placeholder);
            return `${name}${this.capitalize(type)}`;
        }

        // 5. Try text content (for buttons/links)
        if (element.textContent && element.textContent.trim().length < 30) {
            name = this.sanitizeName(element.textContent.trim());
            return `${name}${this.capitalize(type)}`;
        }

        // 6. Try data attributes
        const dataAttrs = Array.from(element.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => attr.value);
        if (dataAttrs.length > 0) {
            name = this.sanitizeName(dataAttrs[0]);
            return `${name}${this.capitalize(type)}`;
        }

        // 7. Fallback to generic name with index
        return `${type}${index + 1}`;
    }

    // Deprecated: generateSelector is now handled by SelectorEngine
    // But kept as a wrapper if needed directly
    generateSelector(element) {
        return this.selectorEngine.getBestSelector(element).value;
    }

    // Sanitize name for use as variable
    sanitizeName(str) {
        return str
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim()
            .split(' ')
            .map((word, index) => {
                if (index === 0) return word.toLowerCase();
                return this.capitalize(word);
            })
            .join('');
    }

    // Capitalize first letter
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    // Group elements by page section
    groupElementsBySection() {
        const elements = this.detectElements();
        const sections = {};

        elements.forEach(el => {
            const section = this.findSection(el.selector);
            if (!sections[section]) {
                sections[section] = [];
            }
            sections[section].push(el);
        });

        return sections;
    }

    // Find which section an element belongs to
    findSection(selector) {
        try {
            const element = document.querySelector(selector);
            if (!element) return 'general';

            // Look for parent with semantic meaning
            let current = element;
            while (current) {
                const role = current.getAttribute('role');
                const id = current.id;
                const classes = Array.from(current.classList);

                // Check for common section identifiers
                if (role === 'navigation' || id === 'nav' || classes.some(c => c.includes('nav'))) {
                    return 'navigation';
                }
                if (role === 'main' || id === 'main' || classes.some(c => c.includes('main'))) {
                    return 'main';
                }
                if (role === 'form' || current.tagName === 'FORM') {
                    return current.name || current.id || 'form';
                }
                if (id === 'header' || classes.some(c => c.includes('header'))) {
                    return 'header';
                }
                if (id === 'footer' || classes.some(c => c.includes('footer'))) {
                    return 'footer';
                }

                current = current.parentElement;
            }

            return 'general';
        } catch (e) {
            return 'general';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ElementDetector;
}
