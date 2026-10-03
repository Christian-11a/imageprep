import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('responsive controls fit small phones, tablets and wide screens with local assets', async ({ page }) => {
  const externalRequests: string[] = [];
  page.on('request', request => {
    if (/^https?:/.test(request.url()) && new URL(request.url()).hostname !== '127.0.0.1') externalRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(() => page.locator('button, select, input:not([type=file]), summary, header a').evaluateAll(elements =>
      elements.filter(element => element.getClientRects().length).filter(element => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > innerWidth + 1;
      }).map(element => ({ name: element.textContent || element.getAttribute('aria-label'), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, viewport: innerWidth })),
    )).toEqual([]);
    await page.getByRole('button', { name: 'Try a sample image' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    const bounds = await page.getByRole('listitem').boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('link', { name: 'ImagePrep home' }).click();
  await page.screenshot({ path: 'docs/screenshots/redesign-desktop.png' });
  await page.screenshot({ path: 'docs/screenshots/workspace.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/redesign-mobile.png', fullPage: true });
  expect(externalRequests).toEqual([]);
});

test('prepared image rows keep long names and controls usable across viewport widths', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.evaluate(() => {
    document.documentElement.style.scrollbarGutter = 'stable';
    return document.fonts.ready;
  });

  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('button', { name: /Prepare images|Process images/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();

  const longName = 'a-very-long-mountain-photograph-filename-for-responsive-layout-checks.png';
  const pngBase64 = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 16;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#d7ff65';
    context.fillRect(0, 0, 24, 16);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not create test image.')), 'image/png'));
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  });
  await page.locator('input[type="file"]').setInputFiles({
    name: longName,
    mimeType: 'image/png',
    buffer: Buffer.from(pngBase64, 'base64'),
  });
  await expect(page.getByRole('listitem')).toHaveCount(2);
  await page.getByRole('button', { name: /Prepare remaining|Prepare images|Process images/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();

  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    const cards = page.locator('.image-card');
    await expect(cards).toHaveCount(2);

    for (let index = 0; index < 2; index++) {
      const card = cards.nth(index);
      const filename = card.locator('.image-name');
      await expect(filename).toBeVisible();
      const nameBox = await filename.boundingBox();
      expect(nameBox?.width, `filename width at ${width}px`).toBeGreaterThanOrEqual(90);

      const metadata = await card.locator('.image-meta > span:not([aria-hidden="true"])').evaluateAll(elements =>
        elements.map(element => {
          const bounds = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const range = document.createRange();
          range.selectNodeContents(element);
          const lines = new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top)));
          return { text: element.textContent?.trim(), width: bounds.width, lineCount: lines.size, lineHeight: parseFloat(style.lineHeight) };
        }).filter(value => value.text && value.text.length > 2),
      );
      expect(metadata.length).toBeGreaterThan(0);
      for (const item of metadata) {
        expect(item.lineCount, `${item.text} should stay on one line at ${width}px`).toBe(1);
      }

      const actionLines = await card.locator('.image-card-actions button').evaluateAll(buttons => buttons.map(button => {
        const range = document.createRange();
        range.selectNodeContents(button);
        return new Set(Array.from(range.getClientRects(), rect => Math.round(rect.top))).size;
      }));
      expect(actionLines.length).toBeGreaterThan(0);
      expect(actionLines, `row action labels should remain single-line at ${width}px`).toEqual(actionLines.map(() => 1));

      const hiddenOutputFormat = card.getByText(/^Output format:/);
      const hiddenBox = await hiddenOutputFormat.boundingBox();
      const hiddenPosition = await hiddenOutputFormat.evaluate(element => getComputedStyle(element).position);
      expect(hiddenBox?.width).toBeLessThanOrEqual(1);
      expect(hiddenBox?.height).toBeLessThanOrEqual(1);
      expect(hiddenPosition).toBe('absolute');
    }

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(overflow.scrollWidth, `document should not overflow horizontally at ${width}px`).toBeLessThanOrEqual(overflow.clientWidth);

    const order = await page.evaluate(() => {
      const workspace = document.querySelector('.image-workspace')!;
      const settings = document.querySelector('.settings-panel')!;
      return {
        workspaceBeforeSettings: Boolean(workspace.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING),
        workspaceTop: workspace.getBoundingClientRect().top,
        settingsTop: settings.getBoundingClientRect().top,
      };
    });
    expect(order.workspaceBeforeSettings).toBe(true);
    if (width <= 414) expect(order.workspaceTop).toBeLessThan(order.settingsTop);
    if (width === 375) await page.locator('.image-workspace').screenshot({ path: 'docs/screenshots/hallmark-mobile-workspace.png' });
  }

  const sampleCard = page.locator('.image-card').first();
  await expect(sampleCard.getByRole('button', { name: 'Preview mountain-sunset.jpg', exact: true })).toBeVisible();
  const filenameButton = sampleCard.getByRole('button', { name: 'Preview details for mountain-sunset.jpg', exact: true });
  await filenameButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(filenameButton).toBeFocused();

  const finalRow = page.locator('.image-card').last();
  await finalRow.locator('.image-card-actions button').last().focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Output format')).toBeFocused();
});

test('presets invalidate old exports and disclosures work from the keyboard', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a sample image' }).click();
  await page.getByRole('button', { name: /Prepare images|Prepare remaining|All images prepared/ }).click();
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toBeVisible();
  await expect(page.locator('.notice-success')).toBeVisible();
  await page.getByRole('button', { name: 'Compact 1200px' }).click();
  await expect(page.locator('.notice')).toHaveCount(0);
  await expect(page.getByLabel('Max width', { exact: true })).toHaveValue('1200');
  await expect(page.getByLabel('Max height', { exact: true })).toHaveValue('1200');
  await expect(page.getByRole('button', { name: 'Download all', exact: true })).toHaveCount(0);
  const summary = page.locator('.faq-detail summary').first();
  await summary.focus();
  await summary.press('Enter');
  await expect(page.getByText('Each image can be up to 10 MB', { exact: false })).toBeVisible();
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations.map(issue => ({ id: issue.id, targets: issue.nodes.map(node => node.target) }))).toEqual([]);
});

test('reveals remain usable in short viewports and when reduced motion changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await expect(page.locator('#privacy')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.locator('[data-reveal]').evaluateAll(elements =>
    elements.every(element => getComputedStyle(element).opacity === '1'),
  )).toBe(true);
});
