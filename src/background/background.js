// Background service worker for Automation Framework Manager

let isRecording = false;
let currentSession = null;

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'RECORDED_STEP') {
        // Forward recorded step to popup
        chrome.runtime.sendMessage(message).catch(() => {
            // Popup might be closed, store in session
            if (!currentSession) {
                currentSession = {
                    steps: [],
                    pageName: message.pageName,
                    testName: message.testName,
                    testCase: message.testCase
                };
            }
            currentSession.steps.push(message.step);
        });
        sendResponse({ status: 'recorded' });
    } else if (message.type === 'GET_SESSION') {
        sendResponse({ session: currentSession });
    } else if (message.type === 'CLEAR_SESSION') {
        currentSession = null;
        sendResponse({ status: 'cleared' });
    } else if (message.type === 'CAPTURE_VISIBLE_TAB') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            sendResponse({ dataUrl });
        });
        return true; // Async response
    }

    return true;
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Automation Framework Manager installed');
});
