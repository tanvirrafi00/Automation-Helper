// Multi-tool, multi-language code generator

class CodeGenerator {
    constructor(tool, language) {
        this.tool = tool;
        this.language = language;
    }

    // Generate Page Object code
    generatePageObject(pageObject) {
        const generators = {
            playwright: {
                typescript: () => this.generatePlaywrightTS(pageObject),
                javascript: () => this.generatePlaywrightJS(pageObject),
                python: () => this.generatePlaywrightPython(pageObject),
                java: () => this.generatePlaywrightJava(pageObject)
            },
            selenium: {
                typescript: () => this.generateSeleniumTS(pageObject),
                javascript: () => this.generateSeleniumJS(pageObject),
                python: () => this.generateSeleniumPython(pageObject),
                java: () => this.generateSeleniumJava(pageObject)
            },
            webdriverio: {
                typescript: () => this.generateWebdriverIOTS(pageObject),
                javascript: () => this.generateWebdriverIOJS(pageObject)
            }
        };

        console.log(`Generating Page Object for tool: ${this.tool}, language: ${this.language}`);

        if (!this.tool || !this.language) {
            console.error('Tool or language not specified in CodeGenerator');
            return '// Error: Tool or language not specified';
        }

        const generator = generators[this.tool]?.[this.language];

        if (!generator) {
            console.error(`No generator found for ${this.tool} / ${this.language}`);
            return `// Error: No generator found for ${this.tool} / ${this.language}`;
        }

        try {
            return generator() || '';
        } catch (err) {
            console.error('Error generating page object code:', err);
            return `// Error generating code: ${err.message}`;
        }
    }

    // Generate Test Spec code
    generateTestSpec(testSpec, pageObjects) {
        const generators = {
            playwright: {
                typescript: () => this.generatePlaywrightTestTS(testSpec, pageObjects),
                javascript: () => this.generatePlaywrightTestJS(testSpec, pageObjects),
                python: () => this.generatePlaywrightTestPython(testSpec, pageObjects),
                java: () => this.generatePlaywrightTestJava(testSpec, pageObjects)
            },
            selenium: {
                typescript: () => this.generateSeleniumTestTS(testSpec, pageObjects),
                javascript: () => this.generateSeleniumTestJS(testSpec, pageObjects),
                python: () => this.generateSeleniumTestPython(testSpec, pageObjects),
                java: () => this.generateSeleniumTestJava(testSpec, pageObjects)
            },
            webdriverio: {
                typescript: () => this.generateWebdriverIOTestTS(testSpec, pageObjects),
                javascript: () => this.generateWebdriverIOTestJS(testSpec, pageObjects)
            }
        };

        console.log(`Generating Test Spec for tool: ${this.tool}, language: ${this.language}`);

        if (!this.tool || !this.language) {
            console.error('Tool or language not specified in CodeGenerator');
            return '// Error: Tool or language not specified';
        }

        const generator = generators[this.tool]?.[this.language];

        if (!generator) {
            console.error(`No generator found for ${this.tool} / ${this.language}`);
            return `// Error: No generator found for ${this.tool} / ${this.language}`;
        }

        try {
            return generator() || '';
        } catch (err) {
            console.error('Error generating test spec code:', err);
            return `// Error generating code: ${err.message}`;
        }
    }

