import { test, expect, importRows, snapshot } from './fixtures.mjs';

async function hold(page, locator, x, y) {
  const box = await locator.boundingBox();
  const origin = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();
  await page.mouse.move(origin.x + x, origin.y + y, { steps: 6 });
  return origin;
}

async function drag(page, locator, x, y) {
  await hold(page, locator, x, y);
  await page.mouse.up();
}

async function reversiblePush(page, divider) {
  const origin = await hold(page, divider, 220, 0);
  await expect(page.locator('[data-pending-push]')).toHaveCount(1);
  await expect(divider).toBeVisible();
  await expect.poll(async () => {
    const box = await divider.boundingBox();
    return Math.abs(box.x + box.width / 2 - origin.x - 220);
  }).toBeLessThan(2);
  const placeholder = page.locator('[data-pending-push]');
  const width = (await placeholder.boundingBox()).width;
  await page.mouse.move(origin.x + 260, origin.y, { steps: 4 });
  await expect.poll(async () => (await placeholder.boundingBox()).width).toBeLessThan(width - 35);
  await expect(page.locator('.view-row').first().locator('.view-card')).toHaveCount(1);
  await expect(page.locator('.push-preview .view-card')).toHaveCount(2);
  await page.mouse.move(origin.x, origin.y, { steps: 6 });
  await expect(page.locator('[data-pending-push]')).toHaveCount(0);
  await page.mouse.up();
  await hold(page, divider, 220, 0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(page.locator('[data-pending-push]')).toHaveCount(0);
  await expect(page.locator('.view-row').first().locator('.view-card')).toHaveCount(2);
}

async function cancelRowResize(page, divider) {
  const height = await page.locator('.view-row').first().evaluate(row => row.clientHeight);
  await hold(page, divider, 0, 100);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect.poll(() => page.locator('.view-row').first().evaluate(row => row.clientHeight)).toBe(height);
}

async function moveUp(page, id, count = 2) {
  const card = page.locator(`[data-view-id="${id}"]`);
  await card.getByRole('button', { name: 'View options', exact: true }).click();
  await card.getByRole('button', { name: 'Move to row above', exact: true }).click();
  await expect(page.locator('.view-row').first().locator('.view-card')).toHaveCount(count);
  await card.getByRole('button', { name: 'View options', exact: true }).click();
}

async function dragCard(page) {
  const target = page.locator('.view-row').first();
  const origin = page.locator('.view-row').nth(1).locator('.view-card').first();
  const grip = origin.getByRole('button', { name: 'Drag visualization card', exact: true });
  let box = await target.boundingBox();
  await hold(page, grip, 0, 0);
  await page.mouse.move(box.x + 20, box.y + 40);
  await expect(target).toHaveAttribute('data-drop', 'full');
  await page.mouse.up();
  // Move one of the upper cards down, then move it back into the free space.
  const card = target.locator('.view-card').first();
  const id = await card.getAttribute('data-view-id');
  box = await page.locator('.view-row').nth(1).boundingBox();
  await hold(page, card.getByRole('button', { name: 'Drag visualization card' }), 0, 0);
  await page.mouse.move(box.x + 20, box.y + 40);
  await expect(page.locator('[data-drop=valid]')).toHaveCount(1);
  await page.mouse.up();
  await expect(target.locator('.view-card')).toHaveCount(1);
  box = await target.boundingBox();
  await hold(page, page.locator(`[data-view-id="${id}"] .card-grip`), 0, 0);
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.up();
  await expect(target.locator('.view-card')).toHaveCount(2);
}

async function consistentOrder(page) {
  const ids = await page.locator('.view-row .view-card').evaluateAll(cards => cards.map(card => card.dataset.viewId));
  expect((await snapshot(page)).views.map(view => view.id)).toEqual(ids);
  return ids;
}

async function earlierAndReset(page) {
  const before = await consistentOrder(page);
  const card = page.locator(`[data-view-id="${before[1]}"]`);
  await card.getByRole('button', { name: 'View options', exact: true }).click();
  await card.getByRole('button', { name: 'Move view earlier', exact: true }).click();
  await card.getByRole('button', { name: 'View options', exact: true }).click();
  const after = await consistentOrder(page);
  expect(after).toEqual([before[1], before[0], ...before.slice(2)]);
  const height = await page.locator('.view-row').first().evaluate(row => row.clientHeight);
  await drag(page, page.getByRole('separator', { name: 'Resize cards', exact: true }).first(), 20, 0);
  await page.getByRole('separator', { name: 'Resize cards', exact: true }).first().dblclick();
  expect(await consistentOrder(page)).toEqual(after);
  expect(await page.locator('.view-row').first().evaluate(row => row.clientHeight)).toBe(height);
}

async function resetRowAndReflow(page, horizontal) {
  const order = await consistentOrder(page);
  await horizontal.dblclick();
  expect(await consistentOrder(page)).toEqual(order);
  await expect(page.locator('.view-row').first().locator('.view-card')).toHaveCount(1);
  await page.setViewportSize({ width: 1600, height: 900 });
  await moveUp(page, order[1]);
  await moveUp(page, order[2], 3);
  await expect(page.locator('.view-row')).toHaveCount(1);
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('.view-row')).toHaveCount(2);
}

async function overflowing(page) {
  return page.locator('#views').evaluate(node => node.scrollHeight > node.clientHeight + 2);
}

test('layout: squeeze wraps either card, row dividers scroll the panel and reset snaps to fit', async ({ app }) => {
  const { page } = app;
  await importRows(page);
  // Give two rows enough room to fit their minimum heights.
  await drag(page, page.locator('#row-divider'), 0, 100);
  await expect(page.locator('.view-row')).toHaveCount(2);
  await expect.poll(() => overflowing(page)).toBe(false);
  const original = await snapshot(page);
  const first = await page.locator('.view-row .view-card').first().getAttribute('data-view-id');
  const vertical = page.getByRole('separator', { name: 'Resize cards', exact: true }).first();
  await reversiblePush(page, vertical);
  await drag(page, vertical, -220, 0);
  await expect.poll(() => page.locator('.view-row').first().locator('.view-card').count()).toBe(1);
  expect(await page.locator('.view-row').nth(1).locator('.view-card').first().getAttribute('data-view-id')).toBe(first);
  await moveUp(page, first);
  await dragCard(page);
  await earlierAndReset(page);
  await expect(page.locator('.view-row').first().locator('.view-card')).toHaveCount(2);
  await drag(page, page.getByRole('separator', { name: 'Resize cards', exact: true }).first(), 220, 0);
  await expect(page.locator('.view-row').first().locator('.view-card')).toHaveCount(1);
  const horizontal = page.getByRole('separator', { name: 'Resize rows', exact: true }).first();
  await cancelRowResize(page, horizontal);
  await drag(page, horizontal, 0, 100);
  await expect.poll(() => overflowing(page)).toBe(true);
  await drag(page, horizontal, 0, -95);
  await expect.poll(() => overflowing(page)).toBe(false);
  await resetRowAndReflow(page, horizontal);
  expect((await snapshot(page)).selected).toEqual(original.selected);
});
