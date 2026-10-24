import './admin.css';
import { SupabaseAdminClient, type ContentAuditEntry, type ContentDocument, type TotpFactor } from './supabase-client';
import { validateContentDocument, validateContentImport } from './document-validation';
import { manifest } from '../assets/manifest';

const root = document.querySelector<HTMLElement>('#admin-root')!;
const collections = ['venues', 'layouts', 'events', 'scenes', 'slots', 'circles', 'participations', 'assignments', 'works', 'exhibits', 'campaigns'];
const labels: Record<string, string> = { venues: '場館', layouts: '場地配置', events: '活動', scenes: '場景', slots: '攤位位置', circles: '創作團體', participations: '參展資料', assignments: '位置分配', works: '作品', exhibits: '出展作品', campaigns: '集章活動' };
const descriptions: Record<string, string> = {
    venues: '必填：name。先建立場館，場地配置會用 venueId 引用它。',
    layouts: '必填：venueId、version、width、height。version 是正整數；寬高各為 1 到 128 格。',
    events: '必填：name、tagline、layoutId、venueId、sceneId、startsAt、endsAt、timezone、announcements。日期用 ISO 格式且結束晚於開始；時區用 Asia/Taipei 這類 IANA 名稱。活動 ID 會同時作為 event_id；發布活動前需先發布集章活動。',
    scenes: '必填：width、height、spawn、ground、objects、npcWaypoints。寬高各為 1 到 128 格，spawn 和 NPC 座標需在場景範圍內；巢狀地圖仍需編輯 JSON。',
    slots: '必填：layoutId、code、zoneId、origin、width、height、facing、interactionAnchors、npcStopPoints。寬高各為 1 到 128 格；攤位與互動點都必須位於場地配置邊界內。',
    circles: '必填：name、author。參展資料與作品都會引用創作團體。',
    participations: '必填：eventId、circleId、intro、greeting、attendantAvatarId、decoration、status。eventId 會和上方活動 ID 同步。',
    assignments: '必填：id、participationId、slotIds。slotIds 是此攤位使用的位置 ID 陣列。',
    works: '必填：circleId、title、medium、coverAssetId、description、preview。試閱格式：{ "kind": "none" }、{ "kind": "text", "paragraphs": [] } 或 { "kind": "images", "assetIds": [] }。',
    exhibits: '必填：participationId、workId、release、availability、demoOnly。外部 url 僅允許 http:// 或 https://。',
    campaigns: '必填：eventId、title、participantIds、requiredCount、rewardRecipeId。participantIds 是參展資料 ID 陣列；requiredCount 不可大於陣列長度。'
};
const env = import.meta.env as ImportMetaEnv & { VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string };
let client: SupabaseAdminClient | null = null;
let documents: ContentDocument[] = [];

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
}

const fieldLabels: Record<string, string> = {
    name: '名稱', author: '作者', venueId: '場館 ID', layoutId: '場地配置 ID', sceneId: '場景 ID', version: '版本', width: '寬度（格）', height: '高度（格）',
    tagline: '活動標語', startsAt: '開始時間（ISO 格式）', endsAt: '結束時間（ISO 格式）', timezone: '時區', announcements: '公告（每行一則）',
    code: '攤位代碼', zoneId: '區域 ID', origin: '位置座標（JSON）', facing: '攤位面向', interactionAnchors: '互動座標（JSON 陣列）', npcStopPoints: 'NPC 停靠座標（JSON 陣列）',
    circleId: '創作團體 ID', eventId: '活動 ID', intro: '團體介紹', greeting: '攤位招呼', attendantAvatarId: '攤主角色 ID', decoration: '攤位裝飾（JSON）', status: '狀態',
    participationId: '參展資料 ID', slotIds: '攤位位置 ID（每行一個）', title: '標題', medium: '作品媒材', coverAssetId: '封面素材 ID', description: '作品介紹', preview: '試閱內容（JSON）',
    workId: '作品 ID', release: '發行狀態', availability: '供應方式', priceLabel: '價格文字（可留空）', url: '外部連結（可留空）', downloadAssetId: '下載素材 ID（可留空）', demoOnly: '僅供展示',
    participantIds: '參與者 ID（每行一個）', requiredCount: '完成章數', rewardRecipeId: '獎勵配方 ID', spawn: '玩家出生座標（JSON）', ground: '地面區塊（JSON 陣列）', objects: '場景物件（JSON 陣列）', npcWaypoints: 'NPC 路徑座標（JSON 陣列）', rewardViewPoint: '獎勵視角座標（JSON，可留空）'
};
const optionalEditorFields: Record<string, string[]> = { exhibits: ['priceLabel', 'url', 'downloadAssetId'], scenes: ['rewardViewPoint'] };
const editorChoices: Record<string, Array<[string, string]>> = {
    facing: [['up', '上'], ['down', '下'], ['left', '左'], ['right', '右']],
    medium: [['comic', '漫畫'], ['novel', '小說'], ['illustration', '插畫'], ['goods', '周邊']],
    status: [['published', '已發布']], release: [['new', '新刊'], ['existing', '既刊']],
    availability: [['sale', '販售'], ['free', '免費'], ['display', '展示']]
};
const lineEditorFields = new Set(['announcements', 'slotIds', 'participantIds']);
const referenceCollections: Record<string, string> = { venueId: 'venues', layoutId: 'layouts', sceneId: 'scenes', circleId: 'circles', participationId: 'participations', workId: 'works' };
const arrayReferenceCollections: Record<string, string> = { slotIds: 'slots', participantIds: 'participations' };
const staticReferenceOptions: Record<string, Array<[string, string]>> = {
    attendantAvatarId: [['human-amber', '小杏'], ['human-blue', '阿澄'], ['human-sage', '青禾'], ['cat', '奶茶貓'], ['dog', '豆柴'], ['rabbit', '白兔']],
    rewardRecipeId: [['dusk-card-v1', '黃昏紀念卡']]
};

