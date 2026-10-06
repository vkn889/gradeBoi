import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /explore with demo grades/i }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText(/grade point average/i)).toBeVisible();
}

test("login page shows privacy notice and validates input", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("We never store your password.")).toBeVisible();
  await expect(page.getByText(/not affiliated with Edupoint/i)).toBeVisible();
  await expect(page.getByText("Northshore School District")).toBeVisible();
  await page.getByRole("button", { name: /sign in with studentvue/i }).click();
  await expect(page.locator("#password-error")).toContainText(/username and password/i);
});

test("dashboard redirects to login without a session", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
});

test("sign in, open a class, run a hypothetical, reset", async ({ page }) => {
  await openDemo(page);

  // Every class with period, name, teacher, percent, and letter.
  const rows = page.getByRole("link", { name: /%/ }).filter({ hasText: "Rivera" });
  await expect(rows.first()).toContainText("AP Calculus AB");
  await expect(rows.first()).toContainText("85.3%");

  const gpaBefore = await page.getByText(/^\d\.\d\d$/).first().textContent();

  await rows.first().click();
  await page.waitForURL("**/class/**");
  await expect(page.getByRole("heading", { name: "AP Calculus AB" })).toBeVisible();
  await expect(page.getByText("85.3%").first()).toBeVisible();

  await page.getByRole("switch", { name: /hypothetical/i }).click();
  await page.getByRole("button", { name: /Unit 2 Test: Derivatives/ }).click();
  const score = page.getByLabel("Score for Unit 2 Test: Derivatives");
  await score.fill("50");

  // Real vs hypothetical side by side, with the change.
  const header = page.getByRole("region", { name: "Class grade" });
  await expect(header).toContainText("85.3%");
  await expect(header).toContainText("90.7%");
  await expect(header).toContainText("+5.4");

  // Management bar for the assignment.
  const bar = page.getByRole("toolbar", { name: /Unit 2 Test/ });
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Zero" }).click();
  await expect(score).toHaveValue("0");

  // Edits persist on the device across a reload.
  await page.reload();
  await expect(page.getByRole("region", { name: "Class grade" })).toContainText("What-if");

  // GPA updates on the dashboard.
  await page.getByRole("link", { name: /all classes/i }).click();
  await expect(page.getByText("Hypothetical", { exact: true })).toBeVisible();
  const gpaAfter = await page.getByText(/^\d\.\d\d$/).first().textContent();
  expect(gpaAfter).not.toBe(gpaBefore);

  // Reset restores real data.
  await page.getByRole("link", { name: /AP Calculus AB/ }).first().click();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByRole("region", { name: "Class grade" })).toContainText("±0.0");
});

test("add, move, remove, and restore assignments", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("link", { name: /US History/ }).first().click();
  await page.getByRole("switch", { name: /hypothetical/i }).click();

  await page.getByRole("button", { name: /add assignment/i }).click();
  await page.getByLabel("Name").fill("Bonus Project");
  await page.getByLabel("Score", { exact: true }).fill("100");
  await page.getByLabel("Points possible").fill("100");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: /Bonus Project/ })).toBeVisible();

  await page.getByRole("button", { name: /Colonies Map/ }).click();
  const bar = page.getByRole("toolbar", { name: /Colonies Map/ });
  await bar.getByRole("button", { name: /move to another category/i }).click();
  await page.getByRole("menuitemradio", { name: "Assessment" }).click();
  await expect(page.getByRole("button", { name: /Colonies Map/ })).toContainText("Assessment");

  await page.getByRole("toolbar", { name: /Colonies Map/ }).getByRole("button", { name: "Remove" }).click();
  const removed = page.getByRole("region", { name: "Removed assignments" });
  await expect(removed).toContainText("Colonies Map");
  await removed.getByRole("button", { name: /restore/i }).click();
  await expect(page.getByRole("button", { name: /Colonies Map/ })).toBeVisible();
});

test("grading period switcher loads another period", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("combobox", { name: "Grading period" }).click();
  await page.getByRole("option", { name: "Q1 Progress" }).click();
  await expect(page.getByText("past period")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Grading period" })).toHaveText(/Q1 Progress$/);
  // Switching periods must not flag old work as new grades.
  await expect(page.getByText(/new grade/)).toHaveCount(0);
});

test("planning tools: what do I need", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("link", { name: /AP Calculus AB/ }).first().click();
  await page.getByRole("tab", { name: "Tools" }).click();
  await page.getByLabel("Target grade (%)").fill("90");
  // Homework (15%) alone can't lift the class to 90%...
  await page.getByRole("combobox", { name: "Assignment" }).click();
  await page.getByRole("option", { name: /HW 3\.1/ }).click();
  await expect(page.getByText(/not reachable with this assignment/i)).toBeVisible();
  // ...but the upcoming unit test can.
  await page.getByRole("combobox", { name: "Assignment" }).click();
  await page.getByRole("option", { name: /Unit 3 Test/ }).click();
  await expect(page.getByText(/you need at least/i)).toBeVisible();
});

test("no horizontal scroll at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/"]) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  }
  await openDemo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole("link", { name: /Honors English/ }).first().click();
  await page.getByRole("switch", { name: /hypothetical/i }).click();
  await page.getByRole("button", { name: /Narrative Final/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("sign out clears the session", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/$/);
});
