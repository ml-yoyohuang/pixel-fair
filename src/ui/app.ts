import type { EventView, SceneView, BoothSummary, StampCampaign, WorkDetail, RewardSnapshot } from '../domain/models';
import { VisitorRepository } from '../repositories/visitor';
import { StreetGame } from '../game/engine';
import type { InteractionTarget } from '../game/interaction';
import { AudioManager } from '../audio/manager';
import { StampService, RewardService, normalizeSearch, visibleNickname } from '../domain/services';
import { avatars } from '../assets/avatars';
import { avatarCanvas, drawActor } from '../game/art';
import { assetUrl } from '../assets/manifest';
import { renderRewardCard } from '../assets/reward-card';
import { UIRouter, eventPath } from './router';
import { el, button, paragraph, tags, section, image, safeExternal } from './dom';
const mediumLabels = { comic: '漫畫', novel: '小說', illustration: '插畫', goods: '小物' };
const availabilityLabels = { sale: '販售', free: '免費作品', display: '展示' };
export class StreetApp {
    game: StreetGame;
    audio: AudioManager;
    router: UIRouter;
    stamp = new StampService();
    reward = new RewardService();
    overlay = el('div', 'overlay');
    dialog = el('div', 'dialog');
    body = el('div', 'dialog-body');
    heading = el('h2', 'dialog-title');
    eyebrow = el('div', 'eyebrow');
    back = button('返回', () => this.router.close(), 'button ghost');
    close = button('關閉 ×', () => this.router.close(), 'button ghost');
    toast = el('div', 'toast');
    interact = button('查看', () => this.game.interact(), 'button interaction');
    greeting = el('div', 'greeting');
    progress = el('span', 'progress-label');
    positionTimer: ReturnType<typeof setTimeout> | undefined;
    toastTimer: ReturnType<typeof setTimeout> | undefined;
    avatarTimer: ReturnType<typeof setInterval> | undefined;
    onboard = false;
    lastFocus: HTMLElement | null = null;
    coffeeLine = 0;
    previewScale = 1;
    novelSize = 1;
    reveal = false;
    constructor(private root: HTMLElement, public event: EventView, public scene: SceneView, public booths: BoothSummary[], public campaigns: StampCampaign[], public visitor: VisitorRepository) {
        const canvas = el('canvas', 'street-canvas');
        canvas.setAttribute('aria-label', '黃昏故事街。點地面移動、靠近後查看；方向鍵或 WASD 移動，E 或 Enter 互動。也可用攤位目錄閱讀所有內容。');
        canvas.tabIndex = 0;
        const shell = el('main', 'game-shell'), header = el('header', 'hud');
        const title = button('黃昏故事街', () => this.router.go(`${eventPath}/info`), 'event-title');
        title.prepend(el('span', 'tiny-label', 'STORY MARKET / 2026'));
        const right = el('nav', 'hud-actions');
        right.setAttribute('aria-label', '街區選單');
        right.append(button('攤位目錄', () => this.router.go(`${eventPath}/directory`), 'button light'), button('包包', () => this.router.go(`${eventPath}/bag`), 'button light'), button('設定', () => this.router.go(`${eventPath}/settings`), 'button light'));
        header.append(title, right);
        const footer = el('footer', 'street-footer');
        footer.append(el('span', 'footer-name', 'TWILIGHT STORY STREET'), el('span', 'footer-help', '點地面走動 · 靠近後查看'), this.progress);
        const frame = el('div', 'scene-frame');
        frame.append(canvas);
        const badge = el('div', 'scene-badge');
        badge.append(el('span', 'status-dot'), el('span', '', '黃昏時分 · 虛構內容 Demo'));
        frame.append(badge, this.greeting, this.interact);
        shell.append(header, frame, footer);
        const modalHeader = el('header', 'dialog-header'), titles = el('div');
        titles.append(this.eyebrow, this.heading);
        const controls = el('div', 'dialog-controls');
        controls.append(this.back, this.close);
        modalHeader.append(titles, controls);
        this.dialog.append(modalHeader, this.body);
        this.dialog.setAttribute('role', 'dialog');
        this.dialog.setAttribute('aria-modal', 'true');
        this.dialog.setAttribute('aria-labelledby', 'panel-title');
        this.heading.id = 'panel-title';
        this.dialog.tabIndex = -1;
        this.overlay.append(this.dialog);
        this.overlay.hidden = true;
        this.interact.hidden = true;
        this.greeting.hidden = true;
        this.toast.setAttribute('role', 'status');
        this.toast.setAttribute('aria-live', 'polite');
        root.replaceChildren(shell, this.overlay, this.toast);
        this.game = new StreetGame(canvas, scene, booths, campaigns, visitor.state);
        this.audio = new AudioManager(visitor.state.settings);
        this.router = new UIRouter(path => this.renderRoute(path));
        this.game.onMessage = m => this.message(m);
        this.game.onNearby = target => this.nearby(target);
        this.game.onInteraction = target => this.openTarget(target);
        this.game.onPosition = point => { visitor.state.position = { ...point }; clearTimeout(this.positionTimer); this.positionTimer = setTimeout(() => visitor.save(), 500); };
        this.game.onStep = () => this.audio.sfx('step');
        window.addEventListener('keydown', this.keys);
        window.addEventListener('pagehide', this.pagehide);
        this.updateProgress();
        this.entry();
    }
    private pagehide = () => { this.visitor.state.position = { ...this.game.player.position }; this.visitor.save(); };
    private keys = (e: KeyboardEvent) => {
        if (this.overlay.hidden)
            return;
        if (e.key === 'Escape' && !this.onboard) {
            e.preventDefault();
            this.audio.sfx('back');
            this.router.close();
        }
        if (e.key === 'Tab') {
            const focus = Array.from(this.dialog.querySelectorAll<HTMLElement>('button,input,a,select,[tabindex="0"]')).filter(e => !e.hidden && !e.closest('[hidden]'));
            const first = focus[0], last = focus.at(-1);
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last?.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first?.focus();
            }
        }
    };
    message(message: string) { this.toast.textContent = message; this.toast.classList.add('visible'); clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => this.toast.classList.remove('visible'), 4500); }
    showPanel(title: string, label: string, wide = false) {
        if (this.overlay.hidden)
            this.lastFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.root.querySelector('main')!.inert = true;
        this.game.setModal(true);
        this.overlay.hidden = false;
        this.heading.textContent = title;
        this.eyebrow.textContent = label;
        this.body.replaceChildren();
        this.dialog.classList.toggle('wide', wide);
        this.dialog.classList.remove('entrance');
        this.close.hidden = this.onboard;
        this.back.hidden = this.onboard;
        this.audio.setReading(false);
        requestAnimationFrame(() => { this.dialog.focus(); this.body.scrollTop = 0; });
    }
    hidePanel() {
        this.overlay.hidden = true;
        this.root.querySelector('main')!.inert = false;
        this.game.setModal(false);
        this.audio.setReading(false);
        clearInterval(this.avatarTimer);
        if (this.lastFocus?.isConnected)
            this.lastFocus.focus();
    }
    entry() {
        this.onboard = true;
        this.showPanel('故事在街角，等你來。', 'STORY MARKET · 虛構內容 DEMO');
        this.dialog.classList.add('entrance');
        this.body.append(el('p', 'hero-caption', '黃昏故事街'), paragraph(this.event.tagline, 'lead'), paragraph('一條可以走動的小街，十二個創作攤位、六枚印章，還有一本想帶回家的故事。', 'intro-copy'));
        const row = el('div', 'entry-facts');
        row.append(el('span', '', '12 個原創創作攤位'), el('span', '', '點地探索'), el('span', '', '免費體驗'));
        this.body.append(row);
        if (this.visitor.state.entered)
            this.body.append(button('繼續逛展 →', () => this.start(false), 'button primary large'));
        this.body.append(button(this.visitor.state.entered ? '換個角色逛逛' : '進場逛逛 →', () => this.avatarSelection(true), 'button ' + (this.visitor.state.entered ? 'ghost' : 'primary') + ' large'));
        this.body.append(paragraph('單人 Demo · 進度儲存在此瀏覽器 · 無付款功能', 'fine-print'));
    }
    avatarSelection(entry: boolean) {
        clearInterval(this.avatarTimer);
        this.showPanel('今天，想用誰的腳步？', '選擇角色 · 人類與動物都歡迎');
        this.back.hidden = entry;
        const grid = el('div', 'avatar-grid');
        let selected = this.visitor.state.avatarId;
        for (const avatar of avatars) {
            const preview = avatarCanvas(avatar.id);
            preview.className = 'avatar-sprite';
            const choose = button('', () => {
                selected = avatar.id;
                for (const b of grid.children)
                    b.classList.toggle('selected', (b as HTMLElement).dataset.id === selected);
            }, 'avatar-option');
            choose.dataset.id = avatar.id;
            choose.classList.toggle('selected', avatar.id === selected);
            choose.setAttribute('aria-label', `${avatar.name}：${avatar.note}`);
            choose.append(preview, el('strong', '', avatar.name), el('small', '', avatar.note));
            grid.append(choose);
        }
        this.body.append(grid);
        let tick = 0;
        this.avatarTimer = setInterval(() => {
            tick += .13;
            for (const node of grid.querySelectorAll<HTMLCanvasElement>('canvas')) {
                const id = node.parentElement!.dataset.id!;
                const ctx = node.getContext('2d')!;
                ctx.clearRect(0, 0, 32, 36);
                drawActor(ctx, { id, source: 'local', sceneId: '', avatarId: id, position: { x: 1, y: 2 }, facing: ['down', 'left', 'up', 'right'][Math.floor(tick / 2) % 4] as 'down', action: id === selected ? 'walk' : 'idle' }, tick);
            }
        }, 130);
        const label = el('label', 'field-label', '暱稱（選填，最多 12 個可見字元）');
        const nickname = el('input', 'text-input');
        nickname.value = this.visitor.state.nickname;
        nickname.placeholder = '留空就是「訪客」';
        nickname.setAttribute('autocomplete', 'nickname');
        nickname.id = 'nickname';
        label.htmlFor = 'nickname';
        nickname.addEventListener('change', () => nickname.value = visibleNickname(nickname.value));
        this.body.append(label, nickname);
        const save = () => { this.visitor.state.avatarId = selected; this.visitor.state.nickname = visibleNickname(nickname.value); this.game.player.avatarId = selected; this.visitor.save(); clearInterval(this.avatarTimer); };
        if (entry) {
            const actions = el('div', 'entry-actions');
            actions.append(button('開啟音樂與音效', () => { save(); this.visitor.state.settings.music = true; this.visitor.state.settings.sfx = true; void this.audio.enable().catch(() => this.message('聲音暫時無法開啟，可在設定再試一次。')); this.start(true); }, 'button primary'), button('靜音進場', () => { save(); this.visitor.state.settings.music = false; this.visitor.state.settings.sfx = false; this.audio.apply(); this.start(true); }, 'button'));
            this.body.append(actions);
        }
        else
            this.body.append(button('儲存角色與暱稱', () => { save(); this.router.go(`${eventPath}/settings`, true); this.message('已換好角色；收藏、印章與已領紀念卡都保留。'); }, 'button primary'));
    }
    start(fresh: boolean) {
        const pending = this.router.path();
        this.onboard = false;
        this.visitor.state.entered = true;
        this.visitor.save();
        if (this.visitor.state.settings.music || this.visitor.state.settings.sfx)
            void this.audio.enable().catch(() => this.message('可在設定重新啟動聲音。'));
        this.game.start();
        this.hidePanel();
        if (pending !== eventPath) {
            this.renderRoute(pending);
        }
        else if (!this.visitor.state.tutorialSeen)
            this.router.go(`${eventPath}/tutorial`, true);
        if (fresh)
            this.message('歡迎！往前就是攤位，集章護照也幫你準備好了！');
        if (this.visitor.warning)
            this.message(this.visitor.warning);
    }
    updateProgress() { const campaign = this.campaigns[0]; this.progress.textContent = campaign ? `集章 ${this.stamp.count(this.visitor.state, campaign)} / ${campaign.requiredCount}` : '散步中'; }
    nearby(target: InteractionTarget | undefined) {
        this.interact.hidden = !target;
        this.greeting.hidden = !target;
        if (!target)
            return;
        this.interact.textContent = target.booth ? '查看 ' + target.booth.slots[0].code : '對話 / ' + target.label;
        this.greeting.replaceChildren(el('strong', '', target.label), el('span', '', target.booth?.participation.greeting ?? '靠近街角，聽一段故事。'));
    }
    openTarget(target: InteractionTarget) {
        this.audio.sfx('confirm');
        if (target.booth)
            this.router.go(`${eventPath}/booth/${target.id}`);
        else {
            const kind = target.object?.interaction;
            if (kind === 'bookshop')
                this.router.go(`${eventPath}/directory`);
            else if (kind === 'seat') {
                this.game.sit();
                this.router.go(`${eventPath}/seat`);
            }
            else
                this.router.go(`${eventPath}/${kind === 'service' ? 'info' : kind}`);
        }
    }
    navigateTo(id: string) {
        const target = this.game.interactions.targets.find(t => t.id === id);
        if (!target) {
            this.message('這個位置暫時不在此場景，仍可閱讀內容。');
            return;
        }
        if (!this.game.nav.findPath(this.game.player.position, target.anchor)) {
            this.message('到不了這裡，請從目錄查看資料。');
            return;
        }
        this.router.go(eventPath, true);
        this.game.navigate(target);
    }
    renderRoute(path: string) {
        if (this.onboard)
            return;
        clearInterval(this.avatarTimer);
        this.reveal = false;
        const parts = path.split('/').filter(Boolean);
        if (parts[0] !== 'event' || parts[1] !== this.event.id) {
            this.notFound();
            return;
        }
        const page = parts[2];
        if (!page) {
            this.hidePanel();
            return;
        }
        this.audio.sfx('confirm');
        if (page === 'booth') {
            const booth = this.booths.find(b => b.participation.id === parts[3]);
            if (!booth) {
                this.notFound();
                return;
            }
            if (parts[4] === 'work') {
                const work = booth.works.find(w => w.exhibit.id === parts[5]);
                if (!work) {
                    this.notFound();
                    return;
                }
                if (parts[6] === 'preview') {
                    if (parts[7] === 'image')
                        this.largeImage(work, parts[8]);
                    else
                        this.preview(work);
                }
                else
                    this.workPanel(booth, work);
            }
            else
                this.boothPanel(booth);
            return;
        }
        switch (page) {
            case 'directory':
                this.directory();
                break;
            case 'bag':
                this.bag();
                break;
            case 'favorites':
                this.favorites();
                break;
            case 'passport':
                this.passport();
                break;
            case 'settings':
                this.settings();
                break;
            case 'avatar':
                this.avatarSelection(false);
                break;
            case 'tutorial':
                this.tutorial();
                break;
            case 'info':
            case 'board':
                this.info(page === 'board');
                break;
            case 'print':
                this.printShop();
                break;
            case 'coffee':
                this.coffee();
                break;
            case 'seat':
                this.seat();
                break;
            case 'poster':
                this.simple('街角海報', '街角小彩蛋', '「請勿把攤主誤認為免費作品帶走。」\n底下用更小的字補了一句：店番也不行。');
                break;
            case 'reader':
                this.simple('讀書的兔子', '支巷小彩蛋', '「這裡的主角好像是我……但我還沒翻到結局！」\n兔子把書往懷裡藏了藏，又偷偷翻開下一頁。');
                break;
            default: this.notFound();
        }
    }
    notFound() { this.showPanel('這個街角還沒開張', '找不到內容'); this.body.append(paragraph('連結中的活動、攤位或作品不存在。你可以回到入口，繼續逛展。'), button('回到街道', () => this.router.go(eventPath, true), 'button primary')); }
    boothTags(b: BoothSummary) { return [...new Set(b.works.flatMap(w => [mediumLabels[w.work.medium], w.exhibit.release === 'new' ? '新作' : '精選作品', availabilityLabels[w.exhibit.availability]]))]; }
    favoriteButton(kind: 'boothFavorites' | 'workFavorites', id: string) {
        return button(this.visitor.state[kind].includes(id) ? '已收藏 · 取消' : '＋ 收藏', () => {
            this.visitor.toggle(kind, id);
            this.renderRoute(this.router.path());
            if (this.visitor.warning)
                this.message(this.visitor.warning);
        }, 'button favorite');
    }
    boothPanel(booth: BoothSummary) {
        this.showPanel(booth.circle.name, `${booth.slots.map(s => s.code).join(' / ')} · ${this.zoneName(booth.slots[0].zoneId)}`);
        const greet = el('div', 'attendant');
        const sprite = avatarCanvas(booth.participation.attendantAvatarId);
        sprite.className = 'attendant-sprite';
        greet.append(sprite, paragraph(`「${booth.participation.greeting}」`));
        this.body.append(greet, paragraph(booth.participation.intro, 'lead'), tags(this.boothTags(booth)));
        const actions = el('div', 'action-row');
        actions.append(this.favoriteButton('boothFavorites', booth.participation.id), button('帶我過去', () => this.navigateTo(booth.participation.id)));
        const campaign = this.campaigns.find(c => c.participantIds.includes(booth.participation.id));
        if (campaign) {
            const collected = (this.visitor.state.stamps[campaign.id] ?? []).includes(booth.participation.id);
            const stampButton = button(collected ? '✓ 已蓋章' : '蓋一枚印章', () => {
                if (this.stamp.collect(this.visitor.state, campaign, booth.participation.id)) {
                    this.visitor.save();
                    this.audio.sfx('stamp');
                    this.updateProgress();
                    stampButton.textContent = '✓ 已蓋章';
                    stampButton.disabled = true;
                    stampButton.classList.add('stamped');
                    this.message(this.stamp.complete(this.visitor.state, campaign) ? '集滿了！可以到影印店領紀念卡囉。' : '已收進護照，謝謝你來逛！');
                    if (this.visitor.warning)
                        this.message(this.visitor.warning);
                }
            }, 'button stamp-button');
            stampButton.disabled = collected;
            actions.append(stampButton);
        }
        this.body.append(actions);
        const list = el('div', 'work-grid');
        for (const work of booth.works) {
            const card = button('', () => this.router.go(`${eventPath}/booth/${booth.participation.id}/work/${work.exhibit.id}`), 'work-card');
            card.append(image(assetUrl(work.work.coverAssetId), work.work.title, 'cover'), el('strong', '', work.work.title), el('span', '', `${mediumLabels[work.work.medium]} · ${availabilityLabels[work.exhibit.availability]}`));
            list.append(card);
        }
        this.body.append(section('桌上的故事', list));
    }
    zoneName(id: string) { return { main: '主街', plaza: '小廣場', alley: '支巷' }[id] ?? '街區'; }
    workPanel(booth: BoothSummary, work: WorkDetail) {
        this.showPanel(work.work.title, `${booth.slots[0].code} · ${booth.circle.name}`);
        const content = el('div', 'work-detail');
        const info = el('div', 'work-copy');
        info.append(paragraph(`作者 / ${work.author}`), tags([mediumLabels[work.work.medium], work.exhibit.release === 'new' ? '新作' : '精選作品', availabilityLabels[work.exhibit.availability]]), paragraph(work.work.description, 'lead'), this.favoriteButton('workFavorites', work.exhibit.id));
        if (work.work.preview.kind !== 'none')
            info.append(button('翻開試閱 →', () => this.router.go(`${this.router.path()}/preview`), 'button primary'));
        else
            info.append(paragraph('這件作品還沒有提供試閱。', 'empty'));
        if (work.exhibit.availability === 'sale')
            info.append(button('取得作品 · ' + (work.exhibit.priceLabel ?? 'Demo'), () => this.message('這是虛構販售作品，只供 Demo 閱讀體驗，不提供付款或下單。')));
        else if (work.exhibit.availability === 'free' && work.exhibit.downloadAssetId) {
            const download = el('a', 'button', '下載免費短篇');
            download.href = assetUrl(work.exhibit.downloadAssetId);
            download.download = '給路過的你.txt';
            info.append(download);
        }
        else
            info.append(button('欣賞作品', () => this.router.go(`${this.router.path()}/preview`)));
        if (work.exhibit.url) {
            const href = safeExternal(work.exhibit.url);
            if (href) {
                const link = el('a', 'button', '作者網站');
                link.href = href;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                info.append(link);
            }
        }
        content.append(image(assetUrl(work.work.coverAssetId), work.work.title, 'cover detail-cover'), info);
        this.body.append(content, paragraph('所有創作攤位與作品為原創虛構內容。', 'fine-print'));
    }
    preview(work: WorkDetail) {
        this.showPanel(work.work.title, '試閱 · 原創內容', true);
        this.audio.setReading(true);
        if (work.work.preview.kind === 'text') {
            const control = el('div', 'action-row');
            for (let i = 0; i < 3; i++)
                control.append(button(['小字', '中字', '大字'][i], () => { this.novelSize = i; article.style.fontSize = `${[16, 19, 23][i]}px`; }));
            const article = el('article', 'novel');
            article.style.fontSize = `${[16, 19, 23][this.novelSize]}px`;
            for (const p of work.work.preview.paragraphs)
                article.append(paragraph(p));
            this.body.append(control, article);
        }
        else if (work.work.preview.kind === 'images') {
            this.body.append(paragraph('往下翻頁 · 點圖片可放大，放大後可用雙指縮放。', 'fine-print'));
            for (const [index, id] of work.work.preview.assetIds.entries()) {
                const b = button('', () => this.router.go(`${this.router.path()}/image/${id}`), 'preview-page');
                b.setAttribute('aria-label', `放大第 ${index + 1} 頁`);
                b.append(image(assetUrl(id), `${work.work.title} 試閱第 ${index + 1} 頁`));
                this.body.append(b);
            }
        }
        else
            this.body.append(paragraph('還沒有試閱內容。', 'empty'));
    }
    largeImage(work: WorkDetail, id: string) {
        if (work.work.preview.kind !== 'images' || !work.work.preview.assetIds.includes(id)) {
            this.notFound();
            return;
        }
        this.showPanel('放大閱讀', work.work.title, true);
        this.audio.setReading(true);
        const row = el('div', 'action-row');
        const img = image(assetUrl(id), `${work.work.title} 放大試閱`, 'zoom-image');
        this.previewScale = 1;
        const apply = () => { img.style.width = `${this.previewScale * 100}%`; };
        row.append(button('縮小 −', () => { this.previewScale = Math.max(.5, this.previewScale - .25); apply(); }), button('放大 ＋', () => { this.previewScale = Math.min(3, this.previewScale + .25); apply(); }), button('重設', () => { this.previewScale = 1; apply(); }));
        const viewport = el('div', 'zoom-viewport');
        viewport.append(img);
        const points = new Map<number, {
            x: number;
            y: number;
        }>();
        let initialDistance = 0, initialScale = 1;
        viewport.addEventListener('pointerdown', e => {
            points.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (points.size === 2) {
                const [a, b] = [...points.values()];
                initialDistance = Math.hypot(a.x - b.x, a.y - b.y);
                initialScale = this.previewScale;
            }
        });
        viewport.addEventListener('pointermove', e => {
            if (!points.has(e.pointerId))
                return;
            points.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (points.size === 2) {
                const [a, b] = [...points.values()];
                this.previewScale = Math.min(3, Math.max(.5, initialScale * Math.hypot(a.x - b.x, a.y - b.y) / initialDistance));
                apply();
            }
        });
        for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
            viewport.addEventListener(type, e => points.delete((e as PointerEvent).pointerId));
        this.body.append(row, viewport);
    }
    directory() {
        this.showPanel('攤位目錄', '十二個創作攤位 · 慢慢逛');
        const search = el('input', 'text-input');
        search.type = 'search';
        search.placeholder = '搜尋攤號、創作攤位或作品';
        search.setAttribute('aria-label', '搜尋攤號、創作攤位或作品');
        const filters = el('div', 'filter-row');
        const selected = new Set<string>();
        const results = el('div', 'directory-results');
        const refresh = () => {
            const q = normalizeSearch(search.value);
            const matches = this.booths.filter(b => normalizeSearch([b.slots.map(s => s.code), b.circle.name, ...b.works.map(w => w.work.title)].join(' ')).includes(q) && [...selected].every(f => f === '集章' ? this.campaigns.some(c => c.participantIds.includes(b.participation.id)) : b.works.some(w => f === '新作' ? w.exhibit.release === 'new' : f === '免費作品' ? w.exhibit.availability === 'free' : w.exhibit.availability === 'display')));
            results.replaceChildren(paragraph(`${matches.length} 個創作攤位`, 'result-count'));
            if (!matches.length) {
                results.append(paragraph('這個關鍵字還沒遇到故事。', 'empty'), button('清除搜尋與篩選', () => { search.value = ''; selected.clear(); filters.querySelectorAll('button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); }); refresh(); }));
            }
            for (const b of matches)
                results.append(this.boothRow(b));
        };
        search.addEventListener('input', refresh);
        for (const f of ['新作', '免費作品', '展示', '集章']) {
            const b = button(f, () => { selected.has(f) ? selected.delete(f) : selected.add(f); b.classList.toggle('active', selected.has(f)); b.setAttribute('aria-pressed', String(selected.has(f))); refresh(); }, 'button filter');
            b.setAttribute('aria-pressed', 'false');
            filters.append(b);
        }
        this.body.append(search, filters, results);
        refresh();
    }
    boothRow(b: BoothSummary) { const row = el('div', 'directory-row'); const intro = el('div', 'directory-copy'); intro.append(el('span', 'booth-code', b.slots[0].code), el('h3', '', b.circle.name), paragraph(b.works.map(w => w.work.title).join('、')), tags(this.boothTags(b))); const actions = el('div', 'row-actions'); actions.append(button('查看資料', () => this.router.go(`${eventPath}/booth/${b.participation.id}`), 'button light'), button('帶我過去', () => this.navigateTo(b.participation.id), 'button')); row.append(intro, actions); return row; }
    bag() {
        this.showPanel('今天的包包', '護照、故事，還有喜歡的創作攤位');
        this.body.append(button('集章護照 →', () => this.router.go(`${eventPath}/passport`), 'bag-link'), button(`收藏清單 · ${this.visitor.state.boothFavorites.length} 個創作攤位 / ${this.visitor.state.workFavorites.length} 件作品 →`, () => this.router.go(`${eventPath}/favorites`), 'bag-link'), button('攤位目錄 →', () => this.router.go(`${eventPath}/directory`), 'bag-link'));
        const campaign = this.campaigns[0];
        if (campaign && this.visitor.state.rewards[campaign.id])
            this.body.append(button('我的紀念卡 →', () => this.router.go(`${eventPath}/print`), 'bag-link'));
        this.body.append(paragraph('進度只保存在此裝置與瀏覽器。清除網站資料或換裝置後不會保留。', 'fine-print'));
    }
    favorites() {
        this.showPanel('收藏清單', '喜歡的故事，先收進包包');
        const booths = this.booths.filter(b => this.visitor.state.boothFavorites.includes(b.participation.id));
        const works = this.booths.flatMap(b => b.works.map(w => ({ b, w }))).filter(({ w }) => this.visitor.state.workFavorites.includes(w.exhibit.id));
        this.body.append(el('h3', '', '創作攤位'));
        if (!booths.length)
            this.body.append(paragraph('還沒有收藏創作攤位。去攤桌前看看吧。', 'empty'));
        for (const b of booths) {
            const row = this.boothRow(b);
            row.append(this.favoriteButton('boothFavorites', b.participation.id));
            this.body.append(row);
        }
        this.body.append(el('h3', '', '作品'));
        if (!works.length)
            this.body.append(paragraph('還沒有收藏作品。', 'empty'));
        for (const { b, w } of works) {
            const row = el('div', 'favorite-work');
            row.append(image(assetUrl(w.work.coverAssetId), w.work.title, 'tiny-cover'), el('strong', '', w.work.title), button('閱讀', () => this.router.go(`${eventPath}/booth/${b.participation.id}/work/${w.exhibit.id}`)), button('帶我過去', () => this.navigateTo(b.participation.id)), this.favoriteButton('workFavorites', w.exhibit.id));
            this.body.append(row);
        }
    }
    passport() {
        const campaign = this.campaigns[0];
        this.showPanel(campaign.title, '集章護照 · 入場已自動取得');
        this.body.append(paragraph('不必購買，也不必收藏。走進參與攤位的選單，按「蓋一枚印章」，留下一個相遇。', 'lead'));
        const count = this.stamp.count(this.visitor.state, campaign);
        this.body.append(el('div', 'passport-progress', `${count} / ${campaign.requiredCount}`));
        const grid = el('div', 'stamp-grid');
        for (const id of campaign.participantIds) {
            const b = this.booths.find(b => b.participation.id === id);
            if (!b)
                continue;
            const collected = (this.visitor.state.stamps[campaign.id] ?? []).includes(id);
            const cell = el('div', 'stamp-cell' + (collected ? ' collected' : ''));
            cell.append(el('div', 'stamp-symbol', collected ? '六景' : '待蓋章'), el('strong', '', b.slots[0].code), paragraph(b.circle.name), button('帶我過去', () => this.navigateTo(id), 'button light'));
            grid.append(cell);
        }
        this.body.append(grid);
        if (this.stamp.complete(this.visitor.state, campaign)) {
            this.body.append(paragraph('集滿了！可以到影印店領紀念卡囉。', 'completion'), button('帶我到影印店', () => this.navigateTo('print'), 'button primary'));
        }
        else
            this.body.append(paragraph('六枚印章分散在主街、廣場與支巷。每攤只記一次。', 'fine-print'));
    }
    printShop() {
        const campaign = this.campaigns[0];
        this.showPanel('街角影印店', '一張只屬於今天的紀念卡');
        if (!this.stamp.complete(this.visitor.state, campaign)) {
            this.body.append(paragraph(`還差 ${campaign.requiredCount - this.stamp.count(this.visitor.state, campaign)} 枚印章。集滿後，店員會替你留下一張黃昏的照片。`, 'lead'), button('打開護照', () => this.router.go(`${eventPath}/passport`), 'button primary'));
            return;
        }
        const reward = this.visitor.state.rewards[campaign.id];
        if (!reward) {
            this.body.append(paragraph('每張卡都有一位陪拍小夥伴和一個街角細節，各有三種等機率選擇，共九種組合。第一次領取後就固定，不會因換角色而改變。', 'lead'), button('領取我的紀念卡', () => {
                const snapshot = this.reward.issue(this.visitor.state, campaign);
                this.visitor.save();
                this.audio.sfx('reward');
                this.card(snapshot);
                if (this.visitor.warning)
                    this.message(this.visitor.warning);
            }, 'button primary large'));
        }
        else
            this.card(reward);
    }
    card(snapshot: RewardSnapshot) {
        this.body.replaceChildren();
        const card = renderRewardCard(snapshot, this.scene, this.booths, this.campaigns);
        card.className = 'reward-card';
        card.setAttribute('aria-label', `${snapshot.nicknameSnapshot} 的六景完成紀念卡`);
        const companion = { cat: '奶茶貓', dog: '豆柴', bird: '小鳥' }[snapshot.companionId] ?? snapshot.companionId;
        const detail = { books: '紙袋裡的新作', coffee: '愛心咖啡蒸氣', flyer: '腳邊的小傳單' }[snapshot.detailId] ?? snapshot.detailId;
        this.body.append(card, paragraph(`${companion} 陪你拍照 · ${detail}`, 'card-caption'));
        const download = button('下載紀念卡 PNG', () => {
            card.toBlob(blob => {
                if (!blob) {
                    this.message('暫時無法輸出圖片，請再試一次。');
                    return;
                }
                const url = URL.createObjectURL(blob);
                const a = el('a');
                a.href = url;
                a.download = '我的黃昏故事街紀念卡.png';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
            }, 'image/png');
        }, 'button primary');
        const open = button('開啟圖片 / 手機另存', () => {
            card.toBlob(blob => {
                if (!blob)
                    return;
                const url = URL.createObjectURL(blob);
                const a = el('a', 'button', '開啟圖片後，長按儲存');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                this.body.append(a);
                setTimeout(() => URL.revokeObjectURL(url), 300000);
            });
        });
        this.body.append(el('div', 'action-row'));
        this.body.lastElementChild!.append(download, open);
        this.body.append(paragraph('1600 × 1000 PNG。手機若未自動下載，選「開啟圖片」後長按另存。此卡首次領取後固定，僅存於本裝置。', 'fine-print'));
        if (this.visitor.warning)
            this.body.append(paragraph(this.visitor.warning, 'notice'));
    }
    settings() {
        this.showPanel('散步設定', '調成舒服的步調');
        const s = this.visitor.state.settings;
        const save = () => { this.visitor.save(); this.audio.apply(); this.root.style.setProperty('--text-scale', String([.94, 1, 1.12][s.textSize])); this.root.classList.toggle('reduced-motion', s.reducedMotion); };
        for (const [label, key] of [['背景音樂', 'music'], ['音效', 'sfx'], ['減少動態', 'reducedMotion']] as const) {
            const row = el('label', 'setting-row');
            const input = el('input');
            input.type = 'checkbox';
            input.checked = s[key];
            input.addEventListener('change', () => {
                s[key] = input.checked;
                if (key !== 'reducedMotion' && input.checked)
                    void this.audio.enable().catch(() => this.message('聲音暫時無法啟動。'));
                save();
            });
            row.append(el('span', '', label), input);
            this.body.append(row);
        }
        for (const [label, key] of [['音樂音量', 'musicVolume'], ['音效音量', 'sfxVolume']] as const) {
            const row = el('label', 'setting-row');
            const input = el('input');
            input.type = 'range';
            input.min = '0';
            input.max = '1';
            input.step = '.05';
            input.value = String(s[key]);
            input.addEventListener('input', () => { s[key] = Number(input.value); save(); });
            row.append(el('span', '', label), input);
            this.body.append(row);
        }
        const size = el('select');
        ['標準小字', '標準', '大字'].forEach((label, i) => { const option = el('option', '', label); option.value = String(i); size.append(option); });
        size.value = String(s.textSize);
        size.addEventListener('change', () => { s.textSize = Number(size.value); save(); });
        const sizeRow = el('label', 'setting-row');
        sizeRow.append(el('span', '', '文字大小'), size);
        this.body.append(sizeRow);
        const count = el('select');
        [0, 3, 6].forEach(n => { const option = el('option', '', `${n} 名`); option.value = String(n); count.append(option); });
        count.value = String(s.npcCount);
        count.addEventListener('change', () => { s.npcCount = Number(count.value); save(); });
        const npcRow = el('label', 'setting-row');
        npcRow.append(el('span', '', '街上散步的 NPC'), count);
        this.body.append(npcRow, button('換角色與暱稱', () => this.router.go(`${eventPath}/avatar`)), button('重看操作教學', () => this.router.go(`${eventPath}/tutorial`)));
        const clear = button('清除 Demo 紀錄', () => { const confirmation = el('div', 'clear-confirm'); confirmation.append(paragraph('確定清除這個活動的收藏、印章與紀念卡？這個動作無法復原。'), button('確定清除', () => { this.visitor.clear(this.scene.definition.spawn); this.root.style.setProperty('--text-scale', '1'); this.root.classList.remove('reduced-motion'); this.game.visitor = this.visitor.state; this.audio.settings = this.visitor.state.settings; this.audio.apply(); this.game.player.position = { x: this.scene.definition.spawn.x + .5, y: this.scene.definition.spawn.y + .5 }; this.updateProgress(); this.router.go(eventPath, true); this.entry(); }, 'button danger'), button('取消', () => confirmation.remove())); clear.after(confirmation); }, 'button danger ghost');
        this.body.append(section('本機紀錄', paragraph('收藏、集章與獎勵依活動隔離。換角色不清除紀錄；清除站點資料或換裝置會失去進度。'), clear));
    }
    tutorial() { this.showPanel('街上慢慢走', '操作教學 · 隨時可從服務處重看'); this.body.append(section('01 / 點地面，走過去', paragraph('點一下地面，角色會沿合法路徑走。再點別處就改道；桌子、牆壁與樹不能穿過。')), section('02 / 到攤桌前，再查看', paragraph('點遠處的攤桌，會先走到桌前，不會自動開啟面板。靠近後，按畫面下方的「查看」。')), section('03 / 找故事、集印章', paragraph('攤位目錄可搜尋、篩選與直接閱讀。按「帶我過去」沿街走到攤位。六章集滿後，到影印店領紀念卡。')), section('桌機操作', paragraph('方向鍵 / WASD 移動 · Enter / E 查看 · Esc 逐層返回。輸入框不會觸發角色移動。'))); const done = () => { this.visitor.state.tutorialSeen = true; this.visitor.save(); this.router.go(eventPath, true); }; this.body.append(button('知道了，去逛逛 →', done, 'button primary'), button('略過教學', done, 'button ghost')); }
    info(board = false) {
        this.showPanel(board ? '廣場公告欄' : '入口服務處', 'STORY MARKET · 線上原創市集');
        this.body.append(paragraph(this.event.tagline, 'lead'));
        for (const notice of this.event.announcements)
            this.body.append(paragraph(notice, 'notice'));
        this.body.append(tags(['主街 6 攤', '廣場 4 攤', '支巷 2 攤']), button('開啟攤位目錄', () => this.router.go(`${eventPath}/directory`), 'button primary'), button('集章企劃與護照', () => this.router.go(`${eventPath}/passport`)), button('重看操作教學', () => this.router.go(`${eventPath}/tutorial`)), paragraph('Demo 不受日期限制。活動時區 Asia/Taipei；真實開放日期將由未來伺服器判定。店番與 NPC 均為虛構角色，不代表攤主在線。', 'fine-print'));
    }
    coffee() { this.showPanel('慢慢咖啡', '咖啡店員 · 街角小彩蛋'); const lines = ['「剛煮好的咖啡，聞起來像明天的好天氣。」', '「那邊的兔子每次都點一杯，讀到打烊。」', '「如果故事太長，就讓咖啡陪你慢慢讀。」']; const line = paragraph(lines[this.coffeeLine % 3], 'lead'); this.body.append(line, button('再聊一句', () => { line.textContent = lines[++this.coffeeLine % 3]; }), button('帶我到街邊座位', () => this.navigateTo('seat'), 'button primary')); }
    seat() { this.showPanel('在晚風裡坐一下', '慢慢咖啡 · 街邊座位'); this.body.append(paragraph('角色坐下了。看書的兔子翻了一頁，咖啡還冒著熱氣。關閉面板可繼續休息；點地面就起身。', 'lead'), button('離開座位', () => { this.game.player.action = 'idle'; this.router.go(eventPath, true); }, 'button primary')); }
    simple(title: string, label: string, copy: string) { this.showPanel(title, label); this.body.append(paragraph(copy, 'lead')); }
    destroy() { this.game.destroy(); this.audio.destroy(); this.router.destroy(); clearInterval(this.avatarTimer); clearTimeout(this.toastTimer); clearTimeout(this.positionTimer); window.removeEventListener('keydown', this.keys); window.removeEventListener('pagehide', this.pagehide); }
}
