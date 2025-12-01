# Quick Start Guide - Automation Framework Manager

## 🚀 Getting Started (5 Minutes)

### Prerequisites
- Google Chrome browser
- Extension installed and enabled

### Step 1: Load the Extension (30 seconds)
1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the extension folder
6. Click the extension icon to open side panel

### Step 2: Create Your First Project (1 minute)
1. In the side panel, go to **Dashboard** tab
2. Click **"+ New Project"**
3. Fill in the form:
   ```
   Project Name: My First Test
   Tool: playwright
   Language: typescript
   Template: default
   ```
4. Click **"Create Project"**
5. ✅ You should see project stats on dashboard

### Step 3: Create a Page Object (1 minute)
1. Go to **Page Objects** tab
2. Click **"+ Add Page Object"**
3. Fill in:
   ```
   Name: LoginPage
   URL: https://example.com
   ```
4. Click **"Create Page Object"**
5. ✅ "LoginPage" appears in the list

### Step 4: Create a Test Suite (1 minute)
1. Go to **Tests** tab
2. Click **"+ Add Test"**
3. Select **"Create New Test Suite"**
4. Fill in:
   ```
   Test Suite Name: LoginTests
   Page Object: LoginPage
   Test Case Name: should display login form
   ```
5. Click **"Add Test Case"**
6. ✅ "LoginTests" suite appears with 1 test case

### Step 5: Record Your First Test (2 minutes)
1. Navigate to https://example.com in the main browser window
2. In the extension, go to **Recorder** tab
3. Configure:
   ```
   Page Object: LoginPage  ⭐
   Test Spec: LoginTests   ⭐
   Test Case Name: should display login form  ⭐
   ```
4. Click **"⏺ Start Recording"**
5. Interact with the page:
   - Click on elements
   - Type in inputs
   - Click buttons
6. Watch the **"Recorded Steps"** section - steps appear in real-time!
7. Watch the **"Generated Code"** section - see Playwright TypeScript code!
8. Click **"⏹ Stop Recording"**
9. Click **"💾 Generate & Save Code"**
10. ✅ Success message appears!

### Step 6: View Your Generated Code (30 seconds)
1. Go to **Tests** tab
2. Find "LoginTests" suite
3. Click **"View All Code"** to see the complete test suite
4. Click **"👁️ View"** on a test case to see individual test code
5. ✅ Modal shows generated Playwright TypeScript code!

### Step 7: Export Your Project (30 seconds)
1. Go to **Export** tab
2. Click **"📦 Download as ZIP"**
3. Extract the ZIP file
4. ✅ You have a complete, runnable Playwright project!

## 📁 What You Get

Your downloaded project includes:

```
My-First-Test/
├── pages/
│   └── LoginPage.ts          ← Page Object with selectors & methods
├── tests/
│   └── LoginTests.ts          ← Test suite with all test cases
├── playwright.config.ts       ← Playwright configuration
├── package.json               ← Dependencies
├── environments.json          ← Environment configs
├── README.md                  ← How to run
├── run_tests.sh              ← Unix run script
└── run_tests.bat             ← Windows run script
```

## 🏃 Run Your Tests Locally

```bash
# Extract the ZIP
cd My-First-Test/

# Install dependencies
npm install

# Install browsers
npx playwright install

# Run tests
npx playwright test

# Or use the helper script
./run_tests.sh
```

## 🎯 What's Next?

### Add More Test Cases
1. Go to **Tests** tab
2. Click **"+ Add Test"**
3. Select **"Add to Existing Suite"**
4. Choose "LoginTests"
5. Enter new test case name
6. Record more steps!

### Create More Page Objects
- One Page Object per page/component
- Organize selectors and methods
- Reuse across multiple tests

### Try Different Frameworks
- Create new project with Selenium
- Try Python or Java
- See different code generation!

## ⚡ Pro Tips

1. **Name test cases descriptively**: "should login with valid credentials" not "test1"
2. **One action per test case**: Keep tests focused and maintainable
3. **Use Page Objects**: Don't put selectors directly in tests
4. **Export regularly**: Download your work to avoid data loss
5. **Check the code preview**: Make sure code looks correct before saving

## 🐛 Troubleshooting

**Not seeing recorded steps?**
- Make sure you clicked "Start Recording"
- Check that content script is loaded (reload page)
- Look for errors in browser console (F12)

**Code not generating?**
- Select Page Object and Test Spec first
- Make sure you have recorded at least one step
- Check the "Generated Code" section for error messages

**Can't save code?**
- Fill all required fields (marked with red *)
- Make sure you stopped recording first
- Check extension console for errors

## 📚 Learn More

- See `TESTING_GUIDE.md` for detailed debugging
- See `requirements.md` for full feature list
- See `UI_Blueprint.md` for UI documentation

## 🎉 You're Ready!

You now know how to:
- ✅ Create projects
- ✅ Define Page Objects
- ✅ Record tests
- ✅ Generate code
- ✅ Export projects
- ✅ Run tests locally

Happy Testing! 🚀
