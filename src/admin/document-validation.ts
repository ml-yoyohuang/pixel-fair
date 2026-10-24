type JsonObject = Record<string, unknown>;
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const isPositiveInteger = (value: unknown) => Number.isInteger(value) && Number(value) > 0;
const isTileCount = (value: unknown) => Number.isInteger(value) && Number(value) > 0 && Number(value) <= 128;
const isIsoTimestampWithZone = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value));
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText);
const isObject = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value);
const isPoint = (value: unknown): value is JsonObject & { x: number; y: number } => isObject(value) && isNumber(value.x) && isNumber(value.y);
const isPointInScene = (value: unknown, width: number, height: number) => isPoint(value) && value.x >= 0 && value.y >= 0 && value.x < width && value.y < height;
const sceneObjectKinds = ['building', 'tree', 'bench', 'poster', 'board', 'plant', 'lamp', 'bike', 'vending', 'gate', 'stringLights'];
const sceneInteractions = ['service', 'bookshop', 'coffee', 'print', 'board', 'poster', 'reader', 'seat'];
const sceneColors = ['blue', 'sage', 'coral', 'mustard'];
const groundKinds = ['street', 'plaza', 'alley'];

export function validateContentDocument(collection: string, data: JsonObject): string | null {
    if (!isText(data.id)) return '資料必須有非空白 id。';
    const requireText = (...keys: string[]) => keys.every(key => isText(data[key]));
    const requireArray = (...keys: string[]) => keys.every(key => Array.isArray(data[key]));
    switch (collection) {
        case 'venues': return requireText('name') ? null : '場館需要 name。';
        case 'layouts': return requireText('venueId') && isPositiveInteger(data.version) && isTileCount(data.width) && isTileCount(data.height) ? null : '場地配置需要 venueId、正整數版本，以及 1 到 128 的正整數寬高。';
        case 'events':
            if (!requireText('name', 'tagline', 'layoutId', 'venueId', 'sceneId', 'startsAt', 'endsAt', 'timezone') || !requireArray('announcements') || !isStringArray(data.announcements)) return '活動需要名稱、場地／場景 ID、日期、時區，以及文字公告陣列。';
            if (!isIsoTimestampWithZone(data.startsAt as string) || !isIsoTimestampWithZone(data.endsAt as string) || Date.parse(data.endsAt as string) <= Date.parse(data.startsAt as string)) return '活動日期必須是帶時區的 ISO 格式，且結束時間晚於開始時間。';
            try { new Intl.DateTimeFormat('zh-TW', { timeZone: String(data.timezone) }); }
            catch { return '活動時區必須是有效的 IANA 時區，例如 Asia/Taipei。'; }
            return null;
        case 'scenes':
            if (!isTileCount(data.width) || !isTileCount(data.height) || !isPoint(data.spawn) || !requireArray('ground', 'objects', 'npcWaypoints')) return '場景需要 1 到 128 的正整數尺寸、spawn 座標，以及 ground、objects、npcWaypoints 陣列。';
            if (!isPointInScene(data.spawn, Number(data.width), Number(data.height)) || (data.rewardViewPoint !== undefined && !isPointInScene(data.rewardViewPoint, Number(data.width), Number(data.height)))) return 'spawn 與 rewardViewPoint 座標必須位於場景範圍內。';
            if (!(data.npcWaypoints as unknown[]).every(point => isPointInScene(point, Number(data.width), Number(data.height)))) return 'npcWaypoints 每一項都必須是場景範圍內的座標。';
            if (!(data.ground as unknown[]).every(item => isObject(item) && ['x', 'y', 'width', 'height'].every(key => Number.isInteger(item[key])) && Number(item.x) >= 0 && Number(item.y) >= 0 && Number(item.width) > 0 && Number(item.height) > 0 && Number(item.x) + Number(item.width) <= Number(data.width) && Number(item.y) + Number(item.height) <= Number(data.height) && groundKinds.includes(String(item.kind)) && (item.label === undefined || typeof item.label === 'string'))) return 'ground 每一區都需要有效座標、範圍內的正整數尺寸，以及 street、plaza 或 alley 類型。';
            const objects = data.objects as unknown[];
            if (!objects.every(item => {
                if (!isObject(item)) return false;
                const origin = item.origin;
                if (!isText(item.id) || !sceneObjectKinds.includes(String(item.kind)) || !isPoint(origin) || !isPositiveInteger(item.width) || !isPositiveInteger(item.height)) return false;
                if (!isPointInScene(origin, Number(data.width), Number(data.height)) || origin.x + Number(item.width) > Number(data.width) || origin.y + Number(item.height) > Number(data.height)) return false;
                if (item.label !== undefined && typeof item.label !== 'string') return false;
                if (item.color !== undefined && !sceneColors.includes(String(item.color))) return false;
                if (item.collidable !== undefined && typeof item.collidable !== 'boolean') return false;
                if (item.anchor !== undefined && !isPointInScene(item.anchor, Number(data.width), Number(data.height))) return false;
                if (item.interaction !== undefined && !sceneInteractions.includes(String(item.interaction))) return false;
                return true;
            })) return 'objects 每項都需要唯一 id、支援的種類、場景範圍內的位置與有效尺寸；可選欄位也必須符合對應格式。';
            if (new Set(objects.map(item => (item as JsonObject).id)).size !== objects.length) return 'objects 裡的 id 不可重複。';
            return null;
        case 'slots':
            if (!requireText('layoutId', 'code', 'zoneId') || !isPoint(data.origin) || !isTileCount(data.width) || !isTileCount(data.height) || !['up', 'down', 'left', 'right'].includes(String(data.facing)) || !requireArray('interactionAnchors', 'npcStopPoints')) return '攤位需要配置 ID、攤號、區域、1 到 128 的尺寸、方向與位置陣列。';
            if (!(data.interactionAnchors as unknown[]).every(isPoint) || !(data.npcStopPoints as unknown[]).every(isPoint)) return '攤位互動點和 NPC 停靠點必須是有效座標。';
            return null;
        case 'circles': return requireText('name', 'author') ? null : '創作團體需要名稱與作者。';
        case 'participations':
            if (!requireText('eventId', 'circleId', 'intro', 'greeting', 'attendantAvatarId') || !isObject(data.decoration) || data.status !== 'published') return '參展資料需要 eventId、circleId、介紹、招呼文、角色、裝飾與 published 狀態。';
            return null;
        case 'assignments':
            if (!requireText('participationId') || !isStringArray(data.slotIds)) return '位置分配需要 participationId 與 slotIds 文字陣列。';
            return new Set(data.slotIds).size === data.slotIds.length ? null : 'slotIds 不可重複分配同一位置。';
        case 'works': {
            if (!requireText('circleId', 'title', 'coverAssetId', 'description') || !['comic', 'novel', 'illustration', 'goods'].includes(String(data.medium)) || !isObject(data.preview)) return '作品需要團體 ID、標題、封面、介紹、媒材與試閱資料。';
            const preview = data.preview;
            if (preview.kind === 'images' && isStringArray(preview.assetIds)) return null;
            if (preview.kind === 'text' && isStringArray(preview.paragraphs)) return null;
            return preview.kind === 'none' ? null : '試閱必須是 images、text 或 none 格式。';
        }
        case 'exhibits':
            if (!requireText('participationId', 'workId') || !['new', 'existing'].includes(String(data.release)) || !['sale', 'free', 'display'].includes(String(data.availability)) || typeof data.demoOnly !== 'boolean') return '出展作品需要參展 ID、作品 ID、發行狀態、供應狀態與 demoOnly。';
            if (data.url !== undefined && data.url !== '' && (!isText(data.url) || !/^https?:\/\//i.test(data.url))) return '外部連結只能使用 http 或 https。';
            return null;
        case 'campaigns':
            if (!requireText('eventId', 'title', 'rewardRecipeId') || !isStringArray(data.participantIds) || !Number.isInteger(data.requiredCount) || Number(data.requiredCount) < 1 || Number(data.requiredCount) > data.participantIds.length) return '集章活動需要參與者 ID、配方 ID，以及有效的完成章數。';
            if (new Set(data.participantIds).size !== data.participantIds.length) return 'participantIds 不可重複，否則同一參展者會被計算多次。';
            return null;
        default: return '不支援的資料類型。';
    }
}

const contentCollections = new Set(['venues', 'layouts', 'events', 'scenes', 'slots', 'circles', 'participations', 'assignments', 'works', 'exhibits', 'campaigns']);

export function validateContentImport(value: unknown): string | null {
    if (!Array.isArray(value)) return '匯入檔必須是 JSON 陣列。';
    if (value.length > 5000) return '匯入檔不可超過 5,000 筆資料。';
    const seen = new Set<string>();
    for (const [index, candidate] of value.entries()) {
        if (!isObject(candidate) || typeof candidate.collection !== 'string' || !contentCollections.has(candidate.collection)
            || !isText(candidate.id) || !isText(candidate.event_id) || !isObject(candidate.data)
            || typeof candidate.is_published !== 'boolean') {
            return `第 ${index + 1} 筆資料的類型、ID、活動 ID、內容或發布狀態格式不正確。`;
        }
        const row = candidate as JsonObject;
        const id = row.id as string;
        const eventId = row.event_id as string;
        const data = row.data as JsonObject;
        const characterLength = (text: string) => Array.from(text).length;
        if (characterLength(id) > 120 || characterLength(eventId) > 120 || id.includes('\0') || eventId.includes('\0')) {
            return `第 ${index + 1} 筆資料的 ID 不可超過 120 個字元，也不能包含空字元。`;
        }
        if (data.id !== id) return `第 ${index + 1} 筆資料的外層 ID 與內容 id 不一致。`;
        if (candidate.collection === 'events' && eventId !== id) return `第 ${index + 1} 筆活動資料的活動 ID 必須與文件 ID 相同。`;
        if (['participations', 'campaigns'].includes(candidate.collection) && data.eventId !== eventId) return `第 ${index + 1} 筆資料的 eventId 必須與所屬活動 ID 相同。`;
        const compositeId = `${eventId}\0${candidate.collection}\0${id}`;
        if (seen.has(compositeId)) return `匯入檔包含重複的資料：${candidate.collection}/${id}（${eventId}）。`;
        seen.add(compositeId);
        if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 1024 * 1024) return `第 ${index + 1} 筆資料超過 1 MB。`;
        const documentError = validateContentDocument(candidate.collection, data);
        if (documentError) return `第 ${index + 1} 筆資料（${candidate.collection}/${id}）：${documentError}`;
    }
    return null;
}
