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
            return `#${element.id}`;
        }

        // Priority 2: Unique data attribute
        const dataTestId = element.getAttribute('data-testid') ||
            element.getAttribute('data-test') ||
            element.getAttribute('data-cy');
        if (dataTestId) {
            return `[data-testid="${dataTestId}"]`;
        }

        // Priority 3: Name attribute (for form elements)
        if (element.name) {
            return `[name="${element.name}"]`;
        }

        // Priority 4: Generate path-based selector
        return this.generatePathSelector(element);
    }

    // Generate path-based selector
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