function createDocumentFields(parent: HTMLElement, collection: string, data: Record<string, unknown>, onInput: () => void): () => Record<string, unknown> {
    const controls = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
    const keys = [...Object.keys(data), ...(optionalEditorFields[collection] ?? [])].filter((key, index, all) => key !== 'id' && key !== 'eventId' && all.indexOf(key) === index);
    parent.replaceChildren();
    for (const key of keys) {
        const value = data[key];
        let control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
        let suggestions: HTMLDataListElement | null = null;
        const choices = editorChoices[key];
        if (choices) {
            const select = node('select');
            for (const [optionValue, optionLabel] of choices) { const option = node('option', optionLabel); option.value = optionValue; select.append(option); }
            if (typeof value === 'string' && choices.some(([optionValue]) => optionValue === value)) select.value = value;
            control = select;
        } else if (typeof value === 'boolean') {
            const input = node('input'); input.type = 'checkbox'; input.checked = value; control = input;
        } else if (typeof value === 'number') {
            const input = node('input'); input.type = 'number'; input.step = '1'; input.value = String(value);
            if (['width', 'height', 'version', 'requiredCount'].includes(key)) input.min = '1';
            control = input;
        } else if (lineEditorFields.has(key) || (Array.isArray(value) && value.every(item => typeof item === 'string'))) {
            const textarea = node('textarea'); textarea.className = 'admin-lines-input';
            textarea.value = (value as string[] | undefined)?.join('\n') ?? '';
            control = textarea;
        } else if (value !== null && typeof value === 'object') {
            const textarea = node('textarea'); textarea.className = 'admin-json-input'; textarea.spellcheck = false; textarea.value = JSON.stringify(value, null, 2);
            control = textarea;
        } else {
            const input = node('input'); input.type = 'text'; input.value = typeof value === 'string' ? value : '';
            if (!optionalEditorFields[collection]?.includes(key)) input.required = true;
            const referenceCollection = referenceCollections[key];
            const referenceValues = referenceCollection
                ? documents.filter(document => document.collection === referenceCollection).map(document => {
                    const display = document.data.name ?? document.data.title ?? document.data.code ?? document.id;
                    return [document.id, `${String(display)} · ${document.id} · ${document.event_id}`] as [string, string];
                })
                : key === 'coverAssetId' || key === 'downloadAssetId'
                    ? manifest.filter(asset => key === 'downloadAssetId' ? asset.kind === 'download' : asset.kind === 'image').map(asset => [asset.id, asset.id] as [string, string])
                    : staticReferenceOptions[key];
            if (referenceValues?.length) {
                suggestions = node('datalist'); suggestions.id = `suggest-${collection}-${key}`;
                for (const [optionValue, optionLabel] of referenceValues) { const option = node('option'); option.value = optionValue; option.label = optionLabel; suggestions.append(option); }
                input.setAttribute('list', suggestions.id);
            }
            control = input;
        }
        controls.set(key, control);
        control.addEventListener('input', onInput);
        control.addEventListener('change', onInput);
        parent.append(field(fieldLabels[key] ?? key, control));
        if (suggestions) parent.append(suggestions);
        if (control instanceof HTMLTextAreaElement && control.classList.contains('admin-json-input')) parent.append(node('p', '這個欄位包含巢狀資料，請維持 JSON 格式。可在下方進階編輯區查看範例。', 'admin-muted'));
        if (control instanceof HTMLTextAreaElement && arrayReferenceCollections[key]) {
            const candidates = documents.filter(document => document.collection === arrayReferenceCollections[key]).map(document => `${document.id}（${String(document.data.name ?? document.data.title ?? document.data.code ?? document.id)}）`);
            const sample = candidates.slice(0, 20).join('、');
            const more = candidates.length > 20 ? `，另有 ${candidates.length - 20} 項` : '';
            parent.append(node('p', candidates.length ? `可用 ID：${sample}${more}` : '先建立並儲存引用資料，再回來填入 ID。', 'admin-muted'));
        }
    }
    return () => {
        const result: Record<string, unknown> = {};
        for (const [key, control] of controls) {
            if (control instanceof HTMLInputElement && control.type === 'checkbox') result[key] = control.checked;
            else if (control instanceof HTMLInputElement && control.type === 'number') result[key] = control.value === '' ? '' : Number(control.value);
            else if (control instanceof HTMLTextAreaElement && control.classList.contains('admin-json-input')) {
                if (optionalEditorFields[collection]?.includes(key) && !control.value.trim()) { result[key] = undefined; continue; }
                result[key] = JSON.parse(control.value);
            } else if (control instanceof HTMLTextAreaElement) result[key] = control.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
            else {
                const value = control.value.trim();
                if (optionalEditorFields[collection]?.includes(key) && !value) { result[key] = undefined; continue; }
                result[key] = value;
            }
        }
        return result;
    };
}

