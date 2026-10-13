import './styles/app.css';
import { MockRepository } from './repositories/content';
import { VisitorRepository, safeStorage } from './repositories/visitor';
import { preload } from './assets/manifest';
import { StreetApp } from './ui/app';
import { el, paragraph, button } from './ui/dom';
const root = document.querySelector<HTMLElement>('#app')!;
async function boot() {
    const loading = el('div', 'loading');
    const progress = el('progress');
    progress.max = 1;
    progress.value = 0;
    loading.append(el('div', 'eyebrow', 'STORY MARKET'), el('h1', '', '正在把街燈點亮'), paragraph('整理桌上的書本，準備今晚的散步。'), progress);
    root.replaceChildren(loading);
    try {
        const params = new URLSearchParams(location.search);
        const repo = new MockRepository({ scene: import.meta.env.DEV ? params.get('scene') ?? undefined : undefined, fail: import.meta.env.DEV && params.has('fail'), empty: import.meta.env.DEV && params.has('empty') });
        const [event, scene, booths, campaigns] = await Promise.all([repo.getEvent('twilight-only'), repo.getScene('dusk-street'), repo.listBooths('twilight-only'), repo.listCampaigns('twilight-only'), preload(n => progress.value = n)]);
        const visitor = new VisitorRepository(event.id, scene.definition.spawn, safeStorage());
        const app = new StreetApp(root, event, scene, booths, campaigns, visitor);
        root.style.setProperty('--text-scale', String([.94, 1, 1.12][visitor.state.settings.textSize]));
        root.classList.toggle('reduced-motion', visitor.state.settings.reducedMotion);
        if (import.meta.env.DEV)
            Object.assign(window, { streetDemo: app });
    }
    catch (error) {
        loading.replaceChildren(el('h1', '', '這條街暫時還沒準備好'), paragraph(error instanceof Error ? error.message : '讀取失敗。'), button('重新點亮街燈', boot, 'button primary'));
    }
}
void boot();
