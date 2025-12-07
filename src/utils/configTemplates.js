// Configuration file templates for different frameworks

class ConfigTemplates {
    // .env.example template (universal)
    static getEnvExample() {
        return `# Base Configuration
BASE_URL=https://example.com
HEADLESS=false
TIMEOUT=30000

# Authentication Credentials
USERNAME=test@example.com
PASSWORD=SecurePassword123

# API Configuration (if needed)
API_KEY=your-api-key-here
API_URL=https://api.example.com

# Database Configuration (if needed)
DB_HOST=localhost
DB_PORT=5432
DB_USER=testuser
DB_PASSWORD=testpass
DB_NAME=testdb

# Environment
ENV=dev
`;
    }

    // .gitignore template
    static getGitignore() {
        return `.env
node_modules/
*.log
.DS_Store
test-results/
playwright-report/
screenshots/
videos/
allure-results/
allure-report/
__pycache__/
*.pyc
.pytest_cache/
.venv/
venv/
target/
.idea/
.vscode/
*.iml
`;
    }

    // Playwright config.js
    static getPlaywrightConfigJS() {
        return `require('dotenv').config();

module.exports = {
  baseUrl: process.env.BASE_URL || 'https://example.com',
  timeout: parseInt(process.env.TIMEOUT) || 30000,
  headless: process.env.HEADLESS === 'true',
  
  credentials: {
    username: process.env.USERNAME,
    password: process.env.PASSWORD
  },
  
  api: {
    baseUrl: process.env.API_URL,
    apiKey: process.env.API_KEY
  }
};
`;
    }

    // Playwright config.ts
    static getPlaywrightConfigTS() {
        return `import * as dotenv from 'dotenv';
dotenv.config();

interface Config {
  baseUrl: string;
  timeout: number;
  headless: boolean;
  credentials: {
    username: string;
    password: string;
  };
  api: {
    baseUrl: string;
    apiKey: string;
  };
}

const config: Config = {
  baseUrl: process.env.BASE_URL || 'https://example.com',
  timeout: parseInt(process.env.TIMEOUT || '30000'),
  headless: process.env.HEADLESS === 'true',
  
  credentials: {
    username: process.env.USERNAME || '',
    password: process.env.PASSWORD || ''
  },
  
  api: {
    baseUrl: process.env.API_URL || '',
    apiKey: process.env.API_KEY || ''
  }
};

export default config;
`;
    }

    // Python config.py
    static getPythonConfig() {
        return `import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    BASE_URL = os.getenv('BASE_URL', 'https://example.com')
    TIMEOUT = int(os.getenv('TIMEOUT', '30000'))
    HEADLESS = os.getenv('HEADLESS', 'false').lower() == 'true'
    
    # Credentials
    USERNAME = os.getenv('USERNAME', '')
    PASSWORD = os.getenv('PASSWORD', '')
    
    # API
    API_URL = os.getenv('API_URL', '')
    API_KEY = os.getenv('API_KEY', '')
    
    # Database
    DB_HOST = os.getenv('DB_HOST', 'localhost')
    DB_PORT = int(os.getenv('DB_PORT', '5432'))
    DB_USER = os.getenv('DB_USER', '')
    DB_PASSWORD = os.getenv('DB_PASSWORD', '')
    DB_NAME = os.getenv('DB_NAME', '')

config = Config()
`;
    }

    // Java config.properties
    static getJavaConfigProperties() {
        return `# Base Configuration
base.url=\${BASE_URL}
timeout=\${TIMEOUT}
headless=\${HEADLESS}

# Credentials
username=\${USERNAME}
password=\${PASSWORD}

# API
api.url=\${API_URL}
api.key=\${API_KEY}
`;
    }

    // Java ConfigReader.java
    static getJavaConfigReader() {
        return `package config;

import io.github.cdimascio.dotenv.Dotenv;
import java.io.FileInputStream;
import java.io.IOException;
import java.util.Properties;

public class ConfigReader {
    private static Properties properties;
    private static Dotenv dotenv;
    
    static {
        try {
            dotenv = Dotenv.configure().ignoreIfMissing().load();
            properties = new Properties();
            properties.load(new FileInputStream("src/test/resources/config.properties"));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
    
    public static String getProperty(String key) {
        String value = properties.getProperty(key);
        if (value != null && value.startsWith("\${") && value.endsWith("}")) {
            String envKey = value.substring(2, value.length() - 1);
            return dotenv.get(envKey);
        }
        return value;
    }
    
    public static String getBaseUrl() {
        return getProperty("base.url");
    }
    
    public static String getUsername() {
        return getProperty("username");
    }
    
    public static String getPassword() {
        return getProperty("password");
    }
    
    public static int getTimeout() {
        return Integer.parseInt(getProperty("timeout"));
    }
    
    public static boolean isHeadless() {
        return Boolean.parseBoolean(getProperty("headless"));
    }
}
`;
    }

    // Playwright playwright.config.js
    static getPlaywrightFrameworkConfig() {
        return `const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: process.env.BASE_URL || 'https://example.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: process.env.HEADLESS === 'true',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
`;
    }

    // pytest.ini
    static getPytestIni() {
        return `[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers
markers =
    smoke: Smoke tests
    regression: Regression tests
    slow: Slow running tests
`;
    }

    // requirements.txt
    static getRequirementsTxt() {
        return `pytest==7.4.3
selenium==4.15.2
python-dotenv==1.0.0
allure-pytest==2.13.2
`;
    }

    // package.json for Playwright
    static getPackageJson(projectName) {
        // Sanitize project name for npm package naming rules
        const sanitizedName = projectName
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')  // Replace non-alphanumeric chars with dash
            .replace(/^-+|-+$/g, '')       // Remove leading/trailing dashes
            .replace(/-+/g, '-')           // Replace multiple dashes with single dash
            .substring(0, 214);            // npm package name max length

        return JSON.stringify({
            name: sanitizedName || 'automation-project',
            version: '1.0.0',
            description: 'Automated test suite',
            scripts: {
                test: 'playwright test',
                'test:headed': 'playwright test --headed',
                'test:debug': 'playwright test --debug',
                report: 'playwright show-report'
            },
            keywords: ['automation', 'testing'],
            author: '',
            license: 'ISC',
            devDependencies: {
                '@playwright/test': '^1.40.0',
                'dotenv': '^16.3.1'
            }
        }, null, 2);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfigTemplates;
}