function button(text: string, action: () => void, variant = '') {
    const result = node('button', text, `admin-button ${variant}`.trim());
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
}
function field(labelText: string, input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
    const label = node('label', undefined, 'admin-field');
    label.append(node('span', labelText), input);
    return label;
}
function statusLine(parent: HTMLElement) {
    const line = node('p', '', 'admin-status');
    parent.append(line);
    return line;
}
function templateFor(collection: string, eventId = 'twilight-only'): Record<string, unknown> {
    const id = '';
    const futureIsoDate = (daysAhead: number) => new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
    const templates: Record<string, Record<string, unknown>> = {
        venues: { id, name: '' },
        layouts: { id, venueId: '', version: 1, width: 52, height: 32 },
        events: { id, name: '', tagline: '', layoutId: '', venueId: '', sceneId: '', startsAt: futureIsoDate(7), endsAt: futureIsoDate(37), timezone: 'Asia/Taipei', announcements: [] },
        scenes: { id, width: 52, height: 32, spawn: { x: 5, y: 12 }, ground: [], objects: [], npcWaypoints: [] },
        slots: { id, layoutId: '', code: '', zoneId: '', origin: { x: 0, y: 0 }, width: 3, height: 2, facing: 'down', interactionAnchors: [], npcStopPoints: [] },
        circles: { id, name: '', author: '' },
        participations: { id, eventId, circleId: '', intro: '', greeting: '', attendantAvatarId: 'human-amber', decoration: { tableclothId: '', signId: '', propIds: [] }, status: 'published' },
        assignments: { id, participationId: '', slotIds: [] },
        works: { id, circleId: '', title: '', medium: 'comic', coverAssetId: '', description: '', preview: { kind: 'none' } },
        exhibits: { id, participationId: '', workId: '', release: 'new', availability: 'display', demoOnly: true },
        campaigns: { id, eventId, title: '', participantIds: [], requiredCount: 1, rewardRecipeId: 'dusk-card-v1' }
    };
    return templates[collection] ?? { id };
}
function shell(title: string) {
    const page = node('div', undefined, 'admin-shell');
    const header = node('header', undefined, 'admin-header');
    const brand = node('div');
    brand.append(node('p', 'STORY MARKET · ADMIN', 'admin-muted'), node('h1', title));
    header.replaceChildren(brand);
    page.append(header);
    root.replaceChildren(page);
    return { page, header };
}