    // Playwright TypeScript Page Object
    generatePlaywrightTS(pageObject) {
        let code = `import { Page } from '@playwright/test';\n\n`;
        code += `export class ${this.toPascalCase(pageObject.name)} {\n`;
        code += `  constructor(private page: Page) {}\n\n`;

        // Elements
        Object.entries(pageObject.elements).forEach(([name, data]) => {
            code += `  private ${this.toCamelCase(name)} = '${data.selector}';\n`;
        });
        code += `\n`;

        // Methods (Manually added or Auto-generated)
        if (pageObject.methods && pageObject.methods.length > 0) {
            pageObject.methods.forEach(method => {
                code += `  async ${method.name}(`;
                const params = this.extractParams(method.steps);
                code += params.join(', ');
                code += `) {\n`;
                method.steps.forEach(step => {
                    code += `    ${this.generateStepCode(step, 'playwright', 'typescript')};\n`;
                });
                code += `  }\n\n`;
            });
        } else {
            // Auto-generate methods from elements if no custom methods exist
            Object.entries(pageObject.elements).forEach(([name, data]) => {
                const pascalName = this.toPascalCase(name);
                if (data.type === 'button' || data.type === 'link') {
                    code += `  async click${pascalName}() {\n`;
                    code += `    await this.page.click(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'input' || data.type === 'textarea') {
                    code += `  async fill${pascalName}(value: string) {\n`;
                    code += `    await this.page.fill(this.${this.toCamelCase(name)}, value);\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'select') {
                    code += `  async select${pascalName}(value: string) {\n`;
                    code += `    await this.page.selectOption(this.${this.toCamelCase(name)}, value);\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'checkbox') {
                    code += `  async check${pascalName}() {\n`;
                    code += `    await this.page.check(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                    code += `  async uncheck${pascalName}() {\n`;
                    code += `    await this.page.uncheck(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'radio') {
                    code += `  async select${pascalName}() {\n`;
                    code += `    await this.page.check(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                }
            });
        }

        code += `}\n`;
        return code;
    }

    // Playwright JavaScript Page Object
    generatePlaywrightJS(pageObject) {
        let code = `class ${this.toPascalCase(pageObject.name)} {\n`;
        code += `  constructor(page) {\n`;
        code += `    this.page = page;\n`;

        Object.entries(pageObject.elements).forEach(([name, data]) => {
            code += `    this.${this.toCamelCase(name)} = '${data.selector}';\n`;
        });
        code += `  }\n\n`;

        // Methods
        if (pageObject.methods && pageObject.methods.length > 0) {
            pageObject.methods.forEach(method => {
                code += `  async ${method.name}(`;
                const params = this.extractParams(method.steps);
                code += params.join(', ');
                code += `) {\n`;
                method.steps.forEach(step => {
                    code += `    ${this.generateStepCode(step, 'playwright', 'javascript')};\n`;
                });
                code += `  }\n\n`;
            });
        } else {
            // Auto-generate methods from elements
            Object.entries(pageObject.elements).forEach(([name, data]) => {
                const pascalName = this.toPascalCase(name);
                if (data.type === 'button' || data.type === 'link') {
                    code += `  async click${pascalName}() {\n`;
                    code += `    await this.page.click(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'input' || data.type === 'textarea') {
                    code += `  async fill${pascalName}(value) {\n`;
                    code += `    await this.page.fill(this.${this.toCamelCase(name)}, value);\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'select') {
                    code += `  async select${pascalName}(value) {\n`;
                    code += `    await this.page.selectOption(this.${this.toCamelCase(name)}, value);\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'checkbox') {
                    code += `  async check${pascalName}() {\n`;
                    code += `    await this.page.check(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                    code += `  async uncheck${pascalName}() {\n`;
                    code += `    await this.page.uncheck(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                } else if (data.type === 'radio') {
                    code += `  async select${pascalName}() {\n`;
                    code += `    await this.page.check(this.${this.toCamelCase(name)});\n`;
                    code += `  }\n\n`;
                }
            });
        }

        code += `}\n\nmodule.exports = ${this.toPascalCase(pageObject.name)};\n`;
        return code;
    }

    // Selenium Java Page Object
    generateSeleniumJava(pageObject) {
        let code = `import org.openqa.selenium.By;\n`;
        code += `import org.openqa.selenium.WebDriver;\n`;
        code += `import org.openqa.selenium.WebElement;\n\n`;
        code += `public class ${this.toPascalCase(pageObject.name)} {\n`;
        code += `    private WebDriver driver;\n\n`;

        Object.entries(pageObject.elements).forEach(([name, data]) => {
            code += `    private By ${this.toCamelCase(name)} = By.cssSelector("${data.selector}");\n`;
        });
        code += `\n`;
        code += `    public ${this.toPascalCase(pageObject.name)}(WebDriver driver) {\n`;
        code += `        this.driver = driver;\n`;
        code += `    }\n\n`;

        pageObject.methods.forEach(method => {
            code += `    public void ${method.name}(`;
            const params = this.extractParams(method.steps);
            code += params.map(p => `String ${p}`).join(', ');
            code += `) {\n`;
            method.steps.forEach(step => {
                code += `        ${this.generateStepCode(step, 'selenium', 'java')};\n`;
            });
            code += `    }\n\n`;
        });

        code += `}\n`;
        return code;
    }

    // Playwright Python Page Object
    generatePlaywrightPython(pageObject) {
        let code = `from playwright.sync_api import Page\n\n`;
        code += `class ${this.toPascalCase(pageObject.name)}:\n`;
        code += `    def __init__(self, page: Page):\n`;
        code += `        self.page = page\n`;

        Object.entries(pageObject.elements).forEach(([name, data]) => {
            code += `        self.${this.toSnakeCase(name)} = "${data.selector}"\n`;
        });
        code += `\n`;

        pageObject.methods.forEach(method => {
            code += `    async def ${this.toSnakeCase(method.name)}(self`;
            const params = this.extractParams(method.steps);
            if (params.length > 0) {
                code += `, ${params.join(', ')}`;
            }
            code += `):\n`;
            method.steps.forEach(step => {
                code += `        ${this.generateStepCode(step, 'playwright', 'python')}\n`;
            });
            code += `\n`;
        });

        return code;
    }

    // Generate step code based on tool and language
    generateStepCode(step, tool, language, pageObjects = {}) {
        // Helper to find matching page object method
        const findPageMethod = (step) => {
            // 1. Check if step already has matched page info (from recorder)
            if (step.pageName && step.elementName) {
                const page = pageObjects[step.pageName];
                if (page) {
                    const pascalElName = this.toPascalCase(step.elementName);
                    let methodName = '';

                    if (step.action === 'click') methodName = `click${pascalElName}`;
                    else if (step.action === 'fill') methodName = `fill${pascalElName}`;
                    else if (step.action === 'select') methodName = `select${pascalElName}`;
                    else if (step.action === 'check') methodName = `check${pascalElName}`;
                    else if (step.action === 'uncheck') methodName = `uncheck${pascalElName}`;

                    // Check if custom method exists
                    const customMethod = page.methods.find(m => m.steps.some(s => s.selector === step.selector && s.action === step.action));
                    if (customMethod) {
                        return { pageName: step.pageName, methodName: customMethod.name, custom: true };
                    }

                    return { pageName: step.pageName, methodName, custom: false };
                }
            }

            // 2. Fallback: Search all page objects
            for (const [pageName, page] of Object.entries(pageObjects)) {
                // Check elements
                for (const [elName, elData] of Object.entries(page.elements)) {
                    if (elData.selector === step.selector) {
                        // Found element, now check for method
                        const pascalElName = this.toPascalCase(elName);
                        let methodName = '';

                        if (step.action === 'click') methodName = `click${pascalElName}`;
                        else if (step.action === 'fill') methodName = `fill${pascalElName}`;
                        else if (step.action === 'select') methodName = `select${pascalElName}`;
                        else if (step.action === 'check') methodName = `check${pascalElName}`;
                        else if (step.action === 'uncheck') methodName = `uncheck${pascalElName}`;

                        // Check if custom method exists (priority)
                        const customMethod = page.methods.find(m => m.steps.some(s => s.selector === step.selector && s.action === step.action));
                        if (customMethod) {
                            return { pageName, methodName: customMethod.name, custom: true };
                        }

                        return { pageName, methodName, custom: false };
                    }
                }
            }
            return null;
        };

        const stepGenerators = {
            playwright: {
                typescript: (s) => {
                    let code = '';
                    // Annotations
                    if (s.annotations && s.annotations.length > 0) {
                        code += `// ${s.annotations.join(', ')}\n    `;
                    }

                    const match = findPageMethod(s);
                    if (match) {
                        const pageVar = this.toCamelCase(match.pageName);
                        if (s.action === 'fill' || s.action === 'select') {
                            code += `await ${pageVar}.${match.methodName}('${s.value}')`;
                        } else {
                            code += `await ${pageVar}.${match.methodName}()`;
                        }
                        return code;
                    }

                    // Fallback to raw actions
                    if (s.action === 'click') code += `await this.page.click('${s.selector}')`;
                    else if (s.action === 'fill') code += `await this.page.fill('${s.selector}', '${s.value}')`;
                    else if (s.action === 'navigate') code += `await this.page.goto('${s.value}')`;
                    else if (s.action === 'select') code += `await this.page.selectOption('${s.selector}', '${s.value}')`;
                    else if (s.action === 'screenshot') code += `await this.page.screenshot({ path: '${s.value || 'screenshot.png'}' })`;
                    else code += `// ${s.action}`;

                    // Assertions
                    if (s.assertions && s.assertions.length > 0) {
                        s.assertions.forEach(assertion => {
                            code += `;\n    await expect(this.page.locator('${s.selector}')).${assertion.type}()`;
                        });
                    }
                    return code;
                },
                javascript: (s) => {
                    let code = '';
                    // Annotations
                    if (s.annotations && s.annotations.length > 0) {
                        code += `// ${s.annotations.join(', ')}\n    `;
                    }

                    const match = findPageMethod(s);
                    if (match) {
                        const pageVar = this.toCamelCase(match.pageName);
                        if (s.action === 'fill' || s.action === 'select') {
                            code += `await ${pageVar}.${match.methodName}('${s.value}')`;
                        } else {
                            code += `await ${pageVar}.${match.methodName}()`;
                        }
                        return code;
                    }

                    if (s.action === 'click') code += `await this.page.click('${s.selector}')`;
                    else if (s.action === 'fill') code += `await this.page.fill('${s.selector}', '${s.value}')`;
                    else if (s.action === 'navigate') code += `await this.page.goto('${s.value}')`;
                    else if (s.action === 'select') code += `await this.page.selectOption('${s.selector}', '${s.value}')`;
                    else if (s.action === 'screenshot') code += `await this.page.screenshot({ path: '${s.value || 'screenshot.png'}' })`;
                    else code += `// ${s.action}`;

                    // Assertions
                    if (s.assertions && s.assertions.length > 0) {
                        s.assertions.forEach(assertion => {
                            code += `;\n    await expect(this.page.locator('${s.selector}')).${assertion.type}()`;
                        });
                    }
                    return code;
                },
                python: (s) => {
                    const match = findPageMethod(s);
                    if (match) {
                        const pageVar = this.toSnakeCase(match.pageName);
                        const methodVar = this.toSnakeCase(match.methodName);
                        if (s.action === 'fill' || s.action === 'select') {
                            return `await ${pageVar}.${methodVar}("${s.value}")`;
                        }
                        return `await ${pageVar}.${methodVar}()`;
                    }

                    if (s.action === 'click') return `await self.page.click("${s.selector}")`;
                    if (s.action === 'fill') return `await self.page.fill("${s.selector}", "${s.value}")`;
                    if (s.action === 'navigate') return `await self.page.goto("${s.value}")`;
                    if (s.action === 'select') return `await self.page.select_option("${s.selector}", "${s.value}")`;
                    if (s.action === 'screenshot') return `await self.page.screenshot(path="${s.value || 'screenshot.png'}")`;
                    return `# ${s.action}`;
                },
                java: (s) => {
                    // Java implementation for Page Object method calls would go here
                    // Keeping simple for now as per previous pattern
                    if (s.action === 'click') return `page.click("${s.selector}")`;
                    if (s.action === 'fill') return `page.fill("${s.selector}", "${s.value}")`;
                    if (s.action === 'navigate') return `page.navigate("${s.value}")`;
                    if (s.action === 'select') return `page.selectOption("${s.selector}", "${s.value}")`;
                    if (s.action === 'screenshot') return `// Screenshot not implemented`;
                    return `// ${s.action}`;
                }
            },
            selenium: {
                java: (s) => {
                    if (s.action === 'click') return `driver.findElement(By.cssSelector("${s.selector}")).click()`;
                    if (s.action === 'fill') return `driver.findElement(By.cssSelector("${s.selector}")).sendKeys(${s.value})`;
                    if (s.action === 'navigate') return `driver.get("${s.value}")`;
                    return `// ${s.action}`;
                },
                python: (s) => {
                    if (s.action === 'click') return `self.driver.find_element(By.CSS_SELECTOR, "${s.selector}").click()`;
                    if (s.action === 'fill') return `self.driver.find_element(By.CSS_SELECTOR, "${s.selector}").send_keys(${s.value})`;
                    if (s.action === 'navigate') return `self.driver.get("${s.value}")`;
                    return `# ${s.action}`;
                }
            }
        };

        return stepGenerators[tool]?.[language]?.(step) || `// ${step.action}`;
    }

    // Generate Playwright Test TypeScript
    generatePlaywrightTestTS(testSpec, pageObjects) {
        let code = `import { test, expect } from '@playwright/test';\n`;

        // Import all page objects
        if (pageObjects && typeof pageObjects === 'object') {
            Object.values(pageObjects).forEach(page => {
                if (page && page.name) {
                    code += `import { ${this.toPascalCase(page.name)} } from '../pages/${this.toPascalCase(page.name)}';\n`;
                } else {
                    console.warn('Invalid page object in generatePlaywrightTestTS:', page);
                }
            });
        }
        code += `\n`;

        code += `test.describe('${testSpec.name}', () => {\n`;

        testSpec.testCases.forEach(testCase => {
            if (testCase.data && Array.isArray(testCase.data)) {
                // Data-driven test
                code += `  const testData = ${JSON.stringify(testCase.data, null, 2)};\n\n`;
                code += `  testData.forEach(data => {\n`;
                code += `    test('${testCase.name} with ' + JSON.stringify(data), async ({ page }) => {\n`;

                // Instantiate all page objects
                Object.values(pageObjects).forEach(page => {
                    code += `      const ${this.toCamelCase(page.name)} = new ${this.toPascalCase(page.name)}(page);\n`;
                });

                testCase.steps.forEach(step => {
                    // Replace variables with data
                    let stepCode = this.generateStepCode(step, 'playwright', 'typescript', pageObjects);
                    // Simple variable replacement logic
                    Object.keys(testCase.data[0]).forEach(key => {
                        stepCode = stepCode.replace(new RegExp(`\\$\{${key}\\}`, 'g'), `\${data.${key}}`);
                    });
                    code += `      ${stepCode};\n`;
                });
                code += `    });\n`;
                code += `  });\n\n`;
            } else {
                // Normal test
                code += `  test('${testCase.name}', async ({ page }) => {\n`;

                // Instantiate all page objects
                Object.values(pageObjects).forEach(page => {
                    code += `    const ${this.toCamelCase(page.name)} = new ${this.toPascalCase(page.name)}(page);\n`;
                });

                testCase.steps.forEach(step => {
                    code += `    ${this.generateStepCode(step, 'playwright', 'typescript', pageObjects)};\n`;
                });
                code += `  });\n\n`;
            }
        });

        code += `});\n`;
        return code;
    }

    // Generate Playwright Test JavaScript
    generatePlaywrightTestJS(testSpec, pageObjects) {
        let code = `const { test, expect } = require('@playwright/test');\n`;

        // Import all page objects
        if (pageObjects && typeof pageObjects === 'object') {
            Object.values(pageObjects).forEach(page => {
                if (page && page.name) {
                    code += `const ${this.toPascalCase(page.name)} = require('../pages/${this.toPascalCase(page.name)}');\n`;
                } else {
                    console.warn('Invalid page object in generatePlaywrightTestJS:', page);
                }
            });
        }
        code += `\n`;

        code += `test.describe('${testSpec.name}', () => {\n`;

        testSpec.testCases.forEach(testCase => {
            if (testCase.data && Array.isArray(testCase.data)) {
                // Data-driven test
                code += `  const testData = ${JSON.stringify(testCase.data, null, 2)};\n\n`;
                code += `  testData.forEach(data => {\n`;
                code += `    test('${testCase.name} with ' + JSON.stringify(data), async ({ page }) => {\n`;

                // Instantiate all page objects
                Object.values(pageObjects).forEach(page => {
                    code += `      const ${this.toCamelCase(page.name)} = new ${this.toPascalCase(page.name)}(page);\n`;
                });

                testCase.steps.forEach(step => {
                    // Replace variables with data
                    let stepCode = this.generateStepCode(step, 'playwright', 'javascript', pageObjects);
                    // Simple variable replacement logic
                    Object.keys(testCase.data[0]).forEach(key => {
                        stepCode = stepCode.replace(new RegExp(`\\$\{${key}\\}`, 'g'), `\${data.${key}}`);
                    });
                    code += `      ${stepCode};\n`;
                });
                code += `    });\n`;
                code += `  });\n\n`;
            } else {
                // Normal test
                code += `  test('${testCase.name}', async ({ page }) => {\n`;

                // Instantiate all page objects
                Object.values(pageObjects).forEach(page => {
                    code += `    const ${this.toCamelCase(page.name)} = new ${this.toPascalCase(page.name)}(page);\n`;
                });

                testCase.steps.forEach(step => {
                    code += `    ${this.generateStepCode(step, 'playwright', 'javascript', pageObjects)};\n`;
                });
                code += `  });\n\n`;
            }
        });

        code += `});\n`;
        return code;
    }

    // Helper methods
    toPascalCase(str) {
        if (!str || typeof str !== 'string') {
            console.warn('toPascalCase received invalid input:', str);
            return 'UnknownPage';
        }
        return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase())
            .replace(/\s+/g, '');
    }

    toCamelCase(str) {
        if (!str || typeof str !== 'string') {
            console.warn('toCamelCase received invalid input:', str);
            return 'unknownPage';
        }
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    toSnakeCase(str) {
        if (!str || typeof str !== 'string') {
            console.warn('toSnakeCase received invalid input:', str);
            return 'unknown_page';
        }
        return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    }

    extractParams(steps) {
        const params = new Set();
        steps.forEach(step => {
            if (step.value && step.value.startsWith('${')) {
                const param = step.value.match(/\$\{(\w+)\}/)?.[1];
                if (param) params.add(param);
            }
        });
        return Array.from(params);
    }

    // Stub methods for other generators (to be implemented)
    generatePlaywrightTestPython(testSpec, pageObject) { return '# Python test - to be implemented'; }
    generatePlaywrightTestJava(testSpec, pageObject) { return '// Java test - to be implemented'; }
    generateSeleniumTS(pageObject) { return '// Selenium TS - to be implemented'; }
    generateSeleniumJS(pageObject) { return '// Selenium JS - to be implemented'; }
    generateSeleniumPython(pageObject) { return '# Selenium Python - to be implemented'; }
    generateSeleniumTestTS(testSpec, pageObject) { return '// Selenium Test TS - to be implemented'; }
    generateSeleniumTestJS(testSpec, pageObject) { return '// Selenium Test JS - to be implemented'; }
    generateSeleniumTestPython(testSpec, pageObject) { return '# Selenium Test Python - to be implemented'; }
    generateSeleniumTestJava(testSpec, pageObject) { return '// Selenium Test Java - to be implemented'; }
    generateWebdriverIOTS(pageObject) { return '// WebdriverIO TS - to be implemented'; }
    generateWebdriverIOJS(pageObject) { return '// WebdriverIO JS - to be implemented'; }
    generateWebdriverIOTestTS(testSpec, pageObject) { return '// WebdriverIO Test TS - to be implemented'; }
    generateWebdriverIOTestJS(testSpec, pageObject) { return '// WebdriverIO Test JS - to be implemented'; }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodeGenerator;
}
