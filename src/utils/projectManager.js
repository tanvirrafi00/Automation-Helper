// Project manager for handling multiple automation projects

class ProjectManager {
    constructor() {
        this.storageKey = 'automation_projects';
        this.currentProjectKey = 'current_project_id';
    }

    // Get all projects
    async getAllProjects() {
        const result = await chrome.storage.local.get([this.storageKey]);
        return result[this.storageKey] || {};
    }

    // Get current project
    async getCurrentProject() {
        const result = await chrome.storage.local.get([this.currentProjectKey]);
        const projectId = result[this.currentProjectKey];

        if (!projectId) return null;

        const projects = await this.getAllProjects();
        return projects[projectId] || null;
    }

    // Set current project
    async setCurrentProject(projectId) {
        await chrome.storage.local.set({ [this.currentProjectKey]: projectId });
    }

    // Create new project
    async createProject(name, tool, language, template = 'default') {
        const projects = await this.getAllProjects();

        // Create project instance
        const project = new Project(name, tool, language, template);

        // Store project
        projects[project.id] = project;
        await chrome.storage.local.set({ [this.storageKey]: projects });

        // Set as current project
        await this.setCurrentProject(project.id);

        return project;
    }

    // Update project
    async updateProject(projectId, updates) {
        const projects = await this.getAllProjects();

        if (!projects[projectId]) {
            throw new Error('Project not found');
        }

        projects[projectId] = {
            ...projects[projectId],
            ...updates,
            updatedAt: Date.now()
        };

        await chrome.storage.local.set({ [this.storageKey]: projects });
        return projects[projectId];
    }

    // Delete project
    async deleteProject(projectId) {
        const projects = await this.getAllProjects();

        if (!projects[projectId]) {
            throw new Error('Project not found');
        }

        delete projects[projectId];
        await chrome.storage.local.set({ [this.storageKey]: projects });

        // Clear current project if it was deleted
        const currentId = await chrome.storage.local.get([this.currentProjectKey]);
        if (currentId[this.currentProjectKey] === projectId) {
            await chrome.storage.local.remove([this.currentProjectKey]);
        }
    }

    // Add page object to project
    async addPageObject(projectId, pageObject) {
        const projects = await this.getAllProjects();
        const project = projects[projectId];

        if (!project) {
            throw new Error('Project not found');
        }

        project.pages[pageObject.name] = pageObject;
        project.updatedAt = Date.now();

        await chrome.storage.local.set({ [this.storageKey]: projects });
        return pageObject;
    }

    // Update page object
    async updatePageObject(projectId, pageName, updates, createNewVersion = false) {
        const projects = await this.getAllProjects();
        const project = projects[projectId];

        if (!project || !project.pages[pageName]) {
            throw new Error('Page object not found');
        }

        const page = project.pages[pageName];

        if (createNewVersion) {
            // Create a version entry before updating
            if (!page.history) page.history = [];
            page.history.push({
                version: page.version || 1,
                elements: { ...page.elements },
                methods: [...(page.methods || [])],
                timestamp: Date.now()
            });
            page.version = (page.version || 1) + 1;
        }

        project.pages[pageName] = {
            ...page,
            ...updates,
            updatedAt: Date.now()
        };
        project.updatedAt = Date.now();

        await chrome.storage.local.set({ [this.storageKey]: projects });
        return project.pages[pageName];
    }

    // Add test spec to project
    async addTestSpec(projectId, testSpec) {
        const projects = await this.getAllProjects();
        const project = projects[projectId];

        if (!project) {
            throw new Error('Project not found');
        }

        project.tests[testSpec.name] = testSpec;
        project.updatedAt = Date.now();

        await chrome.storage.local.set({ [this.storageKey]: projects });
        return testSpec;
    }

    // Update test spec
    async updateTestSpec(projectId, testName, updates, createNewVersion = false) {
        const projects = await this.getAllProjects();
        const project = projects[projectId];

        if (!project || !project.tests[testName]) {
            throw new Error('Test spec not found');
        }

        const test = project.tests[testName];

        if (createNewVersion) {
            // Create a version entry before updating
            if (!test.history) test.history = [];
            test.history.push({
                version: test.version || 1,
                testCases: [...(test.testCases || [])],
                timestamp: Date.now()
            });
            test.version = (test.version || 1) + 1;
        }

        project.tests[testName] = {
            ...test,
            ...updates,
            updatedAt: Date.now()
        };
        project.updatedAt = Date.now();

        await chrome.storage.local.set({ [this.storageKey]: projects });
        return project.tests[testName];
    }

