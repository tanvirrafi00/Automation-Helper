/**
 * Page Object Data Migration Script
 * Fixes corrupted Page Object data where selectors are stored as objects instead of strings
 */

async function migratePageObjectData() {
    console.log('🔧 Starting Page Object data migration...');

    try {
        // Get all projects from storage
        const data = await chrome.storage.local.get('projects');
        const projects = data.projects || [];

        let totalFixed = 0;
        let totalPages = 0;

        for (const project of projects) {
            if (!project.pages) continue;

            for (const [pageName, pageObj] of Object.entries(project.pages)) {
                if (!pageObj.elements) continue;

                totalPages++;
                let fixedInPage = 0;

                for (const [elemName, elem] of Object.entries(pageObj.elements)) {
                    // Check if selector is an object (corrupted)
                    if (typeof elem.selector === 'object' && elem.selector !== null) {
                        // Extract the actual selector string
                        const selectorValue = elem.selector.value || elem.selector.selector || '';

                        if (selectorValue) {
                            console.log(`  Fixing ${pageName}.${elemName}: ${JSON.stringify(elem.selector)} → "${selectorValue}"`);
                            elem.selector = selectorValue;
                            fixedInPage++;
                            totalFixed++;
                        } else {
                            console.warn(`  ⚠️ Could not extract selector for ${pageName}.${elemName}:`, elem.selector);
                        }
                    }
                }

                if (fixedInPage > 0) {
                    console.log(`  ✅ Fixed ${fixedInPage} elements in ${pageName}`);
                }
            }
        }

        // Save migrated data
        if (totalFixed > 0) {
            await chrome.storage.local.set({ projects });
            console.log(`✅ Migration complete! Fixed ${totalFixed} selectors across ${totalPages} pages`);
            return { success: true, fixed: totalFixed, pages: totalPages };
        } else {
            console.log('✅ No corrupted data found - all selectors are already strings');
            return { success: true, fixed: 0, pages: totalPages };
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
