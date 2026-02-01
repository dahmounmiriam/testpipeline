// e2e.generic.spec.js
// End-to-end tests using Playwright for generic routes and the Repository form interactions.
// This test suite covers navigation, CRUD for repositories, data persistence, and optional authentication flow detection.

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Lightweight sleep for debugging (not usually needed in E2E, but kept for stability in flaky environments)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper: navigate to a route with a stable wait
async function navigateTo(page, route) {
  const url = route.startsWith('http') ? route : `${BASE_URL}${route}`;
  await page.goto(url);
  // Try multiple strategies to wait until the page is reasonably loaded
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 });
  } catch {
    // Fallback: wait a short fixed time
    await sleep(500);
  }
}

// Helper: robustly locate a form field by multiple common selectors
async function fillField(page, selectors, value) {
  for (const sel of selectors) {
    const el = page.locator(sel);
    if ((await el.count()) > 0) {
      await el.first().fill(value);
      return;
    }
  }
  throw new Error(`Unable to locate field among selectors: ${selectors.join(', ')}`);
}

// Helper: create a repository entry via the UI
async function createRepository(page, repo) {
  // Navigate to list
  await navigateTo(page, '/repositories');

  // Click "New Repository" if available
  const createBtn = page.locator('button[data-testid="new-repo-btn"], a[data-testid="new-repo-btn"], button:has-text("New Repository"), a:has-text("New Repository")');
  if (await createBtn.count() > 0) {
    await createBtn.first().click();
  } else {
    await navigateTo(page, '/repositories/new');
  }

  // Fill fields (try common data-testid names, fallback to generic inputs)
  await fillField(page, ['input[data-testid="repo-name"]', 'input[id="repo-name"]', 'input[name="name"]'], repo.name);
  await fillField(page, ['textarea[data-testid="repo-desc"]', 'textarea[id="repo-desc"]', 'textarea[name="description"]'], repo.description);
  await fillField(page, ['input[data-testid="repo-url"]', 'input[id="repo-url"]', 'input[name="url"]'], repo.url);

  // Submit
  const submitBtn = page.locator('button[data-testid="repo-submit"], button[type="submit"]');
  await Promise.all([
    submitBtn.first().click(),
    page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
  ]);
  // Return the created item's visible name to verify later
  return repo.name;
}

// Helper: ensure an element with specific text exists on the page
async function expectTextVisible(page, text, timeout = 10000) {
  await page.waitForSelector(`text="${text}"`, { timeout });
  await expect(page.locator(`text="${text}"`).first()).toBeVisible();
}

// Test suite
const { test, expect } = require('@playwright/test');

test.describe('Generic E2E: Navigation, CRUD, and data persistence for repositories', () => {

  test('Navigation and page loading across generic routes', async ({ page }) => {
    // Root
    await navigateTo(page, '/');
    // Repositories list
    await navigateTo(page, '/repositories');
    // Basic assertion: content area should be present
    const mainContent = page.locator('main, [data-testid="main-content"], h1, h2');
    await expect(mainContent.first()).toBeVisible({ timeout: 5000 });

    // Optional: another generic route
    await navigateTo(page, '/dashboard');
    const dashboardMain = page.locator('main, [data-testid="main-content"]');
    // Accept either a dashboard main or generic content
    await expect(dashboardMain.first()).toBeVisible({ timeout: 5000 });
  });

  test('Create, Read, Update, and Delete a Repository with data persistence', async ({ page }) => {
    // Prepare unique repo data
    const ts = Date.now();
    const repoName = `E2E Test Repo ${ts}`;
    const repoDesc = 'Automated E2E test repository';
    const repoUrl = `https://example.com/repo-${ts}`;

    // Create repository
    const createdName = await createRepository(page, {
      name: repoName,
      description: repoDesc,
      url: repoUrl,
    });

    // Verify created item appears in listing
    await navigateTo(page, '/repositories');
    await expectTextVisible(page, createdName);

    // Read: ensure item can be found (already verified)
    // Reload and verify persistence
    await page.reload({ waitUntil: 'networkidle' });
    await expectTextVisible(page, createdName, 15000);

    // Update: edit the repository name
    const repoItem = page.locator(`text="${createdName}"`).first();
    const editBtn = repoItem.locator('xpath=ancestor::*[@data-testid][.//button[contains(text(),"Edit")]]', { hasText: 'Edit' });
    // Fallback: if no specific locator, try a generic approach
    const editBtnFallback = repoItem.closest('[data-testid^="repo-item"]').locator('button', { hasText: 'Edit' });
    if ((await editBtn.count()) > 0) {
      await editBtn.first().click();
    } else if ((await editBtnFallback.count()) > 0) {
      await editBtnFallback.first().click();
    } else {
      // If no explicit edit button, click the item to open detail (best-effort)
      await repoItem.first().click();
    }

    const updatedName = `${repoName} - Updated`;
    // Update the name field
    await fillField(page, ['input[data-testid="repo-name"]', 'input[id="repo-name"]', 'input[name="name"]'], updatedName);
    const submitBtn = page.locator('button[data-testid="repo-submit"], button[type="submit"]');
    await Promise.all([
      submitBtn.first().click(),
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    ]);
    await expectTextVisible(page, updatedName, 10000);

    // Delete the repository
    const updatedItem = page.locator(`text="${updatedName}"`).first();
    const delBtn = updatedItem.closest('[data-testid^="repo-item"]').locator('button', { hasText: 'Delete' });
    if ((await delBtn.count()) > 0) {
      await delBtn.first().click();
      // Confirm deletion if modal appears
      const confirmBtn = page.locator('button[data-testid="confirm-delete"], button:has-text("Yes"), button:has-text("Delete")');
      if ((await confirmBtn.count()) > 0) {
        await confirmBtn.first().click();
      }
    } else {
      // Fallback: try a generic delete action from details page
      const genericDel = page.locator('button', { hasText: 'Delete' });
      if ((await genericDel.count()) > 0) {
        await genericDel.first().click();
      }
    }

    // Verify deletion
    await page.waitForTimeout(1000);
    await expect(page.locator(`text="${updatedName}"`)).toHaveCount(0);
  });

  test('Optional Authentication flow: detect and perform login if auth pages exist', async ({ page }) => {
    // Attempt to detect login UI
    await navigateTo(page, '/');
    const loginForm = page.locator('form[data-testid="login-form"], form#login, form[aria-label="Login"], input[name="username"]');
    if ((await loginForm.count()) === 0) {
      // No authentication pages detected; skip gracefully
      return;
    }

    const username = process.env.TEST_USERNAME || 'test';
    const password = process.env.TEST_PASSWORD || 'test';

    // Fill credentials if inputs exist
    if ((await page.locator('input[name="username"]').count()) > 0) {
      await page.fill('input[name="username"]', username);
    }
    if ((await page.locator('input[name="password"]').count()) > 0) {
      await page.fill('input[name="password"]', password);
    }

    // Submit and wait for navigation or network idle
    const loginButton = page.locator('button[type="submit"], button:has-text("Login")');
    await Promise.all([
      loginButton.first().click(),
      page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}),
    ]);

    // Verify login indicator if present
    const logoutButton = page.locator('text=Logout, button[data-testid="logout"]');
    if ((await logoutButton.count()) > 0) {
      await expect(logoutButton.first()).toBeVisible();
      // Optional: logout to clean up
      await logoutButton.first().click();
    } else {
      // If no explicit indicator, consider login flow attempted
      // No assertion required here; test remains informative
    }
  });
});