    // Export project as ZIP structure
    async exportProject(projectId) {
        const projects = await this.getAllProjects();
        const project = projects[projectId];

        if (!project) {
            throw new Error('Project not found');
        }

        const generator = new CodeGenerator(project.tool, project.language);
        const files = {};

        // Generate page objects
        Object.values(project.pages).forEach(page => {
            const ext = this.getFileExtension(project.language);
            const code = generator.generatePageObject(page);

            if (code && code.trim()) {
                files[`pages/${page.name}${ext}`] = code;
                console.log(`Generated page object: pages/${page.name}${ext}`);
            } else {
                console.warn(`Empty code for page object: ${page.name}`);
                // Add a placeholder comment so file isn't empty
                files[`pages/${page.name}${ext}`] = `// Page Object: ${page.name}\n// No elements defined yet\n`;
            }
        });

        // Generate test specs
        Object.values(project.tests).forEach(test => {
            const ext = this.getFileExtension(project.language);
            const page = project.pages[test.pageName];

            if (!page) {
                console.warn(`Page object not found for test: ${test.name}`);
                return;
            }

            const code = generator.generateTestSpec(test, page);

            if (code && code.trim()) {
                files[`tests/${test.name}${ext}`] = code;
                console.log(`Generated test spec: tests/${test.name}${ext}`);
            } else {
                console.warn(`Empty code for test spec: ${test.name}`);
                // Add a placeholder comment so file isn't empty
                files[`tests/${test.name}${ext}`] = `// Test Spec: ${test.name}\n// No test cases defined yet\n`;
            }
        });

        // Generate config file
        const configContent = this.generateConfigFile(project);
        if (configContent) {
            files[project.config] = configContent;
        }

        // Generate environments file
        files['environments.json'] = JSON.stringify(project.environments || {}, null, 2);

        // Generate package.json or requirements.txt
        const depsFile = this.getDependencyFile(project);
        const depsContent = this.generateDependencies(project);
        if (depsContent) {
            files[depsFile] = depsContent;
        }

        // Generate README
        files['README.md'] = this.generateReadme(project);

        // Generate helper scripts for easy local execution
        if (project.tool === 'playwright') {
            if (project.language === 'javascript' || project.language === 'typescript') {
                files['run_tests.sh'] = `#!/bin/bash\n# Install dependencies\nnpm install\n# Install browsers\nnpx playwright install\n# Run tests\nnpx playwright test`;
                files['run_tests.bat'] = `@echo off\nREM Install dependencies\ncall npm install\nREM Install browsers\ncall npx playwright install\nREM Run tests\ncall npx playwright test`;
            } else if (project.language === 'python') {
                files['run_tests.sh'] = `#!/bin/bash\npip install -r requirements.txt\nplaywright install\npytest`;
                files['run_tests.bat'] = `@echo off\npip install -r requirements.txt\nplaywright install\npytest`;
            }
        }

        return files;
    }

    // Get file extension based on language
    getFileExtension(language) {
        const extensions = {
            javascript: '.js',
            typescript: '.ts',
            python: '.py',
            java: '.java'
        };
        return extensions[language] || '.txt';
    }

    // Get dependency file name
    getDependencyFile(project) {
        if (project.language === 'javascript' || project.language === 'typescript') {
            return 'package.json';
        }
        if (project.language === 'python') {
            return 'requirements.txt';
        }
        if (project.language === 'java') {
            return 'pom.xml';
        }
        return 'dependencies.txt';
    }

    // Generate config file content
    generateConfigFile(project) {
        const configs = {
            playwright: {
                javascript: `module.exports = {
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
};`,
                typescript: `import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  timeout: 30000,
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
  },
};

export default config;`
            }
        };

        return configs[project.tool]?.[project.language] || '// Config file';
    }

    // Generate dependencies
    generateDependencies(project) {
        const deps = {
            playwright: {
                javascript: JSON.stringify({
                    name: project.name.toLowerCase().replace(/\s+/g, '-'),
                    version: '1.0.0',
                    scripts: {
                        test: 'playwright test'
                    },
                    devDependencies: {
                        '@playwright/test': '^1.40.0'
                    }
                }, null, 2),
                typescript: JSON.stringify({
                    name: project.name.toLowerCase().replace(/\s+/g, '-'),
                    version: '1.0.0',
                    scripts: {
                        test: 'playwright test'
                    },
                    devDependencies: {
                        '@playwright/test': '^1.40.0',
                        'typescript': '^5.0.0'
                    }
                }, null, 2),
                python: `playwright==1.40.0\npytest==7.4.0\npytest-playwright==0.4.3`
            }
        };

        return deps[project.tool]?.[project.language] || '';
    }

    // Generate README
    generateReadme(project) {
        return `# ${project.name}

Auto-generated automation project using ${project.tool} with ${project.language}.

## Setup

\`\`\`bash
${project.language === 'javascript' || project.language === 'typescript' ? 'npm install' : 'pip install -r requirements.txt'}
\`\`\`

## Run Tests

\`\`\`bash
${project.language === 'javascript' || project.language === 'typescript' ? 'npm test' : 'pytest'}
\`\`\`

## Project Structure

- \`pages/\` - Page Object Models
- \`tests/\` - Test specifications
- \`utils/\` - Helper utilities

Generated by Automation Framework Manager Chrome Extension.
`;
    }

    // Download project as files
    async downloadProject(projectId) {
        const files = await this.exportProject(projectId);
        const project = (await this.getAllProjects())[projectId];

        // Create downloads for each file
        for (const [path, content] of Object.entries(files)) {
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            await chrome.downloads.download({
                url: url,
                filename: `${project.name}/${path}`,
                saveAs: false
            });
        }
    }

    // Download project as ZIP
    async downloadProjectAsZip(projectId) {
        const files = await this.exportProject(projectId);
        const project = (await this.getAllProjects())[projectId];

        const zip = new JSZip();

        // Add all files to ZIP with proper structure
        for (const [path, content] of Object.entries(files)) {
            zip.file(path, content);
        }

        // Generate ZIP file
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);

        // Download ZIP
        await chrome.downloads.download({
            url: url,
            filename: `${project.name.replace(/\s+/g, '-')}.zip`,
            saveAs: true
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectManager;
}
