# 🚀 Automation Framework Manager

An advanced Chrome extension that acts as a lightweight automation IDE, enabling you to create, manage, and export complete automation testing projects with Page Object Model (POM) support.

## ✨ Key Features

### 🎯 Project Management
- Create multiple automation projects
- Support for **Playwright**, **Selenium**, and **WebdriverIO**
- Multi-language support: **TypeScript**, **JavaScript**, **Python**, **Java**
- Auto-generated project structure with proper folder organization

### 📄 Page Object Model (POM)
- Auto-detect elements on any webpage
- Generate Page Object classes automatically
- Smart element naming based on attributes, text, and context
- Robust selector generation (ID, data-testid, name, path-based)

### 🧪 Test Management
- Create test specifications linked to Page Objects
- Organize tests by suites and test cases
- Auto-generate test code in your chosen framework/language

### ⏺ Smart Recording
- Record user interactions in real-time
- Automatically map actions to Page Object methods
- Capture clicks, inputs, selects, and more
- Generate test code as you interact with the page

### 📦 Export & Download
- Export entire project structure
- Download all files (Page Objects, Tests, Config, Dependencies)
- Copy generated code to clipboard
- Ready-to-run project setup

## 🚀 Quick Start

### Installation
1. Clone or download this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in top-right corner).
4. Click **Load unpacked**.
5. Select the **root folder** of this project (the folder containing `manifest.json`).
6. The extension icon (🚀) should appear in your browser toolbar.

### Creating Your First Project

1. Click the extension icon
2. Click **+ New Project**
3. Enter project details:
   - **Name**: My Test Project
   - **Tool**: Playwright
   - **Language**: TypeScript
4. Click **Create Project**

### Creating a Page Object

1. Navigate to the page you want to test
2. Go to **Page Objects** tab
3. Click **+ Add Page Object**
4. Enter page name (e.g., "LoginPage")
5. Check **Auto-detect elements** to scan the page
6. Click **Create Page Object**

### Recording a Test

1. Go to **Recorder** tab
2. Select your Page Object
3. Select or create a Test Spec
4. Enter test case name
5. Click **⏺ Start Recording**
6. Interact with the webpage
7. Click **⏹ Stop Recording**
8. View generated code in the code panel

### Exporting Your Project

1. Go to **Export** tab
2. Review project structure
3. Click **⬇ Download Project**
4. All files will be downloaded to your Downloads folder

## 📁 Generated Project Structure

```
my-project/
├── tests/
│   ├── login.spec.ts
│   └── checkout.spec.ts
├── pages/
│   ├── LoginPage.ts
│   └── HomePage.ts
├── utils/
│   └── helpers.ts
├── playwright.config.ts
├── package.json
└── README.md
```

## 🎨 Example Generated Code

### Page Object (Playwright + TypeScript)

```typescript
import { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  private usernameInput = '#username';
  private passwordInput = '#password';
  private loginButton = 'button[type="submit"]';

  async login(username: string, password: string) {
    await this.page.fill(this.usernameInput, username);
    await this.page.fill(this.passwordInput, password);
    await this.page.click(this.loginButton);
  }
}
```

### Test Spec (Playwright + TypeScript)

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('Login Tests', () => {
  test('should login successfully', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await page.goto('https://example.com/login');
    await loginPage.login('testuser', 'password123');
    await expect(page).toHaveURL(/dashboard/);
  });
});
```

## 🛠 Supported Frameworks & Languages

| Framework | JavaScript | TypeScript | Python | Java |
|-----------|------------|------------|--------|------|
| Playwright | ✅ | ✅ | ✅ | ✅ |
| Selenium | ✅ | ✅ | ✅ | ✅ |
| WebdriverIO | ✅ | ✅ | ❌ | ❌ |

## 🎯 Advanced Features

### Smart Element Detection
- Automatically generates meaningful variable names
- Prioritizes stable selectors (ID > data-testid > name > path)
- Groups elements by page sections
- Detects element types (button, input, select, etc.)

### Intelligent Selector Generation
1. **ID-based**: `#loginButton`
2. **Test ID**: `[data-testid="login-btn"]`
3. **Name attribute**: `[name="username"]`
4. **Path-based**: `form > div:nth-of-type(2) > button`

### Auto-Generated Dependencies

**package.json** (JavaScript/TypeScript):
```json
{
  "name": "my-project",
  "version": "1.0.0",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "typescript": "^5.0.0"
  }
}
```

**requirements.txt** (Python):
```
playwright==1.40.0
pytest==7.4.0
pytest-playwright==0.4.3
```

## 📊 Dashboard Overview

The dashboard provides real-time statistics:
- **Page Objects**: Total number of Page Objects created
- **Test Specs**: Total number of test specifications
- **Test Cases**: Total number of individual test cases
- **Project Info**: Tool, language, creation date, last updated

## 🔧 Technical Architecture

```
┌─────────────────────────────────────┐
│         Chrome Extension UI         │
│  (Project Manager, POM Creator,     │
│   Test Manager, Recorder, Export)   │
└─────────────────┬───────────────────┘
                  │
                  ↓
┌─────────────────────────────────────┐
│         Content Script              │
│  (Element Detection, Event          │
│   Capture, Selector Generation)     │
└─────────────────┬───────────────────┘
                  │
                  ↓
┌─────────────────────────────────────┐
│      Background Service Worker      │
│  (Session Management, Message       │
│   Routing, State Persistence)       │
└─────────────────┬───────────────────┘
                  │
                  ↓
┌─────────────────────────────────────┐
│         Chrome Storage API          │
│  (Projects, Page Objects, Tests,    │
│   Configuration, Session Data)      │
└─────────────────────────────────────┘
```

## 🎓 Best Practices

1. **Use Meaningful Names**: Name your Page Objects and tests descriptively
2. **One Page Per POM**: Create separate Page Objects for each distinct page
3. **Group Related Tests**: Organize tests by feature or user flow
4. **Review Generated Code**: Always review and refine generated selectors
5. **Add Assertions**: Enhance recorded tests with proper assertions
6. **Version Control**: Export and commit your projects to Git

## 🐛 Troubleshooting

### Elements Not Detected
- Ensure the page is fully loaded before creating Page Object
- Check if elements are in shadow DOM (limited support)
- Try manual selector entry if auto-detect fails

### Recording Not Working
- Make sure you've selected Page Object and Test Spec
- Check that the page allows content scripts
- Refresh the page and try again

### Export Issues
- Ensure you have download permissions
- Check your Downloads folder for files
- Try copying code manually if download fails

## 🚧 Current Limitations

- Shadow DOM support is basic
- iframe interactions require manual handling
- WebSocket monitoring not implemented
- Drag & drop events not captured
- Limited support for complex SPA navigation

## 🔮 Roadmap

### v2.1
- [ ] Visual assertion builder
- [ ] API request/response validation
- [ ] Test data management
- [ ] Improved shadow DOM support

### v2.2
- [ ] Cloud sync for projects
- [ ] Team collaboration features
- [ ] CI/CD integration helpers
- [ ] Advanced reporting

### v3.0
- [ ] AI-powered test suggestions
- [ ] Visual regression testing
- [ ] Performance testing integration
- [ ] Mobile testing support

## 📝 License

MIT License - feel free to use and modify!

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📧 Support

For issues or questions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting guide

---

**Built with ❤️ for the automation testing community**

Version: 2.0.0
Last Updated: 2025-11-30
