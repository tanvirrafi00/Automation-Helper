// Debug helper script - Run this in the extension console to check status

console.log('=== Automation Framework Manager - Debug Info ===\n');

// Check if required classes are loaded
console.log('1. Checking Classes:');
console.log('   - ProjectManager:', typeof ProjectManager);
console.log('   - CodeGenerator:', typeof CodeGenerator);
console.log('   - PageObject:', typeof PageObject);
console.log('   - TestSpec:', typeof TestSpec);

// Check storage
chrome.storage.local.get(null, (data) => {
    console.log('\n2. Storage Data:');
    console.log('   - Total keys:', Object.keys(data).length);
    console.log('   - Projects:', data.automation_projects ? Object.keys(data.automation_projects).length : 0);
    console.log('   - Current project ID:', data.current_project_id);

    if (data.current_project_id && data.automation_projects) {
        const project = data.automation_projects[data.current_project_id];
        if (project) {
            console.log('\n3. Current Project:');
            console.log('   - Name:', project.name);
            console.log('   - Tool:', project.tool);
            console.log('   - Language:', project.language);
            console.log('   - Page Objects:', Object.keys(project.pages).length);
            console.log('   - Test Specs:', Object.keys(project.tests).length);

            // Check test specs details
            Object.values(project.tests).forEach(test => {
                console.log(`\n   Test: ${test.name}`);
                console.log(`     - Page: ${test.pageName}`);
                console.log(`     - Test Cases: ${test.testCases.length}`);
                test.testCases.forEach((tc, i) => {
                    console.log(`       ${i + 1}. ${tc.name} (${tc.steps ? tc.steps.length : 0} steps)`);
                });
            });

            // Check page objects
            Object.values(project.pages).forEach(page => {
                console.log(`\n   Page Object: ${page.name}`);
                console.log(`     - Elements: ${Object.keys(page.elements).length}`);
                console.log(`     - Methods: ${page.methods.length}`);
            });
        } else {
            console.log('\n3. Current Project: NOT FOUND');
        }
    } else {
        console.log('\n3. No current project selected');
    }
});

// Check bytes used
chrome.storage.local.getBytesInUse(null, (bytes) => {
    console.log('\n4. Storage Usage:');
    console.log('   - Bytes used:', bytes);
    console.log('   - KB used:', (bytes / 1024).toFixed(2));
    console.log('   - Quota: ~5MB (5,242,880 bytes)');
    console.log('   - Available:', ((5242880 - bytes) / 1024).toFixed(2), 'KB');
});

console.log('\n=== End Debug Info ===');
console.log('\nTo test code generation, run:');
console.log('testCodeGeneration()');

// Test function
window.testCodeGeneration = function () {
    chrome.storage.local.get(['automation_projects', 'current_project_id'], (data) => {
        const project = data.automation_projects?.[data.current_project_id];
        if (!project) {
            console.error('No project found');
            return;
        }

        const pageObject = Object.values(project.pages)[0];
        const testSpec = Object.values(project.tests)[0];

        if (!pageObject || !testSpec) {
            console.error('Need at least one page object and test spec');
            return;
        }

        console.log('\nTesting code generation...');
        console.log('Page Object:', pageObject.name);
        console.log('Test Spec:', testSpec.name);

        try {
            const generator = new CodeGenerator(project.tool, project.language);

            // Test page object generation
            const pageCode = generator.generatePageObject(pageObject);
            console.log('\n--- Page Object Code ---');
            console.log(pageCode);

            // Test test spec generation
            const testCode = generator.generateTestSpec(testSpec, pageObject);
            console.log('\n--- Test Spec Code ---');
            console.log(testCode);

            console.log('\n✅ Code generation successful!');
        } catch (err) {
            console.error('❌ Code generation failed:', err);
        }
    });
};
