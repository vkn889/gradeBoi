import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /explore with demo grades/i }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByText("Cumulative GPA")).toBeVisible();
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

test("a class at 0.0% shows N/A and doesn't count toward GPA", async ({ page }) => {
  await openDemo(page);
  const health = page.getByRole("link", { name: /Health, no grade yet/ });
  await expect(health).toContainText("N/A");
  await expect(health).not.toContainText(/\bF\b/);
  await health.click();
  await expect(page.getByText(/No grade entered yet\. Not counted in your GPA\./)).toBeVisible();
});

test("cumulative GPA is read from the StudentVUE transcript automatically", async ({ page }) => {
  await openDemo(page);
  const card = page.getByRole("region", { name: "GPA" });
  // No typing: the transcript in StudentVUE documents is found and read on its own.
  await expect(card).toContainText(/Unofficial transcript \(.+\) \+ this term/);
  const termOnly = await page.getByText(/^This term:/).textContent();
  expect(termOnly).toContain("3.40");

  await page.getByRole("link", { name: "GPA", exact: true }).click();
  const panel = page.getByRole("region", { name: "Transcript" });
  await expect(panel).toContainText("Unofficial Transcript");
  await expect(panel).toContainText("3.76"); // printed unweighted 3.756
  await expect(panel).toContainText("3.94"); // printed weighted 3.944
  await panel.getByText(/16 classes read from the transcript/).click();
  await expect(panel).toContainText("AP Human Geography");

  // (3.756 x 8 + this term 3.40 x 3) / 11 credits
  const stats = page.getByRole("region", { name: "Cumulative GPA" });
  await expect(stats).toContainText("3.66");

  // Switching to manual entry uses typed-in classes instead.
  await page.getByRole("switch", { name: /use my transcript/i }).click();
  await page.getByRole("textbox", { name: "Class" }).fill("English 9");
  await page.getByRole("combobox", { name: "Letter" }).click();
  await page.getByRole("option", { name: "C", exact: true }).click();
  await page.getByRole("button", { name: /add class/i }).click();
  await expect(page.getByRole("region", { name: "Grade 9" })).toContainText("English 9");
  await page.getByRole("link", { name: "Grades", exact: true }).click();
  await expect(card).toContainText("Past years you entered + this term");
});

test("documents: transcript first, opens as a PDF", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  const transcript = page.getByRole("region", { name: "Transcript" });
  await expect(transcript).toContainText("Unofficial Transcript");
  await expect(page.getByText("All documents (4)")).toBeVisible();

  const href = await transcript.getByRole("link", { name: /View Unofficial Transcript/ }).getAttribute("href");
  const res = await page.request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByRole("button", { name: "Report Card", exact: true }).click();
  await expect(page.getByText(/Report Card - Semester 2/)).toBeVisible();
});

test("AP tools: estimate a score, set it, and see college credit", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "AP" }).click();
  await expect(page.getByRole("heading", { name: /AP scores/ })).toBeVisible();

  // Score estimator (defaults to Calculus AB): a strong paper estimates a 5.
  await page.getByLabel("Multiple-choice correct").fill("42");
  await page.getByLabel("Free-response points").fill("50");
  const calc = page.getByRole("region", { name: "AP score estimator" });
  await expect(calc).toContainText("5");

  // Calculus AB is auto-detected from the demo schedule; give it a 5.
  const mine = page.getByRole("region", { name: "My AP exams" });
  await expect(mine).toContainText("Calculus AB");
  await mine.getByRole("combobox", { name: /Score for Calculus AB/ }).click();
  await page.getByRole("option", { name: "5", exact: true }).click();

  // Pick UW -> estimated quarter credits appear.
  const credit = page.getByRole("region", { name: "College AP credit" });
  await credit.getByRole("combobox", { name: "College" }).click();
  await page.getByRole("option", { name: /University of Washington \(Seattle\)/ }).click();
  await expect(credit).toContainText(/Estimated credit at/);
  await expect(credit).toContainText(/quarter credits/);
  await expect(credit.getByRole("link", { name: /official AP policy/ })).toBeVisible();
});
