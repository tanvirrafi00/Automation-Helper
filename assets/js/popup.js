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
    setupEventListeners();

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
            <button class="btn btn-secondary" onclick="viewPageObject('${page.name}')">View</button>
            <button class="btn btn-danger" onclick="deletePageObject('${page.name}')">Delete</button>
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
            item.className = 'list-item';
            item.innerHTML = `
        <div class="list-item-header">
          <span class="list-item-title">${test.name}</span>
          <div class="list-item-actions">
            <button class="btn btn-secondary" onclick="viewTest('${test.name}')">View</button>
            <button class="btn btn-danger" onclick="deleteTest('${test.name}')">Delete</button>
          </div>
        </div>
        <div class="list-item-meta">
          Page: ${test.pageName} • ${test.testCases.length} test cases
        </div>
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
                await projectManager.setCurrentProject(e.target.value);
                await loadCurrentProject();
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

            const project = await projectManager.createProject(name, tool, language, template);
            closeModal(newProjectModal);
            await loadProjects();
            await loadCurrentProject();
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

            const pageObject = new PageObject(name, url, currentProject.tool, currentProject.language);

            if (autoDetect) {
                // Send message to content script to detect elements
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
        });

        // Add test button
        document.getElementById('addTestBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }

            // Populate page object select
            const select = document.getElementById('testPageObject');
            select.innerHTML = '<option value="">Select Page Object</option>';
            Object.keys(currentProject.pages).forEach(pageName => {
                const option = document.createElement('option');
                option.value = pageName;
                option.textContent = pageName;
                select.appendChild(option);
            });

            openModal(newTestModal);
        });

        document.getElementById('createTestBtn').addEventListener('click', () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }

            // Populate page object select
            const select = document.getElementById('testPageObject');
            select.innerHTML = '<option value="">Select Page Object</option>';
            Object.keys(currentProject.pages).forEach(pageName => {
                const option = document.createElement('option');
                option.value = pageName;
                option.textContent = pageName;
                select.appendChild(option);
            });

            openModal(newTestModal);
        });

        // Create test spec
        document.getElementById('createTestSpecBtn').addEventListener('click', async () => {
            const name = document.getElementById('testName').value;
            const pageName = document.getElementById('testPageObject').value;
            const testCaseName = document.getElementById('testCaseName').value;
            const isDataDriven = document.getElementById('isDataDriven').checked;

            if (!name || !pageName) {
                alert('Please fill in all required fields');
                return;
            }

            const testSpec = new TestSpec(name, pageName, currentProject.tool, currentProject.language);

            if (testCaseName) {
                const data = isDataDriven ? [{ username: 'test', password: '123' }] : null;
                testSpec.addTestCase(testCaseName, [], data);
            }

            await projectManager.addTestSpec(currentProject.id, testSpec);
            closeModal(newTestModal);
            await loadCurrentProject();
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
            await projectManager.downloadProjectAsZip(currentProject.id);
        });

        document.getElementById('downloadProjectBtn').addEventListener('click', async () => {
            if (!currentProject) {
                alert('Please select a project first');
                return;
            }
            await projectManager.downloadProject(currentProject.id);
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
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'REPLAY_STEPS',
                    steps: recordedSteps
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
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'CAPTURE_SCREENSHOT' }, (response) => {
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

        isRecording = true;
        recordedSteps = [];
        document.getElementById('stepsList').innerHTML = ''; // Clear previous steps on new recording

        document.getElementById('startRecBtn').disabled = true;
        document.getElementById('stopRecBtn').disabled = false;
        document.getElementById('recordingStatus').textContent = 'Recording...';
        document.getElementById('recordingStatus').style.color = '#ef4444';

        // Send message to content script to start recording
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'START_RECORDING',
                pageName,
                testName,
                testCaseName
            });
        });
    }

    function stopRecording() {
        isRecording = false;

        document.getElementById('startRecBtn').disabled = false;
        document.getElementById('stopRecBtn').disabled = true;
        document.getElementById('recordingStatus').textContent = 'Stopped';
        document.getElementById('recordingStatus').style.color = '#10b981';

        // Send message to content script to stop recording
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'STOP_RECORDING' });
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
        if (!currentProject || recordedSteps.length === 0) {
            alert('No steps to save');
            return;
        }

        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;
        const testCaseName = document.getElementById('recorderTestCase').value;

        if (!pageName || !testName || !testCaseName) {
            alert('Please ensure page object and test spec are selected');
            return;
        }

        // Add recorded steps to the test case
        const testSpec = currentProject.tests[testName];
        const existingCase = testSpec.testCases.find(tc => tc.name === testCaseName);

        if (existingCase) {
            existingCase.steps = recordedSteps;
        } else {
            testSpec.addTestCase(testCaseName, recordedSteps);
        }

        // Update the test spec in project
        await projectManager.updateTestSpec(currentProject.id, testName, testSpec);

        // Reload current project
        await loadCurrentProject();

        alert('Code saved successfully! Go to Export tab to download your project.');

        // Hide generate button
        const generateBtn = document.getElementById('generateCodeBtn');
        if (generateBtn) {
            generateBtn.style.display = 'none';
        }
    }

    function clearSteps() {
        recordedSteps = [];
        document.getElementById('stepsList').innerHTML = '';
        document.getElementById('generatedCode').textContent = '// Code will appear here...';
    }

    function generateCode() {
        if (!currentProject || recordedSteps.length === 0) {
            return;
        }

        const pageName = document.getElementById('recorderPageSelect').value;
        const testName = document.getElementById('recorderTestSelect').value;

        const pageObject = currentProject.pages[pageName];
        const testSpec = currentProject.tests[testName];

        if (!pageObject || !testSpec) return;

        // Temporarily add recorded steps to test case for generation
        // In a real app, we'd find the specific test case
        const tempTestSpec = JSON.parse(JSON.stringify(testSpec));
        if (tempTestSpec.testCases.length > 0) {
            tempTestSpec.testCases[0].steps = recordedSteps;
        }

        const generator = new CodeGenerator(currentProject.tool, currentProject.language);
        const code = generator.generateTestSpec(tempTestSpec, pageObject);

        document.getElementById('generatedCode').textContent = code;
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

    // Modal helpers
    function openModal(modal) {
        modal.classList.add('active');
    }

    function closeModal(modal) {
        modal.classList.remove('active');
    }

    // Global functions for list item actions
    window.viewPageObject = async (name) => {
        alert(`Viewing ${name} - Full editor coming soon!`);
    };

    window.deletePageObject = async (name) => {
        if (confirm(`Delete page object "${name}"?`)) {
            delete currentProject.pages[name];
            await projectManager.updateProject(currentProject.id, currentProject);
            await loadCurrentProject();
        }
    };

    window.viewTest = async (name) => {
        alert(`Viewing ${name} - Full editor coming soon!`);
    };

    window.deleteTest = async (name) => {
        if (confirm(`Delete test "${name}"?`)) {
            delete currentProject.tests[name];
            await projectManager.updateProject(currentProject.id, currentProject);
            await loadCurrentProject();
        }
    };
});