function showConfiguration() {
    const { page } = shell('先連接資料庫');
    const card = node('section', undefined, 'admin-card');
    card.append(node('p', '管理後台不會使用 Demo 假登入。請先建立 Supabase 開發專案，並設定本機公開連線資訊。'), node('p', '在專案根目錄建立 .env.local：'), node('pre', 'VITE_SUPABASE_URL=https://你的專案.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...'), node('p', '這兩項是公開連線值，權限由資料庫 RLS 控制。絕不可放 secret key 或資料庫密碼。設定後重新啟動 Vite。'), node('p', undefined, 'admin-muted'));
    card.append(node('a', '開啟後端從零指南', 'admin-button secondary'));
    const guide = card.querySelector('a')!;
    guide.href = `${import.meta.env.BASE_URL}docs/ADMIN_BACKEND_GUIDE.md`;
    page.append(card);
}

function showLogin(message = '') {
    const { page } = shell('管理者登入');
    const card = node('section', undefined, 'admin-card');
    const form = node('form', undefined, 'admin-form');
    const email = node('input'); email.type = 'email'; email.autocomplete = 'username'; email.required = true;
    const password = node('input'); password.type = 'password'; password.autocomplete = 'current-password'; password.required = true;
    const submit = node('button', '登入並進行第二步驗證', 'admin-button'); submit.type = 'submit';
    const status = statusLine(form); status.classList.add('admin-error'); status.textContent = message;
    form.append(field('電子郵件', email), field('密碼', password), submit);
    form.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true; status.textContent = '正在安全登入…';
        try {
            const factors = await client!.signIn(email.value.trim(), password.value);
            const verified = factors.filter(factor => factor.status === 'verified');
            if (verified.length === 1) showTotp(verified[0].id);
            else if (verified.length > 1) showFactorPicker(verified);
            else {
                const enrollment = await client!.enrollTotp();
                showTotp(enrollment.id, enrollment.totp.qr_code, enrollment.totp.secret);
            }
        } catch (error) {
            status.textContent = error instanceof Error ? error.message : '登入失敗。';
            submit.disabled = false;
        }
    });
    card.append(node('p', '此頁沒有公開註冊。管理者帳號需由專案擁有者建立，並完成驗證器 App 的 TOTP 驗證。'), form);
    page.append(card);
}

function showFactorPicker(factors: TotpFactor[]) {
    const { page } = shell('選擇驗證器');
    const card = node('section', undefined, 'admin-card');
    const select = node('select');
    for (const factor of factors) {
        const option = node('option', factor.friendly_name || `驗證器 ${factor.id.slice(0, 8)}`);
        option.value = factor.id; select.append(option);
    }
    card.append(node('p', '請選擇你目前可使用的驗證器。建議為管理者帳號註冊第二個備援驗證器。'), field('驗證器', select), button('繼續', () => showTotp(select.value)));
    page.append(card);
}

function showTotp(factorId: string, qrCode?: string, secret?: string, afterVerified: () => void = () => { void showDashboard(); }) {
    const { page } = shell(qrCode ? '設定驗證器' : '輸入驗證碼');
    const card = node('section', undefined, 'admin-card');
    const form = node('form', undefined, 'admin-form');
    if (qrCode) {
        card.append(node('p', '用驗證器 App 掃描 QR code，或手動輸入下方密鑰。密鑰只在設定這一步顯示，請不要截圖或分享。'));
        const image = node('img', undefined, 'admin-qr'); image.alt = 'TOTP 設定 QR code'; image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
        card.append(image, node('p', secret ?? '', 'admin-code'));
    } else card.append(node('p', '請輸入驗證器 App 目前顯示的 6 位數代碼。'));
    const code = node('input'); code.inputMode = 'numeric'; code.autocomplete = 'one-time-code'; code.pattern = '[0-9]{6}'; code.minLength = 6; code.maxLength = 6; code.required = true;
    const submit = node('button', '驗證並進入後台', 'admin-button'); submit.type = 'submit';
    const status = statusLine(form); status.classList.add('admin-error');
    form.append(field('6 位數驗證碼', code), submit);
    form.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true; status.textContent = '正在驗證…';
        try {
            await client!.verifyTotp(factorId, code.value);
            if (!await client!.isContentAdmin()) {
                await client!.signOut();
                showLogin('這個帳號尚未加入後台管理者名單。請聯絡專案擁有者。');
                return;
            }
            afterVerified();
        }
        catch (error) { status.textContent = error instanceof Error ? error.message : '驗證失敗。'; submit.disabled = false; }
    });
    card.append(form); page.append(card);
}

