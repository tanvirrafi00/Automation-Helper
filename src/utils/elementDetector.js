// Smart element detector and naming utility

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

    // Detect all interactive elements on the page
    detectElements() {
        const elements = [];
        const allSelectors = Object.values(this.elementTypes).flat();

        allSelectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            found.forEach((el, index) => {
                const elementInfo = this.analyzeElement(el, index);
                if (elementInfo) {
                    elements.push(elementInfo);
                }
            });
        });

        return elements;
    }

    // Analyze a single element
    analyzeElement(element, index) {
        const type = this.getElementType(element);
        const name = this.generateElementName(element, type, index);
        const selector = this.generateSelector(element);

        return {
            name,
            type,
            selector,
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

    // Generate robust CSS selector
    generateSelector(element) {
        // Priority 1: ID
        if (element.id) {
            // Check if ID is unique and valid
            if (document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
                return `#${CSS.escape(element.id)}`;
            }
        }

        // Priority 2: Unique data attributes (common testing attributes)
        const testAttributes = [
            'data-testid', 'data-test', 'data-cy', 'data-qa', 'data-automation-id',
            'data-component', 'data-widget'
        ];

        for (const attr of testAttributes) {
            if (element.hasAttribute(attr)) {
                const value = element.getAttribute(attr);
                const selector = `[${attr}="${CSS.escape(value)}"]`;
                if (document.querySelectorAll(selector).length === 1) {
                    return selector;
                }
            }
        }

        // Priority 3: Name attribute (for form elements)
        if (element.name) {
            const selector = `[name="${CSS.escape(element.name)}"]`;
            if (document.querySelectorAll(selector).length === 1) {
                return selector;
            }
        }

        // Priority 4: Unique Class combinations
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(/\s+/).filter(c => c.trim().length > 0);
            if (classes.length > 0) {
                // Try single classes first
                for (const cls of classes) {
                    const selector = `.${CSS.escape(cls)}`;
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }
                // Try class combinations (up to 3)
                if (classes.length > 1) {
                    const selector = '.' + classes.map(c => CSS.escape(c)).join('.');
                    if (document.querySelectorAll(selector).length === 1) {
                        return selector;
                    }
                }
            }
        }

        // Priority 5: Tag + Text Content (for buttons/links with unique text)
        if (['BUTTON', 'A', 'LABEL', 'SPAN', 'DIV'].includes(element.tagName)) {
            const text = element.textContent.trim();
            if (text.length > 0 && text.length < 50) {
                // XPath for text matching is often more robust for buttons
                // But we need CSS selector for this tool usually.
                // We can try a pseudo-class if supported or just stick to path
                // For now, let's skip text-based CSS selectors as they are non-standard (:contains)
            }
        }

        // Priority 6: Generate path-based selector
        return this.generatePathSelector(element);
    }

    // Generate path-based selector
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

            // Try to use classes if they make it unique among siblings
            let classSelector = '';
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(/\s+/).filter(c => c.trim().length > 0);
                if (classes.length > 0) {
                    // Filter out common state classes
                    const validClasses = classes.filter(c => !['active', 'focus', 'hover', 'selected', 'disabled', 'ng-touched', 'ng-dirty', 'ng-valid', 'ng-invalid'].includes(c));
                    if (validClasses.length > 0) {
                        classSelector = '.' + validClasses.map(c => CSS.escape(c)).join('.');
                    }
                }
            }

            // Check uniqueness among siblings
            const siblings = Array.from(current.parentNode?.children || []);
            const sameTagSiblings = siblings.filter(el => el.tagName === current.tagName);

            if (sameTagSiblings.length > 1) {
                // If class makes it unique among siblings, use it
                if (classSelector) {
                    const sameTagAndClassSiblings = sameTagSiblings.filter(el => {
                        const elClasses = Array.from(el.classList);
                        return validClasses.every(c => elClasses.includes(c));
                    });

                    if (sameTagAndClassSiblings.length === 1) {
                        selector += classSelector;
                    } else {
                        // Still need nth-of-type
                        const index = sameTagSiblings.indexOf(current) + 1;
                        selector += `:nth-of-type(${index})`;
                    }
                } else {
                    const index = sameTagSiblings.indexOf(current) + 1;
                    selector += `:nth-of-type(${index})`;
                }
            } else if (classSelector) {
                // Unique tag, but add class for readability/robustness if desired
                // For now, keep it simple: if tag is unique, just use tag. 
                // Unless it's a generic div/span, then class helps.
                if (['div', 'span'].includes(current.tagName.toLowerCase())) {
                    selector += classSelector;
                }
            }

            path.unshift(selector);
            current = current.parentNode;

            // Limit path depth
            if (path.length >= 5) break;
        }

        return path.join(' > ');
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
