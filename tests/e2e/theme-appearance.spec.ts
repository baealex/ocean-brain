import { expect, type Page, test } from "@playwright/test";

const signIn = async (page: Page) => {
	await page.goto("/");
	await page.getByLabel("Password").fill("e2e-password");
	await page.getByRole("button", { name: "Sign in" }).click();
	await expect(page).toHaveURL((url) => url.pathname === "/");
};

test("theme preview rolls back and the applied theme survives reload", async ({
	page,
}) => {
	await signIn(page);
	await page.goto("/setting/appearance");
	await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();

	await page.getByRole("button", { name: "Light", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.studio/light",
	);
	await expect
		.poll(() =>
			page.evaluate(() => ({
				inlinePage:
					document.documentElement.style.getPropertyValue("--page-bg"),
				page: getComputedStyle(document.documentElement)
					.getPropertyValue("--page-bg")
					.trim(),
				radius: getComputedStyle(document.documentElement)
					.getPropertyValue("--ob-radius-surface")
					.trim(),
			})),
		)
		.toEqual({ inlinePage: "", page: "#f2f5f8", radius: "16px" });

	await page.getByRole("button", { name: "Preview Sketchbook" }).click();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.sketchbook/light",
	);
	await expect
		.poll(() =>
			page.evaluate(() =>
				document.documentElement.style.getPropertyValue("--page-bg"),
			),
		)
		.toBe("#fdf8f3");

	await page.getByRole("link", { name: "Graph", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.studio/light",
	);
	await page.goBack();
	await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();

	await page.getByRole("button", { name: "Preview Sketchbook" }).click();
	await page.getByRole("button", { name: "Cancel" }).click();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.studio/light",
	);
	await expect
		.poll(() =>
			page.evaluate(() =>
				document.documentElement.style.getPropertyValue("--page-bg"),
			),
		)
		.toBe("");

	await page.getByRole("button", { name: "Preview Sketchbook" }).click();
	await page.getByRole("button", { name: "Apply" }).click();
	await expect(page.getByText("Customize Sketchbook Light")).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const stored = localStorage.getItem("ocean-brain.appearance.v1");
				return stored ? JSON.parse(stored).preferredThemes : null;
			}),
		)
		.toEqual({
			light: "ocean-brain.sketchbook/light",
			dark: "ocean-brain.sketchbook/dark",
		});

	await page.getByRole("button", { name: "Dark", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.sketchbook/dark",
	);
	await page.getByRole("button", { name: "Light", exact: true }).click();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.sketchbook/light",
	);

	await page.reload();

	await expect(page.locator("html")).toHaveAttribute(
		"data-theme-id",
		"ocean-brain.sketchbook/light",
	);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem("theme")))
		.toBe("light");
});
