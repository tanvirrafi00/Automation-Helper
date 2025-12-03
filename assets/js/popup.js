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
                if (session.pageName) document.getElementById('recorderPageSelect').value = session.pageName;
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
                            pageObject.addElement(el.name, el.selector, el.type);
                            addedCount++;
                        }
                    });

                    if (addedCount > 0) {
                        await projectManager.updateProject(currentProject.id, currentProject);
                        await loadCurrentProject();
                        alert(`✅ Successfully added ${addedCount} elements to ${pageName}!`);
                    } else {
                        alert('⚠️ No new elements found on this page.');
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
          Page Object: ${test.pageName} • Tool: ${test.tool} • Language: ${test.language}
        </div>
        ${casesHtml}
      `;
            list.appendChild(item);
        });
    }

    // Update recorder selects
    function updateRecorderSelects() {
        const pageSelect = document.getElementById('recorderPageSelect');
        const testSelect = document.getElementById('recorderTestSelect');

        pageSelect.innerHTML = '<option value="">Select Page Object</option>';
        testSelect.innerHTML = '<option value="">Select Test Spec</option>';

        if (!currentProject) return;

        Object.keys(currentProject.pages).forEach(pageName => {
            const option = document.createElement('option');
            option.value = pageName;
            option.textContent = pageName;
            pageSelect.appendChild(option);
        });

        Object.keys(currentProject.tests).forEach(testName => {
            const option = document.createElement('option');
            option.value = testName;
            option.textContent = testName;
            testSelect.appendChild(option);
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

        // Create page object
        // Create page object
        document.getElementById('createPageBtn').addEventListener('click', async () => {
            const name = document.getElementById('pageName').value;
            const url = document.getElementById('pageUrl').value;
            const autoDetect = document.getElementById('autoDetectElements').checked;

            if (!name) {
                alert('Please enter a page name');
                return;
            }

            try {
                const pageObject = new PageObject(name, url, currentProject.tool, currentProject.language);

                if (autoDetect) {
                    // Wait for element detection
                    await new Promise((resolve) => {
                        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                            if (tabs.length === 0) {
                                resolve();
                                return;
                            }

                            // Check if we can inject script first (in case it's not loaded)
                            // We'll try to send message, if it fails, we assume script isn't there
                            chrome.tabs.sendMessage(tabs[0].id, { type: 'DETECT_ELEMENTS' }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.log('Content script not ready for detection, skipping auto-detect');
                                    resolve();
                                    return;
                                }

                                if (response && response.elements) {
                                    console.log('Detected elements:', response.elements.length);
                                    response.elements.forEach(el => {
                                        pageObject.addElement(el.name, el.selector, el.type);
                                    });
                                }
                                resolve();
                            });
                        });
                    });
                }

                await projectManager.addPageObject(currentProject.id, pageObject);
                closeModal(newPageObjectModal);
                await loadCurrentProject();
                alert('Page object created successfully!');
            } catch (err) {
                console.error('Failed to create page object:', err);
                alert('Failed to create page object. Please try again.');
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
            // Populate page object select
            const pageSelect = document.getElementById('testPageObject');
            pageSelect.innerHTML = '<option value="">Select Page Object</option>';
            Object.keys(currentProject.pages).forEach(pageName => {
                const option = document.createElement('option');
                option.value = pageName;
                option.textContent = pageName;
                pageSelect.appendChild(option);
            });

            // Populate existing test suites select
            const suiteSelect = document.getElementById('existingTestSuite');
            suiteSelect.innerHTML = '<option value="">Select Suite</option>';
            Object.keys(currentProject.tests).forEach(testName => {
                const option = document.createElement('option');
                option.value = testName;
                option.textContent = testName;
                suiteSelect.appendChild(option);
            });
        }

        // Create test spec or add to existing
        document.getElementById('createTestSpecBtn').addEventListener('click', async () => {
            const action = document.getElementById('testAction').value;
            const testCaseName = document.getElementById('testCaseName').value;
            const isDataDriven = document.getElementById('isDataDriven').checked;

            if (!testCaseName) {
                alert('Please enter a test case name');
                return;
            }

            try {
                if (action === 'new') {
                    // Create new test suite
                    const name = document.getElementById('testName').value;
                    const pageName = document.getElementById('testPageObject').value;

                    if (!name || !pageName) {
                        alert('Please fill in all required fields');
                        return;
                    }

                    const testSpec = new TestSpec(name, pageName, currentProject.tool, currentProject.language);
                    const data = isDataDriven ? [{ username: 'test', password: '123' }] : null;
                    testSpec.addTestCase(testCaseName, [], data);

                    await projectManager.addTestSpec(currentProject.id, testSpec);
                    alert('Test suite created successfully!');
                } else {
                    // Add to existing suite
                    const suiteName = document.getElementById('existingTestSuite').value;

                    if (!suiteName) {
                        alert('Please select a test suite');
                        return;
                    }

                    const testSpec = currentProject.tests[suiteName];
                    if (!testSpec) {
                        alert('Test suite not found!');
                        return;
                    }

                    const data = isDataDriven ? [{ username: 'test', password: '123' }] : null;
                    testSpec.addTestCase(testCaseName, [], data);

                    await projectManager.updateProject(currentProject.id, currentProject);
                    alert('Test case added successfully!');
                }

                closeModal(newTestModal);
                await loadCurrentProject();
            } catch (err) {
                console.error('Failed to create/update test:', err);
                alert('Failed to create/update test. Please try again.');
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

            // Send steps to content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    alert('No active tab found');
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'REPLAY_STEPS',
                    steps: recordedSteps
                }).catch(err => {
                    console.error('Replay failed:', err);
                    alert('Failed to start replay. Please refresh the page.');
                });
            });
        });

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
        const testCaseName = document.getElementById('recorderTestCase').value;

        if (!pageName || !testName || !testCaseName) {
            alert('Please select Page Object, Test Spec, and enter a Test Case name before recording.');
            return;
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
        console.log('saveGeneratedCode called');
        console.log('Recorded steps:', recordedSteps.length);

        if (!currentProject) {
            alert('Please create or select a project first!');
            return;
        }

        if (recordedSteps.length === 0) {
            alert('No steps recorded! Please record some steps first.');
            return;
        }

        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;
        const testCaseName = document.getElementById('recorderTestCase').value;

        console.log('Page:', pageName, 'Test:', testName, 'Case:', testCaseName);

        if (!pageName) {
            alert('Please select a Page Object from the dropdown!');
            return;
        }

        if (!testName) {
            alert('Please select a Test Spec from the dropdown!');
            return;
        }

        if (!testCaseName || testCaseName.trim() === '') {
            alert('Please enter a Test Case name!');
            return;
        }

        try {
            // Get the test spec
            const testSpec = currentProject.tests[testName];
            if (!testSpec) {
                alert(`Test Spec "${testName}" not found!`);
                return;
            }

            // Ensure testCases array exists
            if (!testSpec.testCases) {
                testSpec.testCases = [];
            }

            console.log('Test Spec before update:', JSON.stringify(testSpec, null, 2));

            // Find existing test case or add new one
            const existingCaseIndex = testSpec.testCases.findIndex(tc => tc.name === testCaseName);

            if (existingCaseIndex !== -1) {
                // Update existing test case
                testSpec.testCases[existingCaseIndex] = {
                    ...testSpec.testCases[existingCaseIndex],
                    steps: recordedSteps,
                    updatedAt: Date.now()
                };
                console.log('Updated existing test case:', testCaseName);
            } else {
                // Add new test case
                testSpec.testCases.push({
                    name: testCaseName,
                    steps: recordedSteps,
                    data: null,
                    createdAt: Date.now()
                });
                console.log('Added new test case:', testCaseName);
            }

            // Update ONLY the test spec using projectManager
            // This is safer than updating the whole project
            await projectManager.updateTestSpec(currentProject.id, testName, {
                testCases: testSpec.testCases
            });

            console.log('Test Spec updated successfully');

            // Reload current project to get fresh state
            await loadCurrentProject();

            alert(`✅ Success! Test case "${testCaseName}" saved with ${recordedSteps.length} steps.\n\nYou can now:\n• View the code in the Tests tab\n• Export your project\n• Run the test`);

            // Hide generate button
            const generateBtn = document.getElementById('generateCodeBtn');
            if (generateBtn) {
                generateBtn.style.display = 'none';
            }

            // Clear the recorder for next test
            // Uncomment if you want to auto-clear after saving:
            // clearSteps();
        } catch (err) {
            console.error('Error saving code:', err);
            alert(`Failed to save test case: ${err.message}\n\nPlease check the console for details.`);
        }
    }

    function clearSteps() {
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

        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;

        // If page/test not selected, show generic step code
        if (!pageName || !testName) {
            let code = `// ${recordedSteps.length} steps recorded\n`;
            code += `// Please select Page Object and Test Spec to see full test code\n\n`;
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
            codeDisplay.textContent = `// Error: Page Object "${pageName}" not found\n// Please select a valid Page Object`;
            return;
        }

        if (!testSpec) {
            codeDisplay.textContent = `// Error: Test Spec "${testName}" not found\n// Please select a valid Test Spec`;
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

        const generator = new CodeGenerator(currentProject.tool, currentProject.language);
        const code = generator.generateTestSpec(tempTestSpec, pageObject);

        if (!code || code.trim() === '') {
            codeDisplay.textContent = '// Error generating code\n// Please check your project configuration';
        } else {
            codeDisplay.textContent = code;
        }
    }

    // Listen for recorded steps from content script
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'RECORDED_STEP') {
            const step = message.step;

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

    // Auto-populate Page Object with elements from recorded steps
    async function autoPopulatePageObject(step) {
        if (!currentProject) return;

        const pageName = document.getElementById('recorderPageSelect').value;
        if (!pageName) return;

        const pageObject = currentProject.pages[pageName];
        if (!pageObject) return;

        // Only add elements for actions that interact with elements
        if (!step.selector || !step.elementName) return;

        // Check if element already exists
        if (pageObject.elements[step.elementName]) return;

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
            const pageObject = currentProject.pages[testSpec.pageName];

            console.log('Test Spec:', testSpec);
            console.log('Page Object:', pageObject);

            if (!pageObject) {
                alert(`Associated Page Object "${testSpec.pageName}" not found!`);
                return;
            }

            const generator = new CodeGenerator(currentProject.tool, currentProject.language);
            const code = generator.generateTestSpec(testSpec, pageObject);

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

            const pageObject = currentProject.pages[testSpec.pageName];
            if (!pageObject) {
                alert(`Associated Page Object "${testSpec.pageName}" not found!`);
                return;
            }

            // Create a temporary test spec with only this test case
            const tempTestSpec = {
                ...testSpec,
                testCases: [testCase]
            };

            const generator = new CodeGenerator(currentProject.tool, currentProject.language);
            const code = generator.generateTestSpec(tempTestSpec, pageObject);

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
});
