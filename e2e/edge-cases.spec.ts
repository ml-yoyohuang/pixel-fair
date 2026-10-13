import { test, expect, type Page } from '@playwright/test';
const base = '/event/twilight-only';
async function enter(page: Page, url = '/') { await page.goto(url); await page.getByRole('button', { name: '進場逛逛 →', exact: true }).click(); await page.getByRole('button', { name: '靜音進場', exact: true }).click(); await page.getByRole('button', { name: '知道了，去逛逛 →' }).click(); }
async function route(page: Page, path: string) { await page.evaluate(path => location.hash = path, path); }
async function worldPoint(page: Page, x: number, y: number) { return page.evaluate(({ x, y }) => { const app = (window as any).streetDemo; const renderer = app.game.renderer; const box = renderer.canvas.getBoundingClientRect(); return { x: box.left + (x * 16 - renderer.camera.x) * box.width / renderer.canvas.width, y: box.top + (y * 16 - renderer.camera.y) * box.height / renderer.canvas.height }; }, { x, y }); }
test('pointer ground, drag threshold and distant booth use legal anchors without auto-opening', async ({ page }) => {
    await enter(page);
    const lamp = await worldPoint(page, 6.5, 13.5);
    await page.mouse.click(lamp.x, lamp.y);
    await expect(page.locator('.toast')).toHaveText('這裡走不到喔');
    const table = await worldPoint(page, 8.5, 9.5);
    await page.mouse.click(table.x, table.y);
    await expect(page.locator('.interaction')).toHaveText('查看 A01');
    await expect.poll(() => page.evaluate(() => { const a = (window as any).streetDemo; return Math.hypot(a.game.player.position.x - 9.5, a.game.player.position.y - 11.5); })).toBeLessThan(.05);
    await expect(page.locator('.overlay')).toBeHidden();
    const ground = await worldPoint(page, 10.5, 13.5);
    const before = await page.evaluate(() => (window as any).streetDemo.game.player.position);
    await page.mouse.move(ground.x, ground.y);
    await page.mouse.down();
    await page.mouse.move(ground.x + 25, ground.y + 25);
    await page.mouse.up();
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => (window as any).streetDemo.game.player.position)).toEqual(before);
    await page.mouse.click(ground.x, ground.y);
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '包包', exact: true }).click();
    expect(await page.evaluate(() => (window as any).streetDemo.game.movement.path)).toHaveLength(0);
});
test('sound needs a gesture, has one context and ducks in preview without changing saved volume', async ({ page }) => {
    await enter(page);
    expect(await page.evaluate(() => (window as any).streetDemo.audio.context)).toBeNull();
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByLabel('背景音樂', { exact: true }).check();
    await page.getByLabel('音效', { exact: true }).check();
    await expect.poll(() => page.evaluate(() => (window as any).streetDemo.audio.context.state)).toBe('running');
    await page.evaluate(() => { (window as any).originalAudioContext = (window as any).streetDemo.audio.context; });
    await route(page, `${base}/booth/part-mail/work/exhibit-mail/preview`);
    await page.waitForTimeout(600);
    const duck = await page.evaluate(() => { const a = (window as any).streetDemo.audio; return { gain: a.musicGain.gain.value, volume: a.settings.musicVolume, duck: a.duck, same: a.context === (window as any).originalAudioContext }; });
    expect(duck.gain).toBeCloseTo(duck.volume * .4, 1);
    expect(duck.duck).toBe(true);
    expect(duck.same).toBe(true);
    await route(page, `${base}/settings`);
    await page.getByLabel('背景音樂', { exact: true }).uncheck();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).streetDemo.audio.musicGain.gain.value)).toBeLessThan(.01);
    await route(page, `${base}/booth/part-mail/work/exhibit-mail/preview`);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as any).streetDemo.audio.musicGain.gain.value)).toBeLessThan(.01);
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('fan-street:v2:twilight-only')!).settings);
    expect(settings.music).toBe(false);
    expect(settings.sfx).toBe(true);
    expect(settings.musicVolume).toBe(.28);
});
test('blocked storage keeps one reward, unchanged after avatar selection', async ({ page }) => {
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); }; });
    await enter(page);
    for (const id of ['mail', 'repair', 'star', 'plant', 'pocket', 'page']) {
        await route(page, `${base}/booth/part-${id}`);
        await page.getByRole('button', { name: '蓋一枚印章', exact: true }).click();
        await expect(page.getByRole('button', { name: '✓ 已蓋章', exact: true })).toBeDisabled();
    }
    await route(page, `${base}/print`);
    await page.getByRole('button', { name: '領取我的紀念卡', exact: true }).click();
    await expect(page.locator('.notice')).toContainText('無法保留到下次');
    const before = await page.evaluate(() => (window as any).streetDemo.visitor.state.rewards);
    await route(page, `${base}/avatar`);
    await page.getByRole('button', { name: /白兔：/ }).click();
    await page.getByLabel('暱稱').fill('新名字');
    await page.getByRole('button', { name: '儲存角色與暱稱', exact: true }).click();
    await route(page, `${base}/print`);
    await expect(page.locator('.reward-card')).toBeVisible();
    expect(await page.evaluate(() => (window as any).streetDemo.visitor.state.rewards)).toEqual(before);
});
test('missing preview image retries and small test scene is actually playable', async ({ page }) => {
    await page.route('**/assets/preview-mail-1.svg', r => r.abort());
    await enter(page);
    await route(page, `${base}/booth/part-mail/work/exhibit-mail/preview`);
    await expect(page.getByRole('button', { name: '重新載入', exact: true })).toBeVisible();
    await page.unroute('**/assets/preview-mail-1.svg');
    await page.getByRole('button', { name: '重新載入', exact: true }).click();
    await expect(page.getByRole('img', { name: '寄給明天的信 試閱第 1 頁' })).toBeVisible();
    await page.goto('/?scene=test');
    await page.getByRole('button', { name: '繼續逛展 →' }).click();
    expect(await page.evaluate(() => (window as any).streetDemo.game.scene.definition.id)).toBe('test-yard');
    await page.getByRole('button', { name: '攤位目錄', exact: true }).click();
    await page.getByRole('searchbox').fill('A01');
    await page.getByRole('button', { name: '帶我過去', exact: true }).click();
    await expect(page.locator('.interaction')).toHaveText('查看 A01');
});
test('public shops, sitting, three easter eggs, unknown links and clear confirmation', async ({ page }) => {
    await enter(page);
    await route(page, `${base}/coffee`);
    const first = await page.locator('.lead').textContent();
    await page.getByRole('button', { name: '再聊一句' }).click();
    expect(await page.locator('.lead').textContent()).not.toBe(first);
    await route(page, `${base}/seat`);
    await page.getByRole('button', { name: '離開座位' }).click();
    expect(await page.evaluate(() => (window as any).streetDemo.game.player.action)).toBe('idle');
    await route(page, `${base}/poster`);
    await expect(page.locator('.lead')).toContainText('攤主誤認為免費作品');
    await route(page, `${base}/reader`);
    await expect(page.locator('.lead')).toContainText('結局');
    await route(page, `${base}/board`);
    await expect(page.getByRole('heading', { name: '廣場公告欄', exact: true })).toBeVisible();
    await route(page, `${base}/booth/no-such-id`);
    await page.getByRole('button', { name: '回到街道' }).click();
    await page.getByRole('button', { name: '設定', exact: true }).click();
    await page.getByRole('button', { name: '清除 Demo 紀錄', exact: true }).click();
    await expect(page.getByRole('button', { name: '確定清除' })).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    expect(await page.evaluate(() => (window as any).streetDemo.visitor.state.entered)).toBe(true);
});
test('mobile sustained frame interval sample', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await enter(page);
    const sample = await page.evaluate(() => new Promise<{
        frames: number;
        elapsedMs: number;
        fps: number;
    }>(resolve => { let frames = 0; const started = performance.now(); const sample = () => { frames++; const elapsed = performance.now() - started; if (elapsed >= 4000)
        resolve({ frames, elapsedMs: elapsed, fps: frames / (elapsed / 1000) });
    else
        requestAnimationFrame(sample); }; requestAnimationFrame(sample); }));
    const { writeFileSync } = await import('node:fs');
    writeFileSync('docs/screenshots/performance-mobile.json', JSON.stringify({ viewport: '390x844', browser: 'installed Chrome headless', ...sample, physicalDevice: false }, null, 2));
    expect(sample.fps).toBeGreaterThan(30);
});
