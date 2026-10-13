import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = '/event/twilight-only';
mkdirSync('docs/screenshots', { recursive: true });
async function enter(page: Page) { await page.goto('/'); await page.getByRole('button', { name: '進場逛逛 →', exact: true }).click(); await page.getByRole('button', { name: /奶茶貓：/ }).click(); await page.getByLabel('暱稱').fill('小夏'); await page.getByRole('button', { name: '靜音進場', exact: true }).click(); await page.getByRole('button', { name: '知道了，去逛逛 →' }).click(); }
async function walkTo(page: Page, code: string) { await page.getByRole('button', { name: '攤位目錄', exact: true }).click(); await page.getByRole('searchbox').fill(code); await page.getByRole('button', { name: '帶我過去', exact: true }).click(); await expect(page.locator('.overlay')).toBeHidden(); await expect(page.locator('.interaction')).toHaveText(`查看 ${code}`, { timeout: 22000 }); await page.locator('.interaction').click(); }
test('full visit: walk, read, collect six stamps, claim PNG and persist the same recipe', async ({ page }) => {
    test.setTimeout(150000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {
        if (r.status() >= 400)
            errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('/');
    await page.screenshot({ path: 'docs/screenshots/entrance-1280.png' });
    await enter(page);
    await page.screenshot({ path: 'docs/screenshots/street-1280.png' });
    await walkTo(page, 'A01');
    await page.getByRole('button', { name: '＋ 收藏', exact: true }).click();
    await page.getByRole('button', { name: '蓋一枚印章', exact: true }).click();
    await page.getByRole('button', { name: /寄給明天的信 漫畫/ }).click();
    await page.getByRole('button', { name: '翻開試閱 →', exact: true }).click();
    await expect(page.locator('.preview-page')).toHaveCount(3);
    await page.locator('.preview-page').first().click();
    await page.getByRole('button', { name: '放大 ＋' }).click();
    await page.getByRole('button', { name: '返回', exact: true }).click();
    await page.goBack();
    await expect(page.getByRole('button', { name: '翻開試閱 →' })).toBeVisible();
    await page.getByRole('button', { name: '＋ 收藏', exact: true }).click();
    await page.getByRole('button', { name: '關閉 ×', exact: true }).click();
    await page.getByRole('button', { name: '關閉 ×', exact: true }).click();
    for (const code of ['A03', 'A05', 'A07', 'A09', 'A11']) {
        await walkTo(page, code);
        await page.getByRole('button', { name: '蓋一枚印章', exact: true }).click();
        await page.getByRole('button', { name: '關閉 ×', exact: true }).click();
    }
    await page.getByRole('button', { name: '包包', exact: true }).click();
    await page.getByRole('button', { name: '集章護照 →' }).click();
    await expect(page.locator('.passport-progress')).toHaveText('6 / 6');
    await page.screenshot({ path: 'docs/screenshots/passport-1280.png' });
    await page.getByRole('button', { name: '帶我到影印店' }).click();
    await expect(page.locator('.interaction')).toHaveText('對話 / 街角影印店', { timeout: 22000 });
    await page.locator('.interaction').click();
    await page.getByRole('button', { name: '領取我的紀念卡', exact: true }).click();
    await expect(page.locator('.reward-card')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/reward-1280.png' });
    const before = await page.evaluate(() => JSON.parse(localStorage.getItem('fan-street:v2:twilight-only')!).rewards);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '下載紀念卡 PNG', exact: true }).click();
    const download = await downloadPromise;
    await download.saveAs('docs/screenshots/reward-card.png');
    await page.reload();
    await page.getByRole('button', { name: '繼續逛展 →' }).click();
    await expect(page.locator('.reward-card')).toBeVisible();
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('fan-street:v2:twilight-only')!).rewards);
    expect(after).toEqual(before);
    await page.getByRole('button', { name: '關閉 ×', exact: true }).click();
    await page.getByRole('button', { name: '包包', exact: true }).click();
    await page.getByRole('button', { name: /收藏清單/ }).click();
    await expect(page.getByRole('heading', { name: '雨後郵局', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});
test('movement input, collision, modal stop and NPC navigation', async ({ page }) => { await enter(page); await walkTo(page, 'A01'); await page.getByRole('button', { name: '關閉 ×', exact: true }).click(); const state = () => page.evaluate(() => { const app = (window as any).streetDemo; return { position: app.game.player.position, path: app.game.movement.path, modal: app.game.modal, npcs: app.game.npcs.entries.map((e: any) => e.actor.position), fps: app.game.fps }; }); const first = await state(); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowUp'); const againstWall = await state(); expect(Math.floor(againstWall.position.y)).toBe(11); await page.getByRole('button', { name: '攤位目錄', exact: true }).click(); await page.getByRole('searchbox').fill('Ａ１２'); await expect(page.locator('.directory-row')).toHaveCount(1); await page.getByRole('button', { name: '帶我過去', exact: true }).click(); await page.waitForTimeout(300); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(300); await page.keyboard.up('ArrowDown'); expect((await state()).path).toHaveLength(0); await page.getByRole('button', { name: '設定', exact: true }).click(); await page.getByRole('button', { name: '換角色與暱稱', exact: true }).click(); const stationary = (await state()).position; await page.getByLabel('暱稱').fill('wasd'); await page.getByLabel('暱稱').press('ArrowLeft'); expect((await state()).position).toEqual(stationary); await page.getByRole('button', { name: '儲存角色與暱稱', exact: true }).click(); await page.getByRole('button', { name: '關閉 ×', exact: true }).click(); await page.waitForTimeout(1500); const last = await state(); expect(last.path).toHaveLength(0); expect(last.npcs).not.toEqual(first.npcs); const invalid = await page.evaluate(() => { const app = (window as any).streetDemo; return app.game.npcs.entries.some((e: any) => !app.game.nav.walkable(e.actor.position)); }); expect(invalid).toBe(false); writeFileSync('docs/screenshots/performance.json', JSON.stringify({ desktopFps: last.fps, viewport: '1280x720', browser: 'Chromium (installed Chrome)', measurement: 'Smoothed RAF interval during headless automated interaction; not physical-device benchmark.' }, null, 2)); });
test('deep link, browser Back, free file and empty results', async ({ page }) => { await page.goto(`/#${base}/booth/part-tide/work/exhibit-tide/preview`); await page.getByRole('button', { name: '進場逛逛 →' }).click(); await page.getByRole('button', { name: '靜音進場', exact: true }).click(); await expect(page.locator('.novel p')).toHaveCount(6); await page.getByRole('button', { name: '大字', exact: true }).click(); await page.goBack(); await expect(page.getByRole('button', { name: '翻開試閱 →' })).toBeVisible(); await page.goBack(); await expect(page.getByRole('heading', { name: '紙上潮汐', exact: true })).toBeVisible(); await page.getByRole('button', { name: '關閉 ×', exact: true }).click(); await page.getByRole('button', { name: '攤位目錄', exact: true }).click(); await page.getByRole('searchbox').fill('不存在'); await expect(page.locator('.directory-row')).toHaveCount(0); await page.getByRole('button', { name: '清除搜尋與篩選' }).click(); await expect(page.locator('.directory-row')).toHaveCount(12); await page.getByRole('searchbox').fill('A11'); await page.getByRole('button', { name: '查看資料', exact: true }).click(); await page.getByRole('button', { name: /給路過的你 小說/ }).click(); const download = page.waitForEvent('download'); await page.getByRole('link', { name: '下載免費短篇' }).click(); expect((await download).suggestedFilename()).toContain('.txt'); });
for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 844, height: 390 }])
    test(`mobile layout ${viewport.width}x${viewport.height}`, async ({ page }) => { await page.setViewportSize(viewport); await enter(page); await page.screenshot({ path: `docs/screenshots/street-${viewport.width}.png` }); await page.getByRole('button', { name: '攤位目錄', exact: true }).click(); await page.screenshot({ path: `docs/screenshots/directory-${viewport.width}.png` }); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); expect(overflow).toBe(false); const buttonSizes = await page.locator('button:visible').evaluateAll(buttons => buttons.map(b => b.getBoundingClientRect().height)); expect(buttonSizes.every(h => h >= 44)).toBe(true); await page.getByRole('searchbox').fill('A01'); await page.getByRole('button', { name: '查看資料', exact: true }).click(); await page.getByRole('button', { name: /寄給明天的信 漫畫/ }).click(); await page.getByRole('button', { name: '翻開試閱 →' }).click(); await expect(page.locator('.preview-page')).toHaveCount(3); });
test('broken storage, blocked writes and resource errors remain usable', async ({ page }) => { await page.addInitScript(() => { localStorage.setItem('fan-street:v2:twilight-only', 'broken'); }); await enter(page); await page.getByRole('button', { name: '設定', exact: true }).click(); await expect(page.getByRole('button', { name: '清除 Demo 紀錄', exact: true })).toBeVisible(); await page.goto('/?fail'); await expect(page.getByRole('button', { name: '重新點亮街燈' })).toBeVisible(); await page.goto('/?empty'); await page.getByRole('button', { name: '進場逛逛 →' }).click(); await page.getByRole('button', { name: '靜音進場', exact: true }).click(); await page.getByRole('button', { name: '知道了，去逛逛 →' }).click(); await page.getByRole('button', { name: '攤位目錄', exact: true }).click(); await expect(page.locator('.directory-row')).toHaveCount(0); });