async function showTotpSettings(message = '') {
    const { page, header } = shell('管理驗證器');
    header.append(button('返回清單', () => { void showDashboard(); }, 'secondary'));
    const card = node('section', undefined, 'admin-card');
    card.append(node('p', '建議至少保留兩個已驗證的 TOTP 驗證器，作為手機遺失時的備援。移除驗證器需要已完成第二步驗證的管理者工作階段。', 'admin-muted'));
    const status = statusLine(card); status.textContent = message || '正在讀取驗證器…';
    const list = node('div');
    const actions = node('div', undefined, 'admin-actions');
    actions.append(button('新增備援驗證器', async () => {
        try {
            const enrollment = await client!.enrollTotp();
            showTotp(enrollment.id, enrollment.totp.qr_code, enrollment.totp.secret, () => { void showTotpSettings('已新增並驗證備援驗證器。'); });
        } catch (error) { status.textContent = error instanceof Error ? error.message : '無法新增驗證器。'; }
    }));
    card.append(actions, list); page.append(card);
    try {
        const factors = await client!.listFactors();
        const verifiedCount = factors.filter(factor => factor.status === 'verified').length;
        status.textContent = factors.length ? `已登記 ${verifiedCount} 個已驗證驗證器。` : '目前沒有驗證器，請登出後重新登入並完成設定。';
        list.replaceChildren();
        const table = node('table', undefined, 'admin-list');
        const head = node('thead'); const heading = node('tr');
        for (const title of ['名稱', '狀態', '操作']) heading.append(node('th', title));
        head.append(heading); table.append(head);
        const body = node('tbody');
        for (const factor of factors) {
            const row = node('tr');
            row.append(node('td', factor.friendly_name || `驗證器 ${factor.id.slice(0, 8)}`), node('td', factor.status === 'verified' ? '已驗證' : '尚未驗證'));
            const cell = node('td');
            const remove = button('移除', async () => {
                if (!confirm(`確定移除「${factor.friendly_name || '這個驗證器'}」？請先確認至少有另一個可用的已驗證驗證器。`)) return;
                remove.disabled = true;
                try { await client!.unenrollTotp(factor.id); await showTotpSettings('已移除驗證器。'); }
                catch (error) { status.textContent = error instanceof Error ? error.message : '移除失敗。'; remove.disabled = false; }
            }, 'danger');
            remove.disabled = factor.status === 'verified' && verifiedCount <= 1;
            if (remove.disabled) remove.title = '至少保留一個已驗證的驗證器。';
            cell.append(remove); row.append(cell); body.append(row);
        }
        if (!factors.length) { const row = node('tr'); row.append(node('td', '沒有已登記的驗證器。')); body.append(row); }
        table.append(body); list.append(table);
    } catch (error) { status.textContent = error instanceof Error ? error.message : '讀取驗證器失敗。'; }
}

