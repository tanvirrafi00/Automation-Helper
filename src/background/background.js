// Background service worker for Automation Framework Manager

let isRecording = false;
let currentSession = null;

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle step recording
    if (message.type === 'RECORDED_STEP') {
        // Store in session first
        if (!currentSession) {
            currentSession = {
                steps: [],
                pageName: message.pageName,
                testName: message.testName,
                testCase: message.testCase
            };
        }
        currentSession.steps.push(message.step);

        // Forward to popup if open
        chrome.runtime.sendMessage(message).catch((err) => {
            // Popup is closed, which is fine since we stored it in session
            // console.log('Popup closed, step stored in session');
        });

        sendResponse({ status: 'recorded' });
    }
    // Handle replay progress
    else if (message.type === 'REPLAY_PROGRESS') {
        chrome.runtime.sendMessage(message).catch(() => { });
        sendResponse({ status: 'forwarded' });
    }
    // Session management
    else if (message.type === 'GET_SESSION') {
        sendResponse({ session: currentSession });
    } else if (message.type === 'CLEAR_SESSION') {
        currentSession = null;
        sendResponse({ status: 'cleared' });
    } else if (message.type === 'CAPTURE_VISIBLE_TAB') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl });
            }
        });
        return true; // Async response
    }

    return true;
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Automation Framework Manager installed');
});
