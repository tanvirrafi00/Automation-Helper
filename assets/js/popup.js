// Main popup logic for Automation Framework Manager

document.addEventListener('DOMContentLoaded', async () => {
    const projectManager = new ProjectManager();
    let currentProject = null;
    let isRecording = false;
    let recordedSteps = [];

    // DOM Elements
    const projectSelect = document.getElementById('projectSelect');
    const newProjectBtn = document.getElementById('newProjectBtn');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Dashboard elements
    const pageObjectCount = document.getElementById('pageObjectCount');
    const testSpecCount = document.getElementById('testSpecCount');
    const testCaseCount = document.getElementById('testCaseCount');
    const projectTool = document.getElementById('projectTool');
    const projectLanguage = document.getElementById('projectLanguage');
    const projectCreated = document.getElementById('projectCreated');
    const projectUpdated = document.getElementById('projectUpdated');

    // Modals
    const newProjectModal = document.getElementById('newProjectModal');
    const newPageObjectModal = document.getElementById('newPageObjectModal');
    const newTestModal = document.getElementById('newTestModal');

    // Initialize
    await loadProjects();
    await loadCurrentProject();

    // Check for existing session
    chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
        if (response && response.session) {
            const session = response.session;
            // Restore session state
            if (session.steps && session.steps.length > 0) {
                recordedSteps = session.steps;
                recordedSteps.forEach(step => addStepToList(step));

                // Restore selections if possible
                if (session.testName) document.getElementById('recorderTestSelect').value = session.testName;
                if (session.testName) document.getElementById('recorderTestSelect').value = session.testName;
                if (session.testCase) document.getElementById('recorderTestCase').value = session.testCase;

                // If we have steps, we might be recording or stopped
                // Check content script status
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' }, (statusResp) => {
                        if (statusResp && statusResp.isRecording) {
                            setRecordingUI(true);
                        } else {
                            setRecordingUI(false);
                            // Show generate button since we have steps
                            const generateBtn = document.getElementById('generateCodeBtn');
                            if (generateBtn) generateBtn.style.display = 'inline-flex';
                        }
                    });
                });
            }
        }
    });

    setupEventListeners();

    function setRecordingUI(recording) {
        isRecording = recording;
        document.getElementById('startRecBtn').disabled = recording;
        document.getElementById('stopRecBtn').disabled = !recording;

        const statusEl = document.getElementById('recordingStatus');
        if (recording) {
            statusEl.textContent = 'Recording...';
            statusEl.style.color = '#ef4444';
        } else {
            statusEl.textContent = 'Stopped';
            statusEl.style.color = '#10b981';
        }
    }

    // Load all projects
    async function loadProjects() {
        const projects = await projectManager.getAllProjects();
        projectSelect.innerHTML = '<option value="">No Project Selected</option>';

        Object.values(projects).forEach(project => {
            const option = document.createElement('option');
            option.value = project.id;
            option.textContent = project.name;
            projectSelect.appendChild(option);
        });
    }

    // Load current project
    async function loadCurrentProject() {
        currentProject = await projectManager.getCurrentProject();

        if (currentProject) {
            // Auto-fix: Ensure tool and language are set (for legacy projects)
            let needsSave = false;
            if (!currentProject.tool) {
                console.warn('Auto-fixing: Project missing tool property, defaulting to playwright');
                currentProject.tool = 'playwright';
                needsSave = true;
            }
            if (!currentProject.language) {
                console.warn('Auto-fixing: Project missing language property, defaulting to javascript');
                currentProject.language = 'javascript';
                needsSave = true;
            }

            // Save the fixed project back to storage
            if (needsSave) {
                try {
                    await projectManager.updateProject(currentProject.id, {
                        tool: currentProject.tool,
                        language: currentProject.language
                    });
                    console.log('✅ Project auto-fixed and saved');
                } catch (e) {
                    console.error('Failed to save default config:', e);
                }
            }

            projectSelect.value = currentProject.id;
            updateDashboard();
            updatePageObjectsList();
            updateTestsList();
            updateRecorderSelects();
            updateExportPreview();
        }
    }

    // Update dashboard
    function updateDashboard() {
        if (!currentProject) {
            pageObjectCount.textContent = '0';
            testSpecCount.textContent = '0';
            testCaseCount.textContent = '0';
            projectTool.textContent = '-';
            projectLanguage.textContent = '-';
            projectCreated.textContent = '-';
            projectUpdated.textContent = '-';
            return;
        }

        const pageCount = Object.keys(currentProject.pages).length;
        const testCount = Object.keys(currentProject.tests).length;
        const caseCount = Object.values(currentProject.tests)
            .reduce((sum, test) => sum + test.testCases.length, 0);

        pageObjectCount.textContent = pageCount;
        testSpecCount.textContent = testCount;
        testCaseCount.textContent = caseCount;
        projectTool.textContent = currentProject.tool;
        projectLanguage.textContent = currentProject.language;
        projectCreated.textContent = new Date(currentProject.createdAt).toLocaleDateString();
        projectUpdated.textContent = new Date(currentProject.updatedAt).toLocaleDateString();
    }

    // Update page objects list
    function updatePageObjectsList() {
        const list = document.getElementById('pageObjectsList');

        if (!currentProject || Object.keys(currentProject.pages).length === 0) {
            list.innerHTML = '<p class="empty-state">No page objects yet. Create one to get started!</p>';
            return;
        }

        list.innerHTML = '';
        Object.values(currentProject.pages).forEach(page => {
            const elementCount = Object.keys(page.elements).length;
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
        <div class="list-item-header">
          <span class="list-item-title">${page.name}</span>
          <div class="list-item-actions">
            <button class="btn btn-info scan-page-btn" data-page-name="${page.name}" title="Scan current page for elements">🔍 Scan</button>
            <button class="btn btn-secondary view-page-btn" data-page-name="${page.name}">View Code</button>
            <button class="btn btn-danger delete-page-btn" data-page-name="${page.name}">Delete</button>
          </div>
        </div>
        <div class="list-item-meta">
          ${elementCount} elements • ${page.methods.length} methods
          ${elementCount === 0 ? '<span style="color: #ef4444; margin-left: 8px;">(Empty - Click Scan!)</span>' : ''}
        </div>
      `;
            list.appendChild(item);
        });
    }

    // Scan page for elements
    async function scanPageForElements(pageName) {
        if (!currentProject) return;

        const pageObject = currentProject.pages[pageName];
        if (!pageObject) return;

        const confirmScan = confirm(`Scan current page to add elements to "${pageName}"?\n\nMake sure you are on the correct page: ${pageObject.url}`);
        if (!confirmScan) return;

        // Find the button to update its text
        const btn = document.querySelector(`.scan-page-btn[data-page-name="${pageName}"]`);
        const originalText = btn ? btn.innerHTML : '🔍 Scan';
        if (btn) {
            btn.innerHTML = '⏳ Scanning...';
            btn.disabled = true;
        }

        try {
            // Check content script
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length === 0) {
                alert('No active tab found.');
                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
                return;
            }

            const tab = tabs[0];

            // Inject if needed
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
            } catch (e) {
                console.log('Content script not ready, injecting...', e);
                await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['src/content/content.js']
                });
                await new Promise(r => setTimeout(r, 1000)); // Wait longer for init
            }

            // Detect
            chrome.tabs.sendMessage(tab.id, { type: 'DETECT_ELEMENTS' }, async (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    alert('Failed to communicate with page. Please refresh the page and try again.');
                    if (btn) {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }
                    return;
                }

                if (response && response.elements) {
                    let addedCount = 0;
                    response.elements.forEach(el => {
                        if (!pageObject.elements[el.name]) {
                            // Directly add to elements object since pageObject might be a plain object
                            pageObject.elements[el.name] = {
                                selector: el.selector,
                                type: el.type
                            };
                            addedCount++;
                        }
                    });

                    if (addedCount > 0) {
                        await projectManager.updateProject(currentProject.id, currentProject);
                        await loadCurrentProject();
                        alert(`✅ Successfully added ${addedCount} elements to ${pageName}!`);
                    } else {
                        alert('⚠️ No new elements found. (All detected elements are already in the Page Object)');
                    }
                } else {
                    alert('❌ Failed to detect elements. Response was empty.');
                }

                if (btn) {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            });
        } catch (err) {
            console.error('Scan failed:', err);
            alert(`Scan failed: ${err.message}`);
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    }

    // Update tests list
    function updateTestsList() {
        const list = document.getElementById('testsList');

        if (!currentProject || Object.keys(currentProject.tests).length === 0) {
            list.innerHTML = '<p class="empty-state">No tests yet. Create one to get started!</p>';
            return;
        }

        list.innerHTML = '';
        Object.values(currentProject.tests).forEach(test => {
            const item = document.createElement('div');
            item.className = 'list-item test-suite-item';

            let casesHtml = '';
            if (test.testCases && test.testCases.length > 0) {
                casesHtml = '<div class="test-cases-list">';
                casesHtml += '<div class="test-cases-header">📋 Test Cases:</div>';
                test.testCases.forEach((tc, index) => {
                    const stepCount = tc.steps ? tc.steps.length : 0;
                    casesHtml += `
                        <div class="test-case-item">
                            <div class="test-case-info">
                                <span class="test-case-name">🔹 ${tc.name}</span>
                                <span class="test-case-meta">${stepCount} steps</span>
                            </div>
                            <div class="test-case-actions">
                                <button class="btn btn-sm btn-secondary view-case-btn" data-test-name="${test.name}" data-case-index="${index}" title="View Code">👁️ View</button>
                                <button class="btn btn-sm btn-success run-case-btn" data-test-name="${test.name}" data-case-name="${tc.name}" title="Run Test Case">▶ Run</button>
                                <button class="btn btn-sm btn-danger delete-case-btn" data-test-name="${test.name}" data-case-index="${index}" title="Delete">×</button>
                            </div>
                        </div>
                    `;
                });
                casesHtml += '</div>';
            } else {
                casesHtml = '<div class="test-cases-list"><p class="empty-state" style="padding: 12px; margin: 0;">No test cases yet. Record some steps to add test cases.</p></div>';
            }

            // Get page object names for display (handle both legacy and new format)
            let pageObjectsDisplay = '';
            if (test.pageNames && Array.isArray(test.pageNames)) {
                pageObjectsDisplay = test.pageNames.join(', ');
            } else if (test.pageName) {
                pageObjectsDisplay = test.pageName;
            } else {
                pageObjectsDisplay = 'None';
            }

            item.innerHTML = `
        <div class="list-item-header">
          <div class="test-suite-title">
            <span class="suite-icon">📦</span>
            <span class="list-item-title">${test.name}</span>
            <span class="suite-badge">${test.testCases.length} test case${test.testCases.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-secondary view-test-btn" data-test-name="${test.name}">View All Code</button>
            <button class="btn btn-danger delete-test-btn" data-test-name="${test.name}">Delete Suite</button>
          </div>
        </div>
        <div class="list-item-meta">
          Page Objects: ${pageObjectsDisplay} • Tool: ${test.tool} • Language: ${test.language}
        </div>
        ${casesHtml}
      `;
            list.appendChild(item);
        });
    }

    // Update recorder selects
    function updateRecorderSelects() {
        const testSelect = document.getElementById('recorderTestSelect');
        const testCaseSelect = document.getElementById('recorderTestCase');
        const newTestCaseLabel = document.getElementById('newTestCaseNameLabel');
        const newTestCaseInput = document.getElementById('newTestCaseName');

        testSelect.innerHTML = '<option value="">Select Test Spec</option>';
        testCaseSelect.innerHTML = '<option value="">Select or Create Test Case</option><option value="__new__">➕ Create New Test Case</option>';

        if (!currentProject) return;

        Object.keys(currentProject.tests).forEach(testName => {
            const option = document.createElement('option');
            option.value = testName;
            option.textContent = testName;
            testSelect.appendChild(option);
        });

        // Remove old event listeners by cloning
        const newTestSelect = testSelect.cloneNode(true);
        testSelect.parentNode.replaceChild(newTestSelect, testSelect);
        const newTestCaseSelect = testCaseSelect.cloneNode(true);
        testCaseSelect.parentNode.replaceChild(newTestCaseSelect, testCaseSelect);

        // Populate test cases when test suite is selected
        newTestSelect.addEventListener('change', function () {
            const selectedTest = this.value;
            newTestCaseSelect.innerHTML = '<option value="">Select or Create Test Case</option><option value="__new__">➕ Create New Test Case</option>';

            if (selectedTest && currentProject.tests[selectedTest]) {
                const testSpec = currentProject.tests[selectedTest];
                if (testSpec.testCases && testSpec.testCases.length > 0) {
                    testSpec.testCases.forEach(testCase => {
                        const option = document.createElement('option');
                        option.value = testCase.name;
                        option.textContent = testCase.name;
                        newTestCaseSelect.appendChild(option);
                    });
                }

                // Auto-select associated Page Object(s)
                if (testSpec.pageNames && testSpec.pageNames.length > 0) {
                    pageSelect.innerHTML = ''; // Clear current list

                    testSpec.pageNames.forEach(pageName => {
                        if (currentProject.pages[pageName]) {
                            const option = document.createElement('option');
                            option.value = pageName;
                            option.textContent = pageName;
                            pageSelect.appendChild(option);
                        }
                    });

                    // Select the first one by default
                    if (pageSelect.options.length > 0) {
                        pageSelect.selectedIndex = 0;
                    }
                } else if (testSpec.pageName) {
                    // Legacy support
                    pageSelect.innerHTML = '';
                    const option = document.createElement('option');
                    option.value = testSpec.pageName;
                    option.textContent = testSpec.pageName;
                    pageSelect.appendChild(option);
                    pageSelect.selectedIndex = 0;
                }
            } else {
                // If no test suite selected (or invalid), reset page select to show all
                pageSelect.innerHTML = '<option value="">Select Page Object</option>';
                Object.keys(currentProject.pages).forEach(pageName => {
                    const option = document.createElement('option');
                    option.value = pageName;
                    option.textContent = pageName;
                    pageSelect.appendChild(option);
                });
            }
        });
        // Handle "Create New Test Case" selection
        newTestCaseSelect.addEventListener('change', function () {
            if (this.value === '__new__') {
                newTestCaseLabel.style.display = 'block';
                newTestCaseInput.required = true;
            } else {
                newTestCaseLabel.style.display = 'none';
                newTestCaseInput.required = false;
                newTestCaseInput.value = '';
            }
        });
    }

    // Update export preview
    function updateExportPreview() {
        const preview = document.getElementById('projectStructure');

        if (!currentProject) {
            preview.textContent = 'Select a project to see structure...';
            return;
        }

        const structure = `${currentProject.name}/
├── tests/
${Object.keys(currentProject.tests).map(t => `│   ├── ${t}.${getFileExt()}`).join('\n')}
├── pages/
${Object.keys(currentProject.pages).map(p => `│   ├── ${p}.${getFileExt()}`).join('\n')}
├── utils/
│   └── helpers.${getFileExt()}
└── ${currentProject.config}`;

        preview.textContent = structure;
    }

    function getFileExt() {
        if (!currentProject) return 'js';
        const exts = {
            javascript: 'js',
            typescript: 'ts',
            python: 'py',
            java: 'java'
        };
        return exts[currentProject.language] || 'js';
    }

    // Setup event listeners
    function setupEventListeners() {
        // Tab switching
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            });
        });

        // Project selection
        projectSelect.addEventListener('change', async (e) => {
            if (e.target.value) {
                try {
                    await projectManager.setCurrentProject(e.target.value);
                    await loadCurrentProject();
                } catch (err) {
                    console.error('Failed to load project:', err);
                    alert('Failed to load project. Please try again.');
                }
            }
        });

        // New project button
        newProjectBtn.addEventListener('click', () => {
            openModal(newProjectModal);
        });

        // Create project
        document.getElementById('createProjectBtn').addEventListener('click', async () => {
            const name = document.getElementById('projectName').value;
            const tool = document.getElementById('projectTool').value;
            const language = document.getElementById('projectLanguage').value;
            const template = document.getElementById('projectTemplate').value;

            if (!name) {
                alert('Please enter a project name');
                return;
            }

            try {
                await projectManager.createProject(name, tool, language, template);
                closeModal(newProjectModal);
                await loadProjects();
                await loadCurrentProject();
                alert('Project created successfully!');
            } catch (err) {
                console.error('Failed to create project:', err);
                alert('Failed to create project. Please try again.');
            }
        });

        // Add page object button
        const openPageObjectModal = () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            // Reset form fields
            document.getElementById('pageName').value = '';
            document.getElementById('autoDetectElements').checked = false;
            document.getElementById('pageAction').value = 'new';

            // Toggle fields based on action
            const newPageFields = document.getElementById('newPageFields');
            const existingPageFields = document.getElementById('existingPageFields');
            newPageFields.style.display = 'block';
            existingPageFields.style.display = 'none';

            // Populate existing page objects dropdown
            const existingPageSelect = document.getElementById('existingPageSelect');
            existingPageSelect.innerHTML = '<option value="">Select Page Object</option>';
            Object.keys(currentProject.pages).forEach(pageName => {
                const option = document.createElement('option');
                option.value = pageName;
                option.textContent = pageName;
                existingPageSelect.appendChild(option);
            });

            // Auto-fill URL from current tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    const urlInput = document.getElementById('pageUrl');
                    if (urlInput) {
                        urlInput.value = tabs[0].url;
                    }
                }
            });
            openModal(newPageObjectModal);
        };

        document.getElementById('addPageObjectBtn').addEventListener('click', openPageObjectModal);
        document.getElementById('createPageObjectBtn').addEventListener('click', openPageObjectModal);

        // Handle Page Action Toggle
        document.getElementById('pageAction')?.addEventListener('change', (e) => {
            const newPageFields = document.getElementById('newPageFields');
            const existingPageFields = document.getElementById('existingPageFields');

            if (e.target.value === 'new') {
                newPageFields.style.display = 'block';
                existingPageFields.style.display = 'none';
            } else {
                newPageFields.style.display = 'none';
                existingPageFields.style.display = 'block';
            }
        });

        // Create/Update page object
        document.getElementById('createPageBtn').addEventListener('click', async () => {
            const action = document.getElementById('pageAction').value;
            const autoDetect = document.getElementById('autoDetectElements').checked;

            let pageObject;
            let pageName;

            if (action === 'new') {
                pageName = document.getElementById('pageName').value;
                const url = document.getElementById('pageUrl').value;

                if (!pageName) {
                    alert('Please enter a page name');
                    return;
                }
                pageObject = new PageObject(pageName, url, currentProject.tool, currentProject.language);
            } else {
                pageName = document.getElementById('existingPageSelect').value;
                if (!pageName) {
                    alert('Please select an existing Page Object');
                    return;
                }
                pageObject = currentProject.pages[pageName];
                if (!pageObject) {
                    alert('Selected Page Object not found!');
                    return;
                }
            }

            try {
                if (autoDetect) {
                    // Wait for element detection
                    await new Promise((resolve) => {
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs.length === 0) {
                                resolve();
                                return;
                            }

                            // Check if we can inject script first (in case it's not loaded)
                            chrome.tabs.sendMessage(tabs[0].id, { type: 'DETECT_ELEMENTS' }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.log('Content script not ready for detection, skipping auto-detect');
                                    resolve();
                                    return;
                                }

                                if (response && response.elements) {
                                    console.log('Detected elements:', response.elements.length);
                                    response.elements.forEach(el => {
                                        // Handle both class instance and plain object
                                        if (typeof pageObject.addElement === 'function') {
                                            pageObject.addElement(el.name, el.selector, el.type);
                                        } else {
                                            if (!pageObject.elements) pageObject.elements = {};
                                            // Check if element already exists to avoid overwriting with same selector if desired, 
                                            // but usually we want to add new ones. 
                                            // If name exists, it will overwrite.
                                            pageObject.elements[el.name] = {
                                                selector: el.selector,
                                                type: el.type,
                                                addedAt: Date.now()
                                            };
                                        }
                                    });
                                }
                                resolve();
                            });
                        });
                    });
                }

                if (action === 'new') {
                    await projectManager.addPageObject(currentProject.id, pageObject);
                    alert('Page object created successfully!');
                } else {
                    // For existing, we just need to save the project since we modified the object reference
                    await projectManager.updateProject(currentProject.id, { pages: currentProject.pages });
                    alert(`Page object "${pageName}" updated successfully!`);
                }

                closeModal(newPageObjectModal);
                await loadCurrentProject();
            } catch (err) {
                console.error('Failed to save page object:', err);
                alert('Failed to save page object. Please try again.');
            }
        });

        // Add test button
        document.getElementById('addTestBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            populateTestModal();
            openModal(newTestModal);
        });

        document.getElementById('createTestBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            populateTestModal();
            openModal(newTestModal);
        });

        // Toggle between new suite and existing suite fields
        document.getElementById('testAction')?.addEventListener('change', (e) => {
            const newFields = document.getElementById('newSuiteFields');
            const existingFields = document.getElementById('existingSuiteFields');

            if (e.target.value === 'new') {
                newFields.style.display = 'block';
                existingFields.style.display = 'none';
            } else {
                newFields.style.display = 'none';
                existingFields.style.display = 'block';
            }
        });

        function populateTestModal() {
            // Helper to populate multi-select container
            const populateMultiSelect = (containerId, items) => {
                const container = document.getElementById(containerId);
                container.innerHTML = '';

                if (items.length === 0) {
                    container.innerHTML = '<div style="padding: 8px; color: #666; font-style: italic;">No page objects found</div>';
                    return;
                }

                items.forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'multi-select-item';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = item;
                    checkbox.id = `${containerId}-${item}`;

                    const label = document.createElement('label');
                    label.htmlFor = `${containerId}-${item}`;
                    label.textContent = item;

                    // Toggle selection on click
                    div.addEventListener('click', (e) => {
                        if (e.target !== checkbox && e.target !== label) {
                            checkbox.checked = !checkbox.checked;
                        }
                        if (checkbox.checked) {
                            div.classList.add('selected');
                        } else {
                            div.classList.remove('selected');
                        }
                    });

                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            div.classList.add('selected');
                        } else {
                            div.classList.remove('selected');
                        }
                    });

                    div.appendChild(checkbox);
                    div.appendChild(label);
                    container.appendChild(div);
                });
            };

            // Populate page object select with multi-select support
            const pageNames = Object.keys(currentProject.pages);
            populateMultiSelect('testPageObject', pageNames);

            // Populate existing test suites select
            const existingSuiteSelect = document.getElementById('existingTestSuite');
            existingSuiteSelect.innerHTML = '<option value="">Select Suite</option>';

            Object.keys(currentProject.tests).forEach(testName => {
                const option = document.createElement('option');
                option.value = testName;
                option.textContent = testName;
                existingSuiteSelect.appendChild(option);
            });

            // Populate existing suite page object select (multi-select)
            populateMultiSelect('existingSuitePageObject', pageNames);
        }

        // Helper to get selected values from multi-select container
        function getMultiSelectValues(containerId) {
            const container = document.getElementById(containerId);
            const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
            return Array.from(checkboxes).map(cb => cb.value);
        }

        // Helper function to check if test case name exists across all test suites
        function isTestCaseNameDuplicate(testCaseName, excludeSuiteName = null) {
            for (const [suiteName, testSpec] of Object.entries(currentProject.tests)) {
                if (excludeSuiteName && suiteName === excludeSuiteName) continue;
                if (testSpec.testCases && testSpec.testCases.some(tc => tc.name === testCaseName)) {
                    return suiteName;
                }
            }
            return null;
        }

        // Create test spec or add to existing
        document.getElementById('createTestSpecBtn').addEventListener('click', async () => {
            const action = document.getElementById('testAction').value;
            const testCaseName = document.getElementById('testCaseName').value;
            const isDataDriven = document.getElementById('isDataDriven').checked;

            if (!testCaseName || testCaseName.trim() === '') {
                alert('Please enter a test case name');
                return;
            }

            // Check for duplicate test case names across all suites
            const duplicateSuite = isTestCaseNameDuplicate(testCaseName);
            if (duplicateSuite) {
                alert(`❌ Test case name "${testCaseName}" already exists in suite "${duplicateSuite}".\n\nPlease choose a different name.`);
                return;
            }

            try {
                if (action === 'new') {
                    // Create new test suite
                    const name = document.getElementById('testName').value;
                    const selectedPages = getMultiSelectValues('testPageObject');

                    if (!name || name.trim() === '') {
                        alert('Please enter a test suite name');
                        return;
                    }

                    if (selectedPages.length === 0) {
                        alert('Please select at least one Page Object.');
                        return;
                    }

                    const testSpec = new TestSpec(name, selectedPages, currentProject.tool, currentProject.language);
                    const data = isDataDriven ? [{ username: 'test', password: '123' }] : null;

                    try {
                        testSpec.addTestCase(testCaseName, [], data);
                    } catch (err) {
                        alert(`❌ ${err.message}`);
                        return;
                    }

                    await projectManager.addTestSpec(currentProject.id, testSpec);
                    alert(`✅ Test suite "${name}" created successfully with ${selectedPages.length} page object(s)!`);
                } else {
                    // Add to existing suite
                    const suiteName = document.getElementById('existingTestSuite').value;
                    if (!suiteName) {
                        alert('Please select a test suite');
                        return;
                    }

                    const testSpec = currentProject.tests[suiteName];
                    const data = isDataDriven ? [{ username: 'test', password: '123' }] : null;

                    // Add additional page objects if selected
                    const selectedPages = getMultiSelectValues('existingSuitePageObject');

                    if (selectedPages.length > 0) {
                        // Initialize pageNames if it doesn't exist (legacy support)
                        if (!testSpec.pageNames) {
                            testSpec.pageNames = testSpec.pageName ? [testSpec.pageName] : [];
                        }

                        // Add new pages if they don't exist
                        let addedCount = 0;
                        selectedPages.forEach(page => {
                            if (!testSpec.pageNames.includes(page)) {
                                testSpec.pageNames.push(page);
                                addedCount++;
                            }
                        });

                        if (addedCount > 0) {
                            console.log(`Added ${addedCount} new page objects to suite ${suiteName}`);
                        }
                    }

                    try {
                        // We need to re-instantiate TestSpec to use its methods properly if it was just a plain object from storage
                        // But here we are modifying the object directly which is fine as long as structure matches
                        // Let's use the method if available, or manual push
                        if (typeof testSpec.addTestCase === 'function') {
                            testSpec.addTestCase(testCaseName, [], data);
                        } else {
                            // Manual add for plain object
                            if (!testSpec.testCases) testSpec.testCases = [];
                            testSpec.testCases.push({
                                name: testCaseName,
                                steps: [],
                                data: data,
                                id: Date.now().toString()
                            });
                        }
                    } catch (err) {
                        alert(`❌ ${err.message}`);
                        return;
                    }

                    await projectManager.updateProject(currentProject.id, { tests: currentProject.tests });
                    alert(`✅ Test case added to "${suiteName}" successfully!`);
                }

                closeModal(newTestModal);
                await loadCurrentProject();
            } catch (err) {
                console.error('Failed to create test:', err);
                alert('Failed to create test. Please try again.');
            }
        });

        // Recorder controls
        document.getElementById('startRecBtn').addEventListener('click', startRecording);
        document.getElementById('stopRecBtn').addEventListener('click', stopRecording);
        document.getElementById('clearStepsBtn').addEventListener('click', clearSteps);
        document.getElementById('generateCodeBtn')?.addEventListener('click', saveGeneratedCode);

        // Export buttons
        document.getElementById('downloadZipBtn')?.addEventListener('click', async () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            try {
                await projectManager.downloadProjectAsZip(currentProject.id);
            } catch (err) {
                console.error('Failed to download ZIP:', err);
                alert('Failed to download ZIP. Please try again.');
            }
        });

        document.getElementById('downloadProjectBtn').addEventListener('click', async () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            try {
                await projectManager.downloadProject(currentProject.id);
            } catch (err) {
                console.error('Failed to download project:', err);
                alert('Failed to download project. Please try again.');
            }
        });

        document.getElementById('copyAllCodeBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            const preview = document.getElementById('projectStructure');
            navigator.clipboard.writeText(preview.textContent);
            alert('Project structure copied to clipboard!');
        });

        document.getElementById('copyCodeBtn').addEventListener('click', () => {
            const code = document.getElementById('generatedCode').textContent;
            navigator.clipboard.writeText(code);
            alert('Code copied to clipboard!');
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                closeModal(modal);
            });
        });

        // Replay button
        document.getElementById('replayBtn')?.addEventListener('click', async () => {
            if (!currentProject || recordedSteps.length === 0) {
                alert('No steps to replay');
                return;
            }

            // Toggle buttons
            document.getElementById('replayBtn').style.display = 'none';
            document.getElementById('stopReplayBtn').style.display = 'inline-block';

            // Send steps to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    alert('No active tab found');
                    resetReplayButtons();
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'REPLAY_STEPS',
                    steps: recordedSteps
                }).catch(err => {
                    console.error('Replay failed:', err);
                    alert('Failed to start replay. Please refresh the page.');
                    resetReplayButtons();
                });
            });
        });

        // Stop Replay button
        document.getElementById('stopReplayBtn')?.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_REPLAY' });
                }
            });
            resetReplayButtons();
        });

        function resetReplayButtons() {
            document.getElementById('replayBtn').style.display = 'inline-block';
            document.getElementById('stopReplayBtn').style.display = 'none';
        }

        // Screenshot button
        document.getElementById('screenshotBtn')?.addEventListener('click', () => {
            if (isRecording) {
                // Add screenshot step
                const step = {
                    action: 'screenshot',
                    selector: 'body', // Placeholder
                    value: `screenshot_${Date.now()}.png`,
                    elementName: 'Page',
                    timestamp: Date.now()
                };
                recordedSteps.push(step);
                addStepToList(step);
                generateCode();
            } else {
                // Immediate screenshot
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs.length === 0) return;
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_SCREENSHOT' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error('Screenshot failed:', chrome.runtime.lastError);
                            return;
                        }
                        if (response && response.screenshotUrl) {
                            const link = document.createElement('a');
                            link.href = response.screenshotUrl;
                            link.download = `screenshot_${Date.now()}.png`;
                            link.click();
                        }
                    });
                });
            }
        });

        // Dark Mode Toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
            });

            // Init theme
            if (localStorage.getItem('theme') === 'dark') {
                document.body.classList.add('dark-mode');
            }
        }

        // Search Filters
        document.getElementById('pageSearch')?.addEventListener('input', (e) => {
            filterList('pageObjectsList', e.target.value);
        });

        document.getElementById('testSearch')?.addEventListener('input', (e) => {
            filterList('testsList', e.target.value);
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            // Alt+R to toggle recording
            if (e.altKey && e.key === 'r') {
                if (isRecording) stopRecording();
                else startRecording();
            }
        });

        // Event delegation for dynamically created buttons
        document.addEventListener('click', (e) => {
            // Page Object buttons
            if (e.target.classList.contains('scan-page-btn')) {
                const pageName = e.target.dataset.pageName;
                scanPageForElements(pageName);
            }
            else if (e.target.classList.contains('view-page-btn')) {
                const pageName = e.target.dataset.pageName;
                window.viewPageObject(pageName);
            }
            else if (e.target.classList.contains('delete-page-btn')) {
                const pageName = e.target.dataset.pageName;
                window.deletePageObject(pageName);
            }
            // Test Suite buttons
            else if (e.target.classList.contains('view-test-btn')) {
                const testName = e.target.dataset.testName;
                window.viewTest(testName);
            }
            else if (e.target.classList.contains('delete-test-btn')) {
                const testName = e.target.dataset.testName;
                window.deleteTest(testName);
            }
            // Test Case buttons
            else if (e.target.classList.contains('view-case-btn')) {
                const testName = e.target.dataset.testName;
                const caseIndex = parseInt(e.target.dataset.caseIndex);
                window.viewTestCase(testName, caseIndex);
            }
            else if (e.target.classList.contains('run-case-btn')) {
                const testName = e.target.dataset.testName;
                const caseName = e.target.dataset.caseName;
                window.runTestCase(testName, caseName);
            }
            else if (e.target.classList.contains('delete-case-btn')) {
                const testName = e.target.dataset.testName;
                const caseIndex = parseInt(e.target.dataset.caseIndex);
                window.deleteTestCase(testName, caseIndex);
            }
        });
    }

    // Filter list items
    function filterList(listId, query) {
        const list = document.getElementById(listId);
        const items = list.querySelectorAll('.list-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(lowerQuery) ? 'block' : 'none';
        });
    }

    // Recording functions
    function startRecording() {
        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;
        const testCaseSelect = document.getElementById('recorderTestCase');
        const testCaseValue = testCaseSelect.value;

        // Get the actual test case name
        let testCaseName;
        if (testCaseValue === '__new__') {
            // Creating new test case
            testCaseName = document.getElementById('newTestCaseName').value.trim();
            if (!testCaseName) {
                alert('Please enter a name for the new test case.');
                return;
            }
        } else {
            // Using existing test case
            testCaseName = testCaseValue;
        }

        if (!pageName || !testName || !testCaseName) {
            alert('Please select Page Object, Test Spec, and Test Case.');
            return;
        }

        // Validate test case name doesn't already exist (only for new test cases)
        if (testCaseValue === '__new__') {
            for (const [suiteName, suite] of Object.entries(currentProject.tests)) {
                if (suite.testCases && suite.testCases.some(tc => tc.name === testCaseName)) {
                    alert(`❌ Test case name "${testCaseName}" already exists in suite "${suiteName}".\n\nPlease choose a different name.`);
                    return;
                }
            }
        }

        setRecordingUI(true);

        // Get active tab
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            if (tabs.length === 0) {
                alert('No active tab found. Please open a webpage first.');
                setRecordingUI(false);
                return;
            }

            const tab = tabs[0];

            // Check if we can inject scripts (some pages like chrome:// don't allow it)
            if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
                alert('Cannot record on Chrome internal pages. Please navigate to a regular website.');
                setRecordingUI(false);
                return;
            }

            try {
                // First, try to ping the content script to see if it's loaded
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' }).catch(() => null);

                if (!response) {
                    // Content script not loaded, inject it
                    console.log('Content script not loaded, injecting...');

                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['src/content/content.js']
                        });

                        // Wait a bit for the script to initialize
                        await new Promise(resolve => setTimeout(resolve, 500));
                        console.log('Content script injected successfully');
                    } catch (injectErr) {
                        console.error('Failed to inject content script:', injectErr);
                        alert('Failed to inject recorder script. Please refresh the page and try again.');
                        setRecordingUI(false);
                        return;
                    }
                }

                // Now send the start recording message
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'START_RECORDING',
                    pageName,
                    testName,
                    testCaseName
                });

                console.log('Recording started successfully');
            } catch (err) {
                console.error('Failed to start recording:', err);
                alert(`Failed to start recording: ${err.message}\n\nPlease:\n1. Refresh the page\n2. Try again\n3. Check that you're on a regular website (not chrome:// pages)`);
                setRecordingUI(false);
            }
        });
    }

    function stopRecording() {
        setRecordingUI(false);

        // Send message to content script to stop recording
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_RECORDING' });
            }
        });

        // Show generate code button if steps exist
        if (recordedSteps.length > 0) {
            const generateBtn = document.getElementById('generateCodeBtn');
            if (generateBtn) {
                generateBtn.style.display = 'inline-flex';
            }
        }
    }

    async function saveGeneratedCode() {
        try {
            if (!currentProject) {
                alert('No project selected!');
                return;
            }

            if (recordedSteps.length === 0) {
                alert('No steps recorded to save!');
                return;
            }

            const pageName = document.getElementById('recorderPageSelect').value;
            const testName = document.getElementById('recorderTestSelect').value;
            const testCaseSelect = document.getElementById('recorderTestCase');
            const testCaseValue = testCaseSelect.value;

            // Get the actual test case name
            let testCaseName;
            let isNewTestCase = false;

            if (testCaseValue === '__new__') {
                // Creating new test case
                testCaseName = document.getElementById('newTestCaseName').value.trim();
                isNewTestCase = true;

                if (!testCaseName) {
                    alert('Please enter a name for the new test case.');
                    return;
                }
            } else if (testCaseValue === '' || !testCaseValue) {
                alert('Please select a test case or create a new one.');
                return;
            } else {
                // Using existing test case
                testCaseName = testCaseValue;
                isNewTestCase = false;
            }

            if (!pageName || !testName || !testCaseName) {
                alert('Please select Page Object, Test Spec, and Test Case.');
                return;
            }

            // Only validate for duplicates if creating a NEW test case
            if (isNewTestCase) {
                for (const [suiteName, suite] of Object.entries(currentProject.tests)) {
                    if (suite.testCases && suite.testCases.some(tc => tc.name === testCaseName)) {
                        alert(`❌ Test case name "${testCaseName}" already exists in suite "${suiteName}".\n\nPlease choose a different name.`);
                        return;
                    }
                }
            }

            const testSpec = currentProject.tests[testName];
            if (!testSpec) {
                alert(`Test spec "${testName}" not found!`);
                return;
            }

            // Ensure testCases array exists
            if (!testSpec.testCases) {
                testSpec.testCases = [];
            }

            // Find existing test case or create new one
            let existingCaseIndex = testSpec.testCases.findIndex(tc => tc.name === testCaseName);

            if (existingCaseIndex >= 0) {
                // Update existing test case - APPEND new steps to existing ones
                const existingCase = testSpec.testCases[existingCaseIndex];

                // Ask user if they want to append or replace
                const userChoice = confirm(
                    `Test case "${testCaseName}" already has ${existingCase.steps?.length || 0} step(s).\n\n` +
                    `Click OK to APPEND ${recordedSteps.length} new step(s)\n` +
                    `Click Cancel to REPLACE all steps`
                );

                if (userChoice) {
                    // Append new steps
                    existingCase.steps = [...(existingCase.steps || []), ...recordedSteps];
                    console.log(`✅ Appended ${recordedSteps.length} steps to existing test case "${testCaseName}"`);
                } else {
                    // Replace all steps
                    existingCase.steps = recordedSteps;
                    console.log(`✅ Replaced steps in test case "${testCaseName}"`);
                }

                existingCase.updatedAt = Date.now();
            } else {
                // Create new test case
                testSpec.testCases.push({
                    name: testCaseName,
                    steps: recordedSteps,
                    createdAt: Date.now()
                });
                console.log(`✅ Created new test case "${testCaseName}" with ${recordedSteps.length} steps`);
            }

            // Ensure pageNames is set (for multiple page object support)
            if (!testSpec.pageNames || !Array.isArray(testSpec.pageNames)) {
                testSpec.pageNames = testSpec.pageName ? [testSpec.pageName] : [];
            }
            if (!testSpec.pageNames.includes(pageName)) {
                testSpec.pageNames.push(pageName);
            }

            // Update the project
            currentProject.tests[testName] = testSpec;
            await projectManager.updateProject(currentProject.id, {
                tests: currentProject.tests
            });

            alert(`✅ Test case "${testCaseName}" saved successfully with ${recordedSteps.length} step(s)!`);

            // Update UI
            updateTestsList();
            updateRecorderSelects();

            // Clear recorded steps
            recordedSteps = [];
            document.getElementById('stepsList').innerHTML = '';
            document.getElementById('generatedCode').textContent = '// Code will appear here...';

        } catch (err) {
            console.error('Error saving code:', err);
            alert(`Failed to save test case: ${err.message}\n\nPlease check the console for details.`);
        }
    } function clearSteps() {
        recordedSteps = [];
        document.getElementById('stepsList').innerHTML = '';
        document.getElementById('generatedCode').textContent = '// Code will appear here...';
    }

    function generateCode() {
        const codeDisplay = document.getElementById('generatedCode');

        if (!currentProject) {
            codeDisplay.textContent = '// Please create or select a project first';
            return;
        }

        if (recordedSteps.length === 0) {
            codeDisplay.textContent = '// Start recording to see generated code...';
            return;
        }

        const testName = document.getElementById('recorderTestSelect').value;

        // If test not selected, show generic step code
        if (!testName) {
            let code = `// ${recordedSteps.length} steps recorded\n`;
            code += `// Please select a Test Spec to see full test code\n\n`;
            code += `// Recorded steps:\n`;
            recordedSteps.forEach((step, i) => {
                code += `// ${i + 1}. ${step.action.toUpperCase()}`;
                if (step.selector) code += ` → ${step.selector}`;
                if (step.value) code += ` = "${step.value}"`;
                code += `\n`;
            });
            codeDisplay.textContent = code;
            return;
        }

        const pageObject = currentProject.pages[pageName];
        const testSpec = currentProject.tests[testName];

        if (!pageObject) {
            codeDisplay.textContent = `// Error: Page object "${pageName}" not found`;
            return;
        }

        if (!testSpec) {
            codeDisplay.textContent = `// Error: Test spec "${testName}" not found`;
            return;
        }

        // Generate full test code
        const testCaseName = document.getElementById('recorderTestCase').value || 'Recorded Test';

        // Create a temporary test spec with recorded steps
        const tempTestSpec = JSON.parse(JSON.stringify(testSpec));

        // Find or create test case
        let targetCase = tempTestSpec.testCases.find(tc => tc.name === testCaseName);
        if (!targetCase && tempTestSpec.testCases.length > 0) {
            targetCase = tempTestSpec.testCases[0];
        }

        if (targetCase) {
            targetCase.steps = recordedSteps;
        } else {
            // Create a new test case if none exist
            tempTestSpec.testCases = [{
                name: testCaseName,
                steps: recordedSteps,
                createdAt: Date.now()
            }];
        }

        // Validate tool and language
        if (!currentProject.tool || !currentProject.language) {
            currentProject.tool = currentProject.tool || 'playwright';
            currentProject.language = currentProject.language || 'javascript';
        }

        // Collect all page objects for this test (handle both legacy and new format)
        const pageObjects = {};
        if (testSpec.pageNames && Array.isArray(testSpec.pageNames)) {
            // New format: multiple page objects
            testSpec.pageNames.forEach(pName => {
                const pObj = currentProject.pages[pName];
                if (pObj) {
                    pageObjects[pName] = pObj;
                }
            });
        } else if (testSpec.pageName) {
            // Legacy format: single page object
            const pObj = currentProject.pages[testSpec.pageName];
            if (pObj) {
                pageObjects[testSpec.pageName] = pObj;
            }
        }

        // If no page objects found from test spec, use the selected one
        if (Object.keys(pageObjects).length === 0 && pageObject) {
            pageObjects[pageName] = pageObject;
        }

        if (Object.keys(pageObjects).length === 0) {
            codeDisplay.textContent = `// Error: No page objects found for test "${testName}"\n// Please ensure the test has associated page objects`;
            return;
        }

        try {
            const generator = new CodeGenerator(currentProject.tool, currentProject.language);
            const code = generator.generateTestSpec(tempTestSpec, pageObjects);

            if (!code || code.trim() === '') {
                codeDisplay.textContent = '// Error generating code\n// Please check your project configuration';
            } else {
                codeDisplay.textContent = code;
            }
        } catch (err) {
            console.error('Error generating code:', err);
            codeDisplay.textContent = `// Error generating code: ${err.message}\n// Please check the console for details`;
        }
    }

    // Listen for recorded steps from content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'RECORDED_STEP') {
            const step = message.step;

            // Try to match step with existing Page Object elements
            if (currentProject) {
                const testName = document.getElementById('recorderTestSelect').value;
                const testSpec = currentProject.tests[testName];
                let matched = false;

                // 1. Check associated pages first (if any)
                if (testSpec && testSpec.pageNames && testSpec.pageNames.length > 0) {
                    for (const pageName of testSpec.pageNames) {
                        const page = currentProject.pages[pageName];
                        if (!page) continue;

                        for (const [elName, elData] of Object.entries(page.elements)) {
                            if (elData.selector === step.selector) {
                                step.pageName = pageName;
                                step.elementName = elName; // Use the PO's element name
                                matched = true;
                                console.log(`Matched step to ${pageName}.${elName}`);
                                break;
                            }
                        }
                        if (matched) break;
                    }
                }

                // 2. If not matched, check the currently selected page (if different)
                if (!matched) {
                    const currentPageName = document.getElementById('recorderPageSelect').value;
                    const page = currentProject.pages[currentPageName];
                    if (page) {
                        for (const [elName, elData] of Object.entries(page.elements)) {
                            if (elData.selector === step.selector) {
                                step.pageName = currentPageName;
                                step.elementName = elName;
                                matched = true;
                                console.log(`Matched step to ${currentPageName}.${elName}`);
                                break;
                            }
                        }
                    }
                }
            }

            // Missing Page Object Detection (URL based)
            if (currentProject && step.url) {
                // We don't have a selected page anymore, so we check against all pages in the project
                // or prioritize pages in the current test spec if possible.
                const testName = document.getElementById('recorderTestSelect').value;
                const testSpec = currentProject.tests[testName];

                // Find potential page matches
                let matchedPageName = null;

                // 1. Check associated pages first
                if (testSpec && testSpec.pageNames && testSpec.pageNames.length > 0) {
                    matchedPageName = testSpec.pageNames.find(pName => {
                        const p = currentProject.pages[pName];
                        return p && (step.url.includes(p.url) || p.url.includes(step.url));
                    });
                }

                // 2. If no associated page matches, check all pages
                if (!matchedPageName) {
                    matchedPageName = Object.keys(currentProject.pages).find(pName => {
                        const p = currentProject.pages[pName];
                        return step.url.includes(p.url) || p.url.includes(step.url);
                    });
                }

                if (!matchedPageName) {
                    // No page matches! Prompt to create.
                    console.warn('Step recorded on unknown URL:', step.url);

                    // Check if we already prompted recently to avoid spam
                    if (!window.lastMissingPagePrompt || Date.now() - window.lastMissingPagePrompt > 5000) {
                        window.lastMissingPagePrompt = Date.now();
                        // Optional: Prompt logic here (commented out to avoid blocking flow too much)
                    }
                }
            }

            // Add annotation if set
            const annotation = document.getElementById('stepAnnotation').value;
            if (annotation) {
                step.annotations = annotation.split(',').map(a => a.trim());
            }

            // Add assertion if set
            const assertionType = document.getElementById('stepAssertion').value;
            if (assertionType) {
                step.assertions = [{ type: assertionType }];
            }

            recordedSteps.push(step);
            addStepToList(step);

            // Auto-populate Page Object with elements from recorded steps
            autoPopulatePageObject(step);

            generateCode();
        }
    });

    // Helper function to check if selector is used in other page objects
    function isSelectorUsedInOtherPages(selector, currentPageName) {
        for (const [pageName, pageObj] of Object.entries(currentProject.pages)) {
            if (pageName === currentPageName) continue;
            for (const [elemName, elem] of Object.entries(pageObj.elements || {})) {
                if (elem.selector === selector) {
                    return { pageName, elementName: elemName };
                }
            }
        }
        return null;
    }

    // Auto-populate Page Object with elements from recorded steps
    async function autoPopulatePageObject(step) {
        if (!currentProject) return;

        // Infer page object from step metadata (set during recording)
        // or try to find it in the current test spec
        let pageName = step.pageName;

        if (!pageName) {
            const testName = document.getElementById('recorderTestSelect').value;
            const testSpec = currentProject.tests[testName];

            if (testSpec && testSpec.pageNames && testSpec.pageNames.length > 0) {
                // Try to match URL to one of the associated pages
                pageName = testSpec.pageNames.find(pName => {
                    const p = currentProject.pages[pName];
                    return p && (step.url.includes(p.url) || p.url.includes(step.url));
                });

                // Fallback to first associated page if no URL match (risky but better than nothing?)
                // Or maybe just don't auto-populate if we can't be sure.
                // Let's stick to URL matching for safety.
            }
        }

        if (!pageName) return;

        const pageObject = currentProject.pages[pageName];
        if (!pageObject) return;

        // Only add elements for actions that interact with elements
        if (!step.selector || !step.elementName) return;

        // Check if element already exists in current page
        if (pageObject.elements[step.elementName]) return;

        // Check if selector is used in other page objects
        const duplicateInfo = isSelectorUsedInOtherPages(step.selector, pageName);
        if (duplicateInfo) {
            console.warn(`⚠️ Selector "${step.selector}" is already used in page "${duplicateInfo.pageName}" as "${duplicateInfo.elementName}". Skipping auto-add to avoid duplication.`);
            return;
        }

        // Determine element type from action
        let elementType = 'button';
        if (step.action === 'fill') {
            elementType = 'input';
        } else if (step.action === 'select') {
            elementType = 'select';
        } else if (step.action === 'click') {
            // Try to guess from selector
            if (step.selector.includes('input') || step.selector.includes('textarea')) {
                elementType = 'input';
            } else if (step.selector.includes('select')) {
                elementType = 'select';
            } else if (step.selector.includes('a') || step.selector.includes('link')) {
                elementType = 'link';
            }
        }

        // Add element to page object
        pageObject.elements[step.elementName] = {
            selector: step.selector,
            type: elementType
        };

        console.log(`✅ Auto-added element to ${pageName}:`, step.elementName, step.selector);

        // Update project
        try {
            await projectManager.updateProject(currentProject.id, currentProject);
            // Refresh the UI
            await loadCurrentProject();
        } catch (err) {
            console.error('Error updating page object:', err);
        }
    }

    // Listen for replay progress
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'REPLAY_PROGRESS') {
            const { stepIndex, status, error } = message;
            const stepsList = document.getElementById('stepsList');
            const stepItems = stepsList.querySelectorAll('.step-item');

            if (stepItems[stepIndex]) {
                const item = stepItems[stepIndex];
                item.classList.remove('step-running', 'step-success', 'step-failed');

                if (status === 'running') {
                    item.classList.add('step-running');
                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else if (status === 'success') {
                    item.classList.add('step-success');
                } else if (status === 'failed') {
                    item.classList.add('step-failed');
                    item.title = error || 'Step failed';
                }
            }
        } else if (message.type === 'REPLAY_COMPLETE') {
            resetReplayButtons();
        }
    });

    function addStepToList(step, index) {
        const stepsList = document.getElementById('stepsList');
        const li = document.createElement('li');
        li.className = 'step-item';
        li.dataset.index = index !== undefined ? index : recordedSteps.length - 1;

        // Add icon based on action
        const icon = step.action === 'click' ? '🖱️' :
            step.action === 'fill' ? '⌨️' :
                step.action === 'select' ? '📋' :
                    step.action === 'screenshot' ? '📷' : '▶️';

        // Format step text
        let stepText = `${icon} ${step.action.toUpperCase()}`;
        if (step.elementName) {
            stepText += ` → ${step.elementName}`;
        }
        if (step.value) {
            stepText += ` = "${step.value}"`;
        }

        li.innerHTML = `
            <div class="step-content">
                <span class="step-text">${stepText}</span>
                <span class="step-selector">${step.selector}</span>
            </div>
            <button class="step-delete-btn" title="Delete Step">×</button>
        `;

        // Add delete handler
        li.querySelector('.step-delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteStep(parseInt(li.dataset.index));
        });

        stepsList.appendChild(li);

        // Auto-scroll to bottom
        stepsList.scrollTop = stepsList.scrollHeight;

        // Generate code preview
        generateCode();
    }

    function deleteStep(index) {
        recordedSteps.splice(index, 1);
        // Re-render list
        const stepsList = document.getElementById('stepsList');
        stepsList.innerHTML = '';
        recordedSteps.forEach((step, i) => addStepToList(step, i));
        generateCode();
    }

    // Modal helpers - make globally accessible
    window.openModal = function (modal) {
        if (modal) modal.classList.add('active');
    };

    window.closeModal = function (modal) {
        if (modal) modal.classList.remove('active');
    };

    // Global functions for list item actions
    window.viewPageObject = async (name) => {
        console.log('viewPageObject called with:', name);

        if (!currentProject) {
            alert('No project selected!');
            return;
        }

        if (!currentProject.pages[name]) {
            alert(`Page Object "${name}" not found!`);
            console.error('Available pages:', Object.keys(currentProject.pages));
            return;
        }

        try {
            const pageObject = currentProject.pages[name];
            console.log('Page Object:', pageObject);

            // Validate tool and language
            if (!currentProject.tool || !currentProject.language) {
                console.warn('Project tool or language missing in viewPageObject, defaulting...');
                currentProject.tool = currentProject.tool || 'playwright';
                currentProject.language = currentProject.language || 'javascript';
                alert('Warning: Project configuration missing. Defaulting to Playwright/JavaScript.');
            }

            const generator = new CodeGenerator(currentProject.tool, currentProject.language);
            const code = generator.generatePageObject(pageObject);

            console.log('Generated code:', code);

            if (!code || code.trim() === '') {
                alert('No code generated. The page object might be empty.');
                return;
            }

            showCodeViewer(`Page Object: ${name}`, code);
        } catch (err) {
            console.error('Error in viewPageObject:', err);
            alert('Error generating code: ' + err.message);
        }
    };

    window.deletePageObject = async (name) => {
        if (confirm(`Delete page object "${name}"?`)) {
            delete currentProject.pages[name];
            await projectManager.updateProject(currentProject.id, currentProject);
            await loadCurrentProject();
        }
    };

    window.viewTest = async (name) => {
        console.log('viewTest called with:', name);

        if (!currentProject) {
            alert('No project selected!');
            return;
        }

        if (!currentProject.tests[name]) {
            alert(`Test "${name}" not found!`);
            console.error('Available tests:', Object.keys(currentProject.tests));
            return;
        }

        try {
            const testSpec = currentProject.tests[name];
            const pageObjects = {};

            // Collect all associated page objects
            if (testSpec.pageNames && Array.isArray(testSpec.pageNames)) {
                testSpec.pageNames.forEach(pName => {
                    if (currentProject.pages[pName]) {
                        pageObjects[pName] = currentProject.pages[pName];
                    }
                });
            } else if (testSpec.pageName) {
                // Legacy support
                if (currentProject.pages[testSpec.pageName]) {
                    pageObjects[testSpec.pageName] = currentProject.pages[testSpec.pageName];
                }
            }

            console.log('Test Spec:', testSpec);
            console.log('Page Objects:', pageObjects);

            if (Object.keys(pageObjects).length === 0) {
                alert(`No associated Page Objects found for "${name}"!`);
                return;
            }

            // Validate tool and language
            if (!currentProject.tool || !currentProject.language) {
                console.warn('Project tool or language missing in viewTest, defaulting...');
                currentProject.tool = currentProject.tool || 'playwright';
                currentProject.language = currentProject.language || 'javascript';
                alert('Warning: Project configuration missing. Defaulting to Playwright/JavaScript.');
            }

            const generator = new CodeGenerator(currentProject.tool, currentProject.language);
            const code = generator.generateTestSpec(testSpec, pageObjects);

            console.log('Generated code:', code);

            if (!code || code.trim() === '') {
                alert('No code generated. The test might be empty.');
                return;
            }

            showCodeViewer(`Test Suite: ${name}`, code);
        } catch (err) {
            console.error('Error in viewTest:', err);
            alert('Error generating code: ' + err.message);
        }
    };

    window.deleteTest = async (name) => {
        if (confirm(`Delete test suite "${name}" and all its test cases?`)) {
            delete currentProject.tests[name];
            await projectManager.updateProject(currentProject.id, currentProject);
            await loadCurrentProject();
        }
    };

    window.viewTestCase = async (testName, caseIndex) => {
        console.log('viewTestCase called with:', testName, caseIndex);

        if (!currentProject) {
            alert('No project selected!');
            return;
        }

        if (!currentProject.tests[testName]) {
            alert(`Test "${testName}" not found!`);
            return;
        }

        try {
            const testSpec = currentProject.tests[testName];
            const testCase = testSpec.testCases[caseIndex];

            console.log('Test Case:', testCase);

            if (!testCase) {
                alert('Test case not found!');
                return;
            }

            // Collect all page objects for this test (handle both legacy and new format)
            const pageObjects = {};
            if (testSpec.pageNames && Array.isArray(testSpec.pageNames)) {
                // New format: multiple page objects
                testSpec.pageNames.forEach(pName => {
                    const pObj = currentProject.pages[pName];
                    if (pObj) {
                        pageObjects[pName] = pObj;
                    } else {
                        console.warn(`Page object "${pName}" not found for test: ${testName}`);
                    }
                });
            } else if (testSpec.pageName) {
                // Legacy format: single page object
                const pObj = currentProject.pages[testSpec.pageName];
                if (pObj) {
                    pageObjects[testSpec.pageName] = pObj;
                } else {
                    console.warn(`Page object "${testSpec.pageName}" not found for test: ${testName}`);
                }
            }

            if (Object.keys(pageObjects).length === 0) {
                // Try to use the pageName from the test case itself if available (future proofing)
                // Or fallback to checking if there's at least one page object in the project
                alert(`No page objects found for test "${testName}"!\\n\\nPlease ensure the test has associated page objects.`);
                return;
            }

            // Create a temporary test spec with only this test case
            const tempTestSpec = {
                ...testSpec,
                testCases: [testCase]
            };

            // Validate tool and language
            if (!currentProject.tool || !currentProject.language) {
                console.warn('Project tool or language missing in viewTestCase, defaulting...');
                currentProject.tool = currentProject.tool || 'playwright';
                currentProject.language = currentProject.language || 'javascript';
                alert('Warning: Project configuration missing. Defaulting to Playwright/JavaScript.');
            }

            const generator = new CodeGenerator(currentProject.tool, currentProject.language);
            const code = generator.generateTestSpec(tempTestSpec, pageObjects);

            console.log('Generated code:', code);

            if (!code || code.trim() === '') {
                alert('No code generated. The test case might be empty.');
                return;
            }

            showCodeViewer(`Test Case: ${testCase.name}`, code);
        } catch (err) {
            console.error('Error in viewTestCase:', err);
            alert('Error generating code: ' + err.message);
        }
    };

    window.deleteTestCase = async (testName, caseIndex) => {
        if (!currentProject || !currentProject.tests[testName]) return;

        const testSpec = currentProject.tests[testName];
        const testCase = testSpec.testCases[caseIndex];

        if (!testCase) return;

        if (confirm(`Delete test case "${testCase.name}"?`)) {
            testSpec.testCases.splice(caseIndex, 1);
            await projectManager.updateProject(currentProject.id, currentProject);
            await loadCurrentProject();
        }
    };

    window.runTestCase = async (testName, caseName) => {
        console.log('runTestCase called with:', testName, caseName);

        if (!currentProject) {
            alert('No project selected!');
            return;
        }

        if (!currentProject.tests[testName]) {
            alert(`Test "${testName}" not found!`);
            return;
        }

        try {
            const testSpec = currentProject.tests[testName];
            const testCase = testSpec.testCases.find(tc => tc.name === caseName);

            console.log('Test Case to run:', testCase);

            if (!testCase || !testCase.steps || testCase.steps.length === 0) {
                alert('No steps found in this test case. Please record some steps first.');
                return;
            }

            // Switch to recorder tab to show progress
            document.querySelector('[data-tab="recorder"]').click();

            // Populate steps list
            recordedSteps = testCase.steps;
            document.getElementById('stepsList').innerHTML = '';
            recordedSteps.forEach((step, i) => addStepToList(step, i));

            // Start replay
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    alert('No active tab found. Please open a webpage first.');
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'REPLAY_STEPS',
                    steps: recordedSteps
                }).catch(err => {
                    console.error('Replay failed:', err);
                    alert('Failed to start replay. Please refresh the page and try again.');
                });
            });
        } catch (err) {
            console.error('Error in runTestCase:', err);
            alert('Error running test case: ' + err.message);
        }
    };

    // Make showCodeViewer globally accessible
    window.showCodeViewer = function (title, code) {
        const modal = document.getElementById('codeViewerModal');
        if (!modal) {
            console.error('Code viewer modal not found');
            return;
        }

        const titleEl = document.getElementById('codeViewerTitle');
        const contentEl = document.getElementById('codeViewerContent');

        if (titleEl) titleEl.textContent = title;
        if (contentEl) contentEl.textContent = code;

        openModal(modal);
    };

    // Copy code button
    const copyViewerBtn = document.getElementById('copyViewerCodeBtn');
    if (copyViewerBtn) {
        copyViewerBtn.addEventListener('click', () => {
            const code = document.getElementById('codeViewerContent').textContent;
            navigator.clipboard.writeText(code);
            alert('Code copied to clipboard!');
        });
    }


    // Initialize
    loadProjects();
    loadCurrentProject();
});