async function showDashboard(message = '') {
    const { page, header } = shell('資料管理');
    header.append(button('登出', async () => { try { await client!.signOut(); } finally { showLogin(); } }, 'secondary'));
    const statusCard = node('section', undefined, 'admin-card');
    const status = statusLine(statusCard); status.textContent = message || '資料會直接儲存在 Supabase PostgreSQL。公開讀取與管理寫入由資料庫 RLS 控制。';
    page.append(statusCard);
    const toolbar = node('section', undefined, 'admin-card admin-actions');
    const filter = node('select');
    const all = node('option', '所有資料類型'); all.value = ''; filter.append(all);
    for (const value of collections) { const option = node('option', labels[value]); option.value = value; filter.append(option); }
    const importFile = node('input'); importFile.type = 'file'; importFile.accept = 'application/json,.json'; importFile.hidden = true;
    toolbar.append(field('篩選類型', filter), button('新增資料', () => showEditor()), button('變更紀錄', () => { void showAudit(); }, 'secondary'), button('管理驗證器', () => { void showTotpSettings(); }, 'secondary'), button('匯入 JSON', () => importFile.click(), 'secondary'), button('下載備份 JSON', () => {
        const file = new Blob([JSON.stringify(documents, null, 2)], { type: 'application/json' });
        const link = node('a'); link.href = URL.createObjectURL(file); link.download = `pixel-fair-content-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'secondary'), node('span', '使用欄位表單編輯；複雜巢狀資料可展開進階 JSON。', 'admin-muted'), importFile);
    importFile.addEventListener('change', async () => {
        const file = importFile.files?.[0]; if (!file) return;
        try {
            if (file.size > 8 * 1024 * 1024) throw new Error('匯入檔不可超過 8 MB。');
            const parsed: unknown = JSON.parse(await file.text());
            const validationError = validateContentImport(parsed);
            if (validationError) throw new Error(validationError);
            const rows = parsed as ContentDocument[];
            if (!confirm(`將以 ${rows.length} 筆文件匯入。相同類型與 ID 的現有資料會被覆寫，請先下載備份。繼續嗎？`)) return;
            status.textContent = `正在匯入 ${rows.length} 筆資料…`;
            await client!.importDocuments(rows);
            documents = await client!.documents(); render(); status.textContent = `完成：匯入 ${rows.length} 筆資料。`;
        } catch (error) { status.textContent = error instanceof Error ? error.message : '匯入失敗。'; }
        finally { importFile.value = ''; }
    });
    page.append(toolbar);
    const card = node('section', undefined, 'admin-card'); page.append(card);
    const render = () => {
        card.replaceChildren();
        const filtered = documents.filter(document => !filter.value || document.collection === filter.value);
        const table = node('table', undefined, 'admin-list');
        const head = node('thead'); const row = node('tr');
        for (const title of ['類型', '名稱', 'ID', '活動 ID', '狀態', '修訂', '操作']) row.append(node('th', title));
        head.append(row); table.append(head);
        const body = node('tbody');
        for (const document of filtered) {
            const tr = node('tr');
            const displayName = document.data.name ?? document.data.title ?? document.data.code ?? document.data.label ?? document.id;
            tr.append(node('td', labels[document.collection] ?? document.collection), node('td', String(displayName)), node('td', document.id), node('td', document.event_id), node('td', document.is_published ? '已發布' : '草稿'), node('td', String(document.revision)));
            const actions = node('td');
            actions.append(button('編輯', () => showEditor(document), 'secondary'), button('刪除', async () => {
                if (!confirm(`確定刪除「${document.id}」？此操作無法直接復原。`)) return;
                try { await client!.deleteDocument(document.event_id, document.collection, document.id, document.revision); documents = documents.filter(item => item !== document); render(); status.textContent = '已刪除。'; }
                catch (error) { status.textContent = error instanceof Error ? error.message : '刪除失敗。'; }
            }, 'danger'));
            tr.append(actions); body.append(tr);
        }
        if (filtered.length === 0) { const tr = node('tr'); tr.append(node('td', '目前沒有資料。先新增一份，或完成初始資料匯入。')); body.append(tr); }
        table.append(body); card.append(table);
    };
    filter.addEventListener('change', render);
    render();
    try { documents = await client!.documents(); render(); }
    catch (error) { status.textContent = error instanceof Error ? error.message : '讀取失敗。'; }
}

async function showAudit(message = '') {
    const { page, header } = shell('管理操作紀錄');
    header.append(button('返回清單', () => { void showDashboard(); }, 'secondary'));
    const card = node('section', undefined, 'admin-card');
    card.append(node('p', '最近 100 筆資料異動。紀錄由 PostgreSQL trigger 寫入，瀏覽器無法新增、修改或刪除。', 'admin-muted'));
    const status = statusLine(card); status.textContent = message || '讀取中…';
    page.append(card);
    try {
        const entries = await client!.auditLog();
        status.remove();
        const table = node('table', undefined, 'admin-list');
        const headerRow = node('tr');
        for (const title of ['時間', '操作', '文件', '管理者', '快照']) headerRow.append(node('th', title));
        const thead = node('thead'); thead.append(headerRow); table.append(thead);
        const tbody = node('tbody');
        for (const entry of entries) {
            const row = node('tr');
            row.append(node('td', new Date(entry.occurred_at).toLocaleString()), node('td', entry.action), node('td', `${labels[entry.collection] ?? entry.collection} / ${entry.document_id}`), node('td', entry.actor_id ?? '系統'));
            const snapshotCell = node('td');
            const details = node('details'); details.append(node('summary', '查看前後資料'));
            const snapshot = node('pre', JSON.stringify({ before: entry.old_document, after: entry.new_document }, null, 2)); snapshot.className = 'admin-code';
            details.append(snapshot); snapshotCell.append(details, button('復原這次異動', async () => {
                const warning = entry.action === 'INSERT' ? '復原新增會刪除目前資料。' : entry.action === 'DELETE' ? '復原刪除會重新建立該資料。' : '復原修改會將資料恢復為修改前的內容。';
                if (!confirm(`${warning} 系統會新增一筆操作紀錄。確定繼續？`)) return;
                try { await restoreAuditEntry(entry); await showAudit('已復原；此次復原也已寫入操作紀錄。'); }
                catch (error) { status.textContent = error instanceof Error ? error.message : '復原失敗。'; }
            }, 'secondary'));
            row.append(snapshotCell); tbody.append(row);
        }
        if (!entries.length) { const row = node('tr'); row.append(node('td', '目前沒有操作紀錄。')); tbody.append(row); }
        table.append(tbody); card.append(table);
    } catch (error) { status.textContent = error instanceof Error ? error.message : '讀取紀錄失敗。'; }
}

async function restoreAuditEntry(entry: ContentAuditEntry) {
    const audit = await client!.auditLog();
    const latest = audit.find(item => item.event_id === entry.event_id && item.collection === entry.collection && item.document_id === entry.document_id);
    if (!latest || latest.id !== entry.id) throw new Error('這筆不是該資料最新的異動紀錄。請從最新紀錄復原，避免覆蓋較新的修改。');
    const currentRows = await client!.documents();
    const current = currentRows.find(row => row.event_id === entry.event_id && row.collection === entry.collection && row.id === entry.document_id);
    const old = entry.old_document as ContentDocument | null;
    const after = entry.new_document as ContentDocument | null;
    if (entry.action === 'INSERT') {
        if (!current) throw new Error('資料已不存在，無需復原。');
        if (!after || current.revision !== after.revision) throw new Error('資料在這次新增後又有修改，請確認最新異動紀錄再復原。');
        await client!.deleteDocument(entry.event_id, entry.collection, entry.document_id, current.revision);
    } else if (entry.action === 'UPDATE') {
        if (!old || !current) throw new Error('找不到修改前資料或目前資料，無法安全復原。');
        if (!after || current.revision !== after.revision) throw new Error('資料在這次修改後又有變動，請確認最新異動紀錄再復原。');
        await client!.saveDocument({ collection: old.collection, id: old.id, event_id: old.event_id, data: old.data, is_published: old.is_published }, current.revision);
    } else {
        if (!old) throw new Error('操作紀錄缺少刪除前快照。');
        if (current) throw new Error('相同 ID 已重新建立，請先確認目前資料後再手動復原。');
        await client!.importDocuments([{ collection: old.collection, id: old.id, event_id: old.event_id, data: old.data, is_published: old.is_published }]);
    }
}

function showEditor(existing?: ContentDocument) {
    const { page, header } = shell(existing ? '編輯資料' : '新增資料');
    header.append(button('返回清單', () => { void showDashboard(); }, 'secondary'));
    const card = node('section', undefined, 'admin-card');
    const form = node('form', undefined, 'admin-form');
    const type = node('select');
    for (const collection of collections) { const option = node('option', labels[collection]); option.value = collection; type.append(option); }
    type.value = existing?.collection ?? 'events'; type.disabled = !!existing;
    const id = node('input'); id.required = true; id.maxLength = 120; id.value = existing?.id ?? ''; id.disabled = !!existing;
    const eventId = node('input'); eventId.required = true; eventId.maxLength = 120; eventId.value = existing?.event_id ?? 'twilight-only'; eventId.disabled = !!existing;
    const eventSuggestions = node('datalist'); eventSuggestions.id = 'admin-event-id-suggestions';
    for (const document of documents.filter(item => item.collection === 'events')) { const option = node('option'); option.value = document.id; option.label = String(document.data.name ?? document.id); eventSuggestions.append(option); }
    eventId.setAttribute('list', eventSuggestions.id);
    const help = node('p', descriptions[type.value], 'admin-muted');
    const published = node('input'); published.type = 'checkbox'; published.checked = existing?.is_published ?? false;
    const json = node('textarea'); json.spellcheck = false; json.required = true; json.value = JSON.stringify(existing?.data ?? templateFor(type.value, eventId.value), null, 2);
    const submit = node('button', '儲存到資料庫', 'admin-button'); submit.type = 'submit';
    const status = statusLine(form); status.classList.add('admin-error');
    const fields = node('div', undefined, 'admin-editor-fields');
    let readFields = () => ({} as Record<string, unknown>);
    const syncFormToJson = (): string | null => {
        try {
            const current: unknown = JSON.parse(json.value);
            if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error('完整 JSON 必須是物件。');
            const data: Record<string, unknown> = { ...(current as Record<string, unknown>), ...readFields(), id: id.value };
            if (type.value === 'events') data.id = id.value;
            if (['participations', 'campaigns'].includes(type.value)) data.eventId = eventId.value;
            json.value = JSON.stringify(data, null, 2);
            status.textContent = '';
            return null;
        } catch (error) {
            const message = error instanceof Error ? error.message : '有欄位格式不正確。';
            status.textContent = `請先修正欄位內容：${message}`;
            return message;
        }
    };
    const refreshFieldsFromJson = () => {
        try {
            const data: unknown = JSON.parse(json.value);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('完整 JSON 必須是物件。');
            const record = data as Record<string, unknown>;
            if (!existing && typeof record.id === 'string') id.value = record.id;
            if (type.value === 'events') eventId.value = id.value;
            else if (['participations', 'campaigns'].includes(type.value) && typeof record.eventId === 'string') eventId.value = record.eventId;
            readFields = createDocumentFields(fields, type.value, record, () => { syncFormToJson(); });
            status.textContent = '';
        } catch (error) {
            status.textContent = error instanceof Error ? error.message : '完整 JSON 格式不正確。';
        }
    };
    const syncEventId = () => {
        if (type.value === 'events') {
            eventId.value = id.value;
            eventId.disabled = true;
        } else {
            eventId.disabled = !!existing;
        }
        syncFormToJson();
    };
    id.addEventListener('input', syncEventId);
    eventId.addEventListener('input', () => {
        if (!existing && ['participations', 'campaigns'].includes(type.value)) syncFormToJson();
    });
    json.addEventListener('change', refreshFieldsFromJson);
    type.addEventListener('change', () => {
        json.value = JSON.stringify(templateFor(type.value, eventId.value), null, 2);
        help.textContent = descriptions[type.value];
        refreshFieldsFromJson();
        syncEventId();
    });
    const advanced = node('details', undefined, 'admin-advanced-json');
    advanced.append(node('summary', '進階：直接編輯完整 JSON'), node('p', '一般欄位會自動同步到這裡。場景區塊、座標或其他巢狀資料可在此貼上完整 JSON。', 'admin-muted'), field('完整資料', json));
    syncEventId();
    refreshFieldsFromJson();
    form.append(field('資料類型', type), help, field('穩定 ID', id), field('所屬活動 ID', eventId), eventSuggestions, node('h2', '編輯欄位'), node('p', '引用其他資料的 ID 欄位會提供現有資料建議；可以直接選擇，也可以輸入新的 ID。資料庫會檢查引用是否存在及是否屬於同一活動。', 'admin-muted'), fields, advanced);
    const publishLabel = node('label', undefined, 'admin-actions'); publishLabel.append(published, node('span', '公開發布（訪客可讀）')); form.append(publishLabel, submit);
    form.addEventListener('submit', async event => {
        event.preventDefault(); submit.disabled = true;
        try {
            const fieldError = syncFormToJson();
            if (fieldError) throw new Error(fieldError);
            status.textContent = '儲存中…';
            const data: unknown = JSON.parse(json.value);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('資料內容必須是 JSON 物件。');
            if (!('id' in data) || (data as { id?: unknown }).id !== id.value) throw new Error('穩定 ID 必須和 JSON 內容的 id 完全相同。');
            if (['participations', 'campaigns'].includes(type.value) && (data as { eventId?: unknown }).eventId !== eventId.value) throw new Error('JSON 內容的 eventId 必須和上方活動 ID 相同。');
            const validationError = validateContentDocument(type.value, data as Record<string, unknown>);
            if (validationError) throw new Error(validationError);
            await client!.saveDocument({ collection: type.value, id: id.value, event_id: eventId.value, data: data as Record<string, unknown>, is_published: published.checked }, existing?.revision);
            await showDashboard('已儲存。');
        } catch (error) { status.textContent = error instanceof Error ? error.message : '儲存失敗。'; submit.disabled = false; }
    });
    card.append(form); page.append(card);
}

async function start() {
    const url = env.VITE_SUPABASE_URL?.trim();
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
    if (!url || !key) { showConfiguration(); return; }
    try { client = new SupabaseAdminClient(url, key); showLogin(); }
    catch (error) { showLogin(error instanceof Error ? error.message : '設定錯誤。'); }
}

void start();
