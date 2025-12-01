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
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
        <div class="list-item-header">
          <span class="list-item-title">${page.name}</span>
          <div class="list-item-actions">
            <button class="btn btn-secondary view-page-btn" data-page-name="${page.name}">View Code</button>
            <button class="btn btn-danger delete-page-btn" data-page-name="${page.name}">Delete</button>
          </div>
        </div>
        <div class="list-item-meta">
          ${Object.keys(page.elements).length} elements • ${page.methods.length} methods
        </div>
      `;
            list.appendChild(item);
        });
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
        document.getElementById('addPageObjectBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            openModal(newPageObjectModal);
        });

        document.getElementById('createPageObjectBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            openModal(newPageObjectModal);
        });

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
                    // Send message to content script to detect elements
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs.length === 0) return;
                        chrome.tabs.sendMessage(tabs[0].id, { type: 'DETECT_ELEMENTS' }, (response) => {
                            if (response && response.elements) {
                                response.elements.forEach(el => {
                                    pageObject.addElement(el.name, el.selector, el.type);
                                });
                            }
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
            if (e.target.classList.contains('view-page-btn')) {
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
            alert('Please select page object, test spec, and enter test case name');
            return;
        }

        // Clear previous session
        chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' }, () => {
            isRecording = true;
            recordedSteps = [];
            document.getElementById('stepsList').innerHTML = ''; // Clear previous steps on new recording

            setRecordingUI(true);

            // Send message to content script to start recording
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length === 0) {
                    alert('No active tab found');
                    setRecordingUI(false);
                    return;
                }

                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'START_RECORDING',
                    pageName,
                    testName,
                    testCaseName
                }).catch(err => {
                    console.error('Failed to start recording:', err);
                    alert('Please refresh the page and try again.');
                    setRecordingUI(false);
                });
            });
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

        // Generate code preview
        generateCode();
    }

    async function saveGeneratedCode() {
        console.log('saveGeneratedCode called');

        if (!currentProject) {
            alert('No project selected! Please create or select a project first.');
            return;
        }

        if (recordedSteps.length === 0) {
            alert('No steps recorded! Please record some steps first.');
            return;
        }

        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;
        const testCaseName = document.getElementById('recorderTestCase').value.trim();

        // Validation
        if (!pageName) {
            alert('Please select a Page Object');
            document.getElementById('recorderPageSelect').focus();
            return;
        }

        if (!testName) {
            alert('Please select a Test Suite');
            document.getElementById('recorderTestSelect').focus();
            return;
        }

        if (!testCaseName) {
            alert('Please enter a Test Case name');
            document.getElementById('recorderTestCase').focus();
            return;
        }

        try {
            console.log('Saving steps to:', { testName, testCaseName, stepCount: recordedSteps.length });

            // Get the test spec
            const testSpec = currentProject.tests[testName];
            if (!testSpec) {
                alert(`Test suite "${testName}" not found!`);
                return;
            }

            // Check if test case already exists
            const existingCaseIndex = testSpec.testCases.findIndex(tc => tc.name === testCaseName);

            if (existingCaseIndex >= 0) {
                // Update existing test case
                if (confirm(`Test case "${testCaseName}" already exists. Replace it with new steps?`)) {
                    testSpec.testCases[existingCaseIndex].steps = [...recordedSteps];
                    testSpec.testCases[existingCaseIndex].updatedAt = Date.now();
                } else {
                    return;
                }
            } else {
                // Add new test case
                testSpec.addTestCase(testCaseName, [...recordedSteps]);
            }

            // Update the project
            await projectManager.updateProject(currentProject.id, currentProject);

            // Reload current project
            await loadCurrentProject();

            alert(`✅ Success! ${recordedSteps.length} steps saved to test case "${testCaseName}".\n\nYou can now:\n• View the code in the Tests tab\n• Run the test case\n• Export the complete project`);

            // Clear steps after saving
            clearSteps();
        } catch (err) {
            console.error('Failed to save code:', err);
            alert('Failed to save code: ' + err.message);
        }
    }

    function clearSteps() {
        recordedSteps = [];
        document.getElementById('stepsList').innerHTML = '';
        document.getElementById('generatedCode').textContent = '// Select Page Object and Test Suite above, then start recording...';
        updateStepCount();
    }

    function updateStepCount() {
        const countEl = document.getElementById('stepCount');
        if (countEl) {
            countEl.textContent = recordedSteps.length;
        }
    }

    function generateCode() {
        if (!currentProject || recordedSteps.length === 0) {
            return;
        }

        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;
        const testCaseName = document.getElementById('recorderTestCase').value.trim();

        const pageObject = currentProject.pages[pageName];
        const testSpec = currentProject.tests[testName];

        if (!pageObject || !testSpec) {
            document.getElementById('generatedCode').textContent = '// Please select both Page Object and Test Suite';
            return;
        }

        // Create a temporary test spec with the recorded steps
        const tempTestSpec = JSON.parse(JSON.stringify(testSpec));

        // Find or create the test case
        let targetCase = tempTestSpec.testCases.find(tc => tc.name === testCaseName);
        if (!targetCase) {
            targetCase = {
                name: testCaseName || 'Recorded Test',
                steps: recordedSteps,
                createdAt: Date.now()
            };
            tempTestSpec.testCases = [targetCase];
        } else {
            targetCase.steps = recordedSteps;
        }

        // Generate code using the project's tool and language
        const generator = new CodeGenerator(currentProject.tool, currentProject.language);
        const code = generator.generateTestSpec(tempTestSpec, pageObject);

        document.getElementById('generatedCode').textContent = code || '// No code generated';
        console.log(`Generated code for ${currentProject.tool}/${currentProject.language}:`, code ? 'Success' : 'Failed');
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
            updateStepCount();
            generateCode();
        }
    });

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
