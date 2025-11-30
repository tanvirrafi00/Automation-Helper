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

        return generators[this.tool]?.[this.language]?.() || '';
    }

    // Generate Test Spec code
    generateTestSpec(testSpec, pageObject) {
        const generators = {
            playwright: {
                typescript: () => this.generatePlaywrightTestTS(testSpec, pageObject),
                javascript: () => this.generatePlaywrightTestJS(testSpec, pageObject),
                python: () => this.generatePlaywrightTestPython(testSpec, pageObject),
                java: () => this.generatePlaywrightTestJava(testSpec, pageObject)
            },
            selenium: {
                typescript: () => this.generateSeleniumTestTS(testSpec, pageObject),
                javascript: () => this.generateSeleniumTestJS(testSpec, pageObject),
                python: () => this.generateSeleniumTestPython(testSpec, pageObject),
                java: () => this.generateSeleniumTestJava(testSpec, pageObject)
            },
            webdriverio: {
                typescript: () => this.generateWebdriverIOTestTS(testSpec, pageObject),
                javascript: () => this.generateWebdriverIOTestJS(testSpec, pageObject)
            }
        };

        return generators[this.tool]?.[this.language]?.() || '';
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
    generateStepCode(step, tool, language) {
        const stepGenerators = {
            playwright: {
                typescript: (s) => {
                    let code = '';
                    // Annotations
                    if (s.annotations && s.annotations.length > 0) {
                        code += `// ${s.annotations.join(', ')}\n    `;
                    }

                    // Actions
                    if (s.action === 'click') code += `await this.page.click('${s.selector}')`;
                    else if (s.action === 'fill') code += `await this.page.fill('${s.selector}', ${s.value})`;
                    else if (s.action === 'navigate') code += `await this.page.goto('${s.value}')`;
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

                    if (s.action === 'click') code += `await this.page.click('${s.selector}')`;
                    else if (s.action === 'fill') code += `await this.page.fill('${s.selector}', ${s.value})`;
                    else if (s.action === 'navigate') code += `await this.page.goto('${s.value}')`;
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
                    if (s.action === 'click') return `await self.page.click("${s.selector}")`;
                    if (s.action === 'fill') return `await self.page.fill("${s.selector}", ${s.value})`;
                    if (s.action === 'navigate') return `await self.page.goto("${s.value}")`;
                    return `# ${s.action}`;
                },
                java: (s) => {
                    if (s.action === 'click') return `page.click("${s.selector}")`;
                    if (s.action === 'fill') return `page.fill("${s.selector}", ${s.value})`;
                    if (s.action === 'navigate') return `page.navigate("${s.value}")`;
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
    generatePlaywrightTestTS(testSpec, pageObject) {
        let code = `import { test, expect } from '@playwright/test';\n`;
        code += `import { ${this.toPascalCase(pageObject.name)} } from '../pages/${this.toPascalCase(pageObject.name)}';\n\n`;
        code += `test.describe('${testSpec.name}', () => {\n`;

        testSpec.testCases.forEach(testCase => {
            if (testCase.data && Array.isArray(testCase.data)) {
                // Data-driven test
                code += `  const testData = ${JSON.stringify(testCase.data, null, 2)};\n\n`;
                code += `  testData.forEach(data => {\n`;
                code += `    test('${testCase.name} with ' + JSON.stringify(data), async ({ page }) => {\n`;
                code += `      const ${this.toCamelCase(pageObject.name)} = new ${this.toPascalCase(pageObject.name)}(page);\n`;
                testCase.steps.forEach(step => {
                    // Replace variables with data
                    let stepCode = this.generateStepCode(step, 'playwright', 'typescript');
                    // Simple variable replacement logic (can be enhanced)
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
                code += `    const ${this.toCamelCase(pageObject.name)} = new ${this.toPascalCase(pageObject.name)}(page);\n`;
                testCase.steps.forEach(step => {
                    code += `    ${this.generateStepCode(step, 'playwright', 'typescript')};\n`;
                });
                code += `  });\n\n`;
            }
        });

        code += `});\n`;
        return code;
    }

    // Generate Playwright Test JavaScript
    generatePlaywrightTestJS(testSpec, pageObject) {
        let code = `const { test, expect } = require('@playwright/test');\n`;
        code += `const ${this.toPascalCase(pageObject.name)} = require('../pages/${this.toPascalCase(pageObject.name)}');\n\n`;
        code += `test.describe('${testSpec.name}', () => {\n`;

        testSpec.testCases.forEach(testCase => {
            if (testCase.data && Array.isArray(testCase.data)) {
                // Data-driven test
                code += `  const testData = ${JSON.stringify(testCase.data, null, 2)};\n\n`;
                code += `  testData.forEach(data => {\n`;
                code += `    test('${testCase.name} with ' + JSON.stringify(data), async ({ page }) => {\n`;
                code += `      const ${this.toCamelCase(pageObject.name)} = new ${this.toPascalCase(pageObject.name)}(page);\n`;
                testCase.steps.forEach(step => {
                    // Replace variables with data
                    let stepCode = this.generateStepCode(step, 'playwright', 'javascript');
                    // Simple variable replacement logic (can be enhanced)
                    Object.keys(testCase.data[0]).forEach(key => {
                        stepCode = stepCode.replace(new RegExp(`\\$\{${key}\\}`, 'g'), `\${data.${key}}`);
                    });
                    code += `      ${stepCode};\n`;
                });
                code += `    });\n`;
                code += `  });\n\n`;
            } else {
                code += `  test('${testCase.name}', async ({ page }) => {\n`;
                code += `    const ${this.toCamelCase(pageObject.name)} = new ${this.toPascalCase(pageObject.name)}(page);\n`;
                testCase.steps.forEach(step => {
                    code += `    ${this.generateStepCode(step, 'playwright', 'javascript')};\n`;
                });
                code += `  });\n\n`;
            }
        });

        code += `});\n`;
        return code;
    }

    // Helper methods
    toPascalCase(str) {
        return str.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase())
            .replace(/\s+/g, '');
    }

    toCamelCase(str) {
        const pascal = this.toPascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }

    toSnakeCase(str) {
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
