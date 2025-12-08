// Core data models for the automation framework manager

class Project {
    constructor(name, tool, language, template = 'default') {
        this.id = this.generateId();
        this.name = name;
        this.tool = tool; // 'playwright', 'selenium', 'webdriverio'
        this.language = language; // 'javascript', 'typescript', 'python', 'java'
        this.template = template; // 'default', 'web-form', 'dashboard', 'e-commerce'
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.pages = {}; // Page Objects
        this.tests = {}; // Test suites/specs
        this.config = this.generateConfig();
        this.environments = {
            local: { url: 'http://localhost:3000', credentials: {} },
            staging: { url: '', credentials: {} },
            prod: { url: '', credentials: {} }
        };
        this.version = '1.0.0';
    }

    generateId() {
        return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateConfig() {
        const configs = {
            playwright: {
                javascript: 'playwright.config.js',
                typescript: 'playwright.config.ts',
                python: 'pytest.ini',
                java: 'pom.xml'
            },
            selenium: {
                javascript: 'wdio.conf.js',
                typescript: 'wdio.conf.ts',
                python: 'pytest.ini',
                java: 'pom.xml'
            },
            webdriverio: {
                javascript: 'wdio.conf.js',
                typescript: 'wdio.conf.ts'
            }
        };
        return configs[this.tool]?.[this.language] || 'config.js';
    }

    addPage(pageName, pageObject) {
        this.pages[pageName] = pageObject;
        this.updatedAt = Date.now();
    }

    addTest(testName, testSpec) {
        this.tests[testName] = testSpec;
        this.updatedAt = Date.now();
    }

    getStructure() {
        return {
            [`${this.name}/`]: {
                'tests/': Object.keys(this.tests),
                'pages/': Object.keys(this.pages),
                'utils/': ['helpers', 'config'],
                [this.config]: 'config file',
                'environments.json': 'environment configs'
            }
        };
    }
}

class PageObject {
    constructor(name, url, tool, language) {
        this.id = this.generateId();
        this.name = name;
        this.url = url;
        this.tool = tool;
        this.language = language;
        this.elements = {}; // { elementName: selector }
        this.methods = []; // Generated methods
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.version = 1;
        this.history = []; // Array of previous versions
    }

    generateId() {
        return `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addElement(elementName, selectorData, elementType = 'button') {
        // Handle both string selectors (legacy) and new selector objects
        let selectorObj = {};
        if (typeof selectorData === 'string') {
            selectorObj = {
                value: selectorData,
                type: 'legacy',
                score: 0
            };
        } else {
            selectorObj = selectorData;
        }

        this.elements[elementName] = {
            selector: selectorObj, // Store full object
            type: elementType,
            addedAt: Date.now()
        };
        this.updatedAt = Date.now();
    }

    addMethod(methodName, steps) {
        this.methods.push({
            name: methodName,
            steps,
            createdAt: Date.now()
        });
        this.updatedAt = Date.now();
    }

    createVersion() {
        this.history.push({
            version: this.version,
            elements: { ...this.elements },
            methods: [...this.methods],
            timestamp: Date.now()
        });
        this.version++;
    }

    generateCode() {
        // Will be implemented by CodeGenerator
        return null;
    }
}

class TestSpec {
    constructor(name, pageNames, tool, language) {
        this.id = this.generateId();
        this.name = name;

        // Handle legacy single pageName or new array
        if (typeof pageNames === 'string') {
            this.pageNames = [pageNames];
        } else {
            this.pageNames = pageNames || [];
        }

        this.tool = tool;
        this.language = language;
        this.testCases = [];
        this.createdAt = Date.now();
        this.updatedAt = Date.now();
        this.version = 1;
        this.history = [];
    }

    generateId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    addTestCase(testCaseName, steps, data = null) {
        if (this.testCases.some(tc => tc.name === testCaseName)) {
            throw new Error(`Test case "${testCaseName}" already exists in this suite.`);
        }
        this.testCases.push({
            name: testCaseName,
            steps,
            data, // For data-driven tests
            createdAt: Date.now()
        });
        this.updatedAt = Date.now();
    }

    createVersion() {
        this.history.push({
            version: this.version,
            testCases: [...this.testCases],
            timestamp: Date.now()
        });
        this.version++;
    }

    generateCode() {
        // Will be implemented by CodeGenerator
        return null;
    }
}

class RecordedStep {
    constructor(action, selector, value = null, pageObject = null) {
        this.id = this.generateId();
        this.action = action; // 'click', 'fill', 'select', 'navigate', etc.
        this.selector = selector;
        this.value = value;
        this.pageObject = pageObject;
        this.timestamp = Date.now();
        this.annotations = []; // e.g., '@smoke', '@critical'
        this.assertions = []; // e.g., { type: 'visible', selector: '...' }
        this.tags = []; // e.g., 'setup', 'cleanup'
    }

    generateId() {
        return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Project, PageObject, TestSpec, RecordedStep };
}
