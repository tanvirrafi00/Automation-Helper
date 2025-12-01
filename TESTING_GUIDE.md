# Testing & Debugging Guide

## 🔍 Quick Diagnostic Steps

### Step 1: Verify Extension is Loaded
1. Open Chrome Extensions page: `chrome://extensions/`
2. Find "Automation Framework Manager"
3. Check that it's **Enabled**
4. Click **"Reload"** button (circular arrow icon)
5. Check for any **errors** in red

### Step 2: Open Extension Console
1. On Extensions page, click **"Inspect views: service worker"**
2. This opens the background script console
3. Look for any **red errors**
4. Keep this console open while testing

### Step 3: Open Side Panel
1. Navigate to any website (e.g., https://example.com)
2. Click the extension icon in toolbar
3. Extension should open in side panel
4. Press **F12** to open DevTools for the side panel
5. Check Console tab for errors

### Step 4: Test Basic Functionality

#### Create a Project
```
1. Go to Dashboard tab
2. Click "+ New Project"
3. Fill in:
   - Name: "TestProject"
   - Tool: "playwright"
   - Language: "typescript"
4. Click "Create Project"
5. Check console for errors
```

**Expected Result:** Project appears in dropdown, dashboard shows stats

#### Create a Page Object
```
1. Go to "Page Objects" tab
2. Click "+ Add Page Object"
3. Fill in:
   - Name: "TestPage"
   - URL: "https://example.com"
4. Click "Create Page Object"
5. Check console for errors
```

**Expected Result:** Page Object appears in list

#### Create a Test Suite
```
1. Go to "Tests" tab
2. Click "+ Add Test"
3. Select "Create New Test Suite"
4. Fill in:
   - Suite Name: "TestSuite"
   - Page Object: "TestPage"
   - Test Case Name: "test case 1"
5. Click "Add Test Case"
6. Check console for errors
```

**Expected Result:** Test Suite appears in list with 1 test case

#### Record Steps
```
1. Go to "Recorder" tab
2. Select:
   - Page Object: "TestPage"
   - Test Spec: "TestSuite"
   - Test Case Name: "test case 1"
3. Click "Start Recording"
4. Interact with the page (click, type, etc.)
5. Check "Recorded Steps" section - steps should appear
6. Check "Generated Code" section - code should appear
7. Click "Stop Recording"
8. Click "Generate & Save Code"
9. Check console for errors
```

**Expected Result:** 
- Steps appear in list
- Code appears in preview
- Success message after saving

#### View Code
```
1. Go to "Tests" tab
2. Find your test suite
3. Click "View All Code" button
4. Modal should open with generated code
5. Check console for errors
```

**Expected Result:** Modal shows TypeScript/JavaScript code

## 🐛 Common Issues & Solutions

### Issue 1: "No code generated. The test might be empty"

**Possible Causes:**
- Test case has no steps
- Page Object not found
- Code generator error

**Debug Steps:**
1. Open browser console (F12)
2. Run this command:
```javascript
chrome.storage.local.get(null, (data) => {
  console.log('All storage:', data);
  const projects = data.automation_projects;
  const currentId = data.current_project_id;
  const project = projects[currentId];
  console.log('Current project:', project);
  console.log('Page Objects:', project?.pages);
  console.log('Tests:', project?.tests);
});
```
3. Check if:
   - Project exists
   - Page Objects exist
   - Tests exist
   - Test cases have steps array

**Solution:**
- If steps are empty: Record steps first
- If page object missing: Create page object
- If test missing: Create test suite

### Issue 2: "Buttons not working (View Code, Run, Delete)"

**Possible Causes:**
- Event delegation not working
- JavaScript errors
- Extension not reloaded

**Debug Steps:**
1. Check console for errors
2. Reload extension
3. Hard refresh side panel (Ctrl+Shift+R)

**Solution:**
- Reload extension from chrome://extensions/
- Clear browser cache
- Check for JavaScript errors in console

### Issue 3: "Recording not working"

**Possible Causes:**
- Content script not injected
- Page security restrictions
- Extension permissions

**Debug Steps:**
1. Open page console (F12 on the webpage, not extension)
2. Run: `console.log('Content script loaded:', typeof window.automationRecorder)`
3. Should see: `Content script loaded: object`

**Solution:**
- Reload the webpage
- Check if page allows extensions (some sites block them)
- Verify manifest permissions

### Issue 4: "Code not saving"

**Possible Causes:**
- Missing required fields
- Storage quota exceeded
- JavaScript error

**Debug Steps:**
1. Open extension console
2. Look for error messages
3. Check storage usage:
```javascript
chrome.storage.local.getBytesInUse(null, (bytes) => {
  console.log('Storage used:', bytes, 'bytes');
});
```

**Solution:**
- Fill all required fields (marked with *)
- Clear old projects if storage full
- Check console for specific error

## 📊 Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Can create project
- [ ] Can create page object
- [ ] Can create test suite
- [ ] Can add test case to existing suite
- [ ] Can record steps
- [ ] Steps appear in list
- [ ] Code preview shows correct framework syntax
- [ ] Can save recorded steps
- [ ] Can view page object code
- [ ] Can view test suite code
- [ ] Can view individual test case code
- [ ] Can run test case
- [ ] Can delete test case
- [ ] Can delete test suite
- [ ] Can delete page object
- [ ] Can export project as ZIP
- [ ] Downloaded files have correct extensions
- [ ] Downloaded files contain generated code

## 🔧 Reset Everything (Last Resort)

If nothing works, reset all data:

```javascript
// Open extension console and run:
chrome.storage.local.clear(() => {
  console.log('All data cleared');
  location.reload();
});
```

Then start fresh with a new project.

## 📝 Reporting Issues

If problems persist, provide:
1. Chrome version
2. Extension version
3. Console errors (screenshot)
4. Steps to reproduce
5. Expected vs actual behavior
