/**
 * Page Object Data Migration Script
 * Fixes corrupted Page Object data where selectors are stored as objects instead of strings
 * Also fixes test spec pageNames arrays that contain HTML elements or objects
 */

async function migratePageObjectData() {
    console.log('🔧 Starting comprehensive data migration...');

    try {
        // Get all projects from storage
        const data = await chrome.storage.local.get('projects');
        const projects = data.projects || [];

        let totalFixedSelectors = 0;
        let totalFixedPageNames = 0;
        let totalPages = 0;
        let totalTests = 0;

        for (const project of projects) {
            // Fix Page Object selectors
            if (project.pages) {
                for (const [pageName, pageObj] of Object.entries(project.pages)) {
                    if (!pageObj.elements) continue;

                    totalPages++;

                    for (const [elemName, elem] of Object.entries(pageObj.elements)) {
                        // Check if selector is an object (corrupted)
                        if (typeof elem.selector === 'object' && elem.selector !== null) {
                            // Extract the actual selector string
                            const selectorValue = elem.selector.value || elem.selector.selector || '';

                            if (selectorValue) {
                                console.log(`  ✅ Fixed selector: ${pageName}.${elemName}`);
                                elem.selector = selectorValue;
                                totalFixedSelectors++;
                            } else {
                                console.warn(`  ⚠️ Could not extract selector for ${pageName}.${elemName}:`, elem.selector);
                            }
                        }
                    }
                }
            }

            // Fix Test Spec pageNames arrays
            if (project.tests) {
                for (const [testName, testSpec] of Object.entries(project.tests)) {
                    totalTests++;

                    if (testSpec.pageNames && Array.isArray(testSpec.pageNames)) {
                        const cleanedPageNames = [];
                        let hadCorruption = false;

                        for (const pageName of testSpec.pageNames) {
                            // Only keep strings, filter out objects and HTML elements
                            if (typeof pageName === 'string') {
                                cleanedPageNames.push(pageName);
                            } else {
                                console.warn(`  ⚠️ Removed corrupted pageName from ${testName}:`, pageName);
                                hadCorruption = true;
                                totalFixedPageNames++;
                            }
                        }

                        if (hadCorruption) {
                            testSpec.pageNames = cleanedPageNames;
                            console.log(`  ✅ Fixed pageNames for test: ${testName}`);
                        }
                    }
                }
            }
        }

        // Save migrated data
        if (totalFixedSelectors > 0 || totalFixedPageNames > 0) {
            await chrome.storage.local.set({ projects });
            console.log(`✅ Migration complete!`);
            console.log(`   - Fixed ${totalFixedSelectors} selectors across ${totalPages} pages`);
            console.log(`   - Fixed ${totalFixedPageNames} pageNames across ${totalTests} tests`);
            return {
                success: true,
                fixedSelectors: totalFixedSelectors,
                fixedPageNames: totalFixedPageNames,
                pages: totalPages,
                tests: totalTests
            };
        } else {
            console.log('✅ No corrupted data found - all data is clean');
            return { success: true, fixedSelectors: 0, fixedPageNames: 0, pages: totalPages, tests: totalTests };
        }

    } catch (error) {
        console.error('❌ Migration failed:', error);
        return { success: false, error: error.message };
    }
}

// Auto-run migration when script loads
if (typeof chrome !== 'undefined' && chrome.storage) {
    migratePageObjectData().then(result => {
        if (result.success) {
            console.log('📊 Migration result:', result);
        }
    });
}

// Export for manual use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { migratePageObjectData };
}
