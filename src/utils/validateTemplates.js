// Validation test for generated project files
const ConfigTemplates = require('./configTemplates');
const HelperTemplates = require('./helperTemplates');

console.log('🧪 Testing Generated Project Files...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`❌ ${name}`);
        console.error(`   Error: ${err.message}`);
        failed++;
    }
}

// Test package.json generation
test('package.json - Valid JSON', () => {
    const pkg = ConfigTemplates.getPackageJson('Test Project');
    JSON.parse(pkg); // Will throw if invalid
});

test('package.json - Sanitizes special characters', () => {
    const pkg = ConfigTemplates.getPackageJson('My Test @Project! #123');
    const parsed = JSON.parse(pkg);
    if (!/^[a-z0-9-]+$/.test(parsed.name)) {
        throw new Error(`Invalid package name: ${parsed.name}`);
    }
});

test('package.json - Has required fields', () => {
    const pkg = ConfigTemplates.getPackageJson('Test');
    const parsed = JSON.parse(pkg);
    if (!parsed.name || !parsed.version || !parsed.scripts || !parsed.devDependencies) {
        throw new Error('Missing required fields');
    }
});

test('package.json - Has correct scripts', () => {
    const pkg = ConfigTemplates.getPackageJson('Test');
    const parsed = JSON.parse(pkg);
    const requiredScripts = ['test', 'test:headed', 'test:debug', 'report'];
    requiredScripts.forEach(script => {
        if (!parsed.scripts[script]) {
            throw new Error(`Missing script: ${script}`);
        }
    });
});

// Test .env.example
test('.env.example - Not empty', () => {
    const env = ConfigTemplates.getEnvExample();
    if (!env || env.trim().length === 0) {
        throw new Error('Empty .env.example');
    }
});

test('.env.example - Has required variables', () => {
    const env = ConfigTemplates.getEnvExample();
    const required = ['BASE_URL', 'USERNAME', 'PASSWORD'];
    required.forEach(varName => {
        if (!env.includes(varName)) {
            throw new Error(`Missing variable: ${varName}`);
        }
    });
});

// Test .gitignore
test('.gitignore - Not empty', () => {
    const gitignore = ConfigTemplates.getGitignore();
    if (!gitignore || gitignore.trim().length === 0) {
        throw new Error('Empty .gitignore');
    }
});

test('.gitignore - Ignores .env', () => {
    const gitignore = ConfigTemplates.getGitignore();
    if (!gitignore.includes('.env')) {
        throw new Error('.env not in .gitignore');
    }
});

// Test Playwright configs
test('Playwright config.js - Not empty', () => {
    const config = ConfigTemplates.getPlaywrightConfigJS();
    if (!config || config.trim().length === 0) {
        throw new Error('Empty config');
    }
});

test('Playwright config.js - Has dotenv', () => {
    const config = ConfigTemplates.getPlaywrightConfigJS();
    if (!config.includes('dotenv')) {
        throw new Error('Missing dotenv import');
    }
});

test('Playwright framework config - Not empty', () => {
    const config = ConfigTemplates.getPlaywrightFrameworkConfig();
    if (!config || config.trim().length === 0) {
        throw new Error('Empty config');
    }
});

// Test Python configs
test('Python config.py - Not empty', () => {
    const config = ConfigTemplates.getPythonConfig();
    if (!config || config.trim().length === 0) {
        throw new Error('Empty config');
    }
});

test('pytest.ini - Not empty', () => {
    const config = ConfigTemplates.getPytestIni();
    if (!config || config.trim().length === 0) {
        throw new Error('Empty config');
    }
});

test('requirements.txt - Not empty', () => {
    const req = ConfigTemplates.getRequirementsTxt();
    if (!req || req.trim().length === 0) {
        throw new Error('Empty requirements');
    }
});

// Test Java configs
test('Java config.properties - Not empty', () => {
    const config = ConfigTemplates.getJavaConfigProperties();
    if (!config || config.trim().length === 0) {
        throw new Error('Empty config');
    }
});

test('Java ConfigReader - Not empty', () => {
    const config = ConfigTemplates.getJavaConfigReader();
    if (!config || config.trim().length === 0) {
        throw new Error('Empty config');
    }
});

// Test Helpers
test('JS Helpers - Not empty', () => {
    const helpers = HelperTemplates.getJSHelpers();
    if (!helpers || helpers.trim().length === 0) {
        throw new Error('Empty helpers');
    }
});

test('TS Helpers - Not empty', () => {
    const helpers = HelperTemplates.getTSHelpers();
    if (!helpers || helpers.trim().length === 0) {
        throw new Error('Empty helpers');
    }
});

test('Python Helpers - Not empty', () => {
    const helpers = HelperTemplates.getPythonHelpers();
    if (!helpers || helpers.trim().length === 0) {
        throw new Error('Empty helpers');
    }
});

test('Java Helpers - Not empty', () => {
    const helpers = HelperTemplates.getJavaHelpers();
    if (!helpers || helpers.trim().length === 0) {
        throw new Error('Empty helpers');
    }
});

// Test Data
test('Test Data JSON - Valid JSON', () => {
    const data = HelperTemplates.getTestDataJSON();
    JSON.parse(data); // Will throw if invalid
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}

console.log('\n✨ All tests passed!');
