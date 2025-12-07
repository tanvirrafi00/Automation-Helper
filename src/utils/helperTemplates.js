// Helper and utility file templates

class HelperTemplates {
    // JavaScript/TypeScript helpers
    static getJSHelpers() {
        return `const config = require('../config/config');

/**
 * Wait for element to be visible
 */
async function waitForElement(page, selector, timeout = config.timeout) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Take screenshot with timestamp
 */
async function takeScreenshot(page, name) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  await page.screenshot({ 
    path: \`screenshots/\${name}_\${timestamp}.png\`,
    fullPage: true 
  });
}

/**
 * Generate random email
 */
function generateRandomEmail() {
  const timestamp = Date.now();
  return \`test_\${timestamp}@example.com\`;
}

/**
 * Wait for specified milliseconds
 */
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  waitForElement,
  takeScreenshot,
  generateRandomEmail,
  wait
};
`;
    }

    // TypeScript helpers
    static getTSHelpers() {
        return `import { Page } from '@playwright/test';
import config from '../config/config';

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  page: Page, 
  selector: string, 
  timeout: number = config.timeout
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

/**
 * Take screenshot with timestamp
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  await page.screenshot({ 
    path: \`screenshots/\${name}_\${timestamp}.png\`,
    fullPage: true 
  });
}

/**
 * Generate random email
 */
export function generateRandomEmail(): string {
  const timestamp = Date.now();
  return \`test_\${timestamp}@example.com\`;
}

/**
 * Wait for specified milliseconds
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
`;
    }

    // Python helpers
    static getPythonHelpers() {
        return `import time
from datetime import datetime
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from config.config import config

def wait_for_element(driver, locator, timeout=None):
    """Wait for element to be visible"""
    timeout = timeout or config.TIMEOUT / 1000
    return WebDriverWait(driver, timeout).until(
        EC.visibility_of_element_located(locator)
    )

def take_screenshot(driver, name):
    """Take screenshot with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    driver.save_screenshot(f'screenshots/{name}_{timestamp}.png')

def generate_random_email():
    """Generate random email for testing"""
    timestamp = int(time.time())
    return f'test_{timestamp}@example.com'

def wait(seconds):
    """Wait for specified seconds"""
    time.sleep(seconds)
`;
    }

    // Java helpers
    static getJavaHelpers() {
        return `package utils;

import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.openqa.selenium.support.ui.ExpectedConditions;
import config.ConfigReader;
import java.io.File;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class Helpers {
    
    /**
     * Wait for element to be visible
     */
    public static WebElement waitForElement(WebDriver driver, By locator) {
        int timeout = ConfigReader.getTimeout() / 1000;
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(timeout));
        return wait.until(ExpectedConditions.visibilityOfElementLocated(locator));
    }
    
    /**
     * Take screenshot with timestamp
     */
    public static void takeScreenshot(WebDriver driver, String name) {
        try {
            TakesScreenshot ts = (TakesScreenshot) driver;
            File source = ts.getScreenshotAs(OutputType.FILE);
            String timestamp = LocalDateTime.now()
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
            String destination = "screenshots/" + name + "_" + timestamp + ".png";
            org.apache.commons.io.FileUtils.copyFile(source, new File(destination));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    /**
     * Generate random email
     */
    public static String generateRandomEmail() {
        long timestamp = System.currentTimeMillis();
        return "test_" + timestamp + "@example.com";
    }
    
    /**
     * Wait for specified milliseconds
     */
    public static void wait(int milliseconds) {
        try {
            Thread.sleep(milliseconds);
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}
`;
    }

    // Test data fixtures (JSON)
    static getTestDataJSON() {
        return `{
  "users": {
    "validUser": {
      "username": "test@example.com",
      "password": "Test123!",
      "firstName": "Test",
      "lastName": "User"
    },
    "adminUser": {
      "username": "admin@example.com",
      "password": "Admin123!",
      "role": "admin"
    }
  },
  "products": [
    {
      "id": 1,
      "name": "Product 1",
      "price": 29.99,
      "category": "Electronics"
    },
    {
      "id": 2,
      "name": "Product 2",
      "price": 49.99,
      "category": "Books"
    }
  ],
  "testData": {
    "validEmail": "test@example.com",
    "invalidEmail": "invalid-email",
    "validPhone": "+1234567890",
    "invalidPhone": "123"
  }
}
`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HelperTemplates;
}
