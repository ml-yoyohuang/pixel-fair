import type { VisitorState, Point } from '../domain/models';
import { avatars } from '../assets/avatars';
import { visibleNickname } from '../domain/services';
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value); }
function ids(value: unknown): value is string[] { return Array.isArray(value) && value.every(id => typeof id === 'string'); }
function validState(value: unknown, eventId: string): value is VisitorState {
    if (!isRecord(value) || value.schemaVersion !== 2 || value.eventId !== eventId || typeof value.entered !== 'boolean' || typeof value.tutorialSeen !== 'boolean' || typeof value.nickname !== 'string' || !avatars.some(a => a.id === value.avatarId) || !ids(value.boothFavorites) || !ids(value.workFavorites) || !isRecord(value.position) || !Number.isFinite(value.position.x) || !Number.isFinite(value.position.y) || !isRecord(value.stamps) || !Object.values(value.stamps).every(ids) || !isRecord(value.rewards) || !isRecord(value.settings))
        return false;
    for (const reward of Object.values(value.rewards)) {
        if (!isRecord(reward) || reward.eventId !== eventId || typeof reward.campaignId !== 'string' || (typeof reward.issuedAt !== 'string' || !Number.isFinite(Date.parse(reward.issuedAt))) || typeof reward.nicknameSnapshot !== 'string' || !avatars.some(a => a.id === reward.avatarId) || !['cat', 'dog', 'bird'].includes(String(reward.companionId)) || !['books', 'coffee', 'flyer'].includes(String(reward.detailId)) || reward.recipeVersion !== 1)
            return false;
    }
    const settings = value.settings;
    return ['music', 'sfx', 'reducedMotion'].every(k => typeof settings[k] === 'boolean') && ['musicVolume', 'sfxVolume'].every(k => typeof settings[k] === 'number' && Number.isFinite(settings[k]) && Number(settings[k]) >= 0 && Number(settings[k]) <= 1) && [0, 1, 2].includes(Number(settings.textSize)) && [0, 3, 6].includes(Number(settings.npcCount));
}
export interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
export function defaults(eventId: string, spawn: Point): VisitorState { return { schemaVersion: 2, eventId, entered: false, avatarId: 'human-amber', nickname: '', position: { x: spawn.x + .5, y: spawn.y + .5 }, boothFavorites: [], workFavorites: [], stamps: {}, rewards: {}, tutorialSeen: false, settings: { music: false, sfx: false, musicVolume: .28, sfxVolume: .35, reducedMotion: false, textSize: 1, npcCount: 6 } }; }
export class VisitorRepository {
    state: VisitorState;
    warning = '';
    key: string;
    constructor(eventId: string, spawn: Point, private storage: StorageAdapter) {
        this.key = `fan-street:v2:${eventId}`;
        this.state = defaults(eventId, spawn);
        try {
            const raw = storage.getItem(this.key);
            if (raw) {
                const p: unknown = JSON.parse(raw);
                if (!validState(p, eventId))
                    throw Error('invalid');
                this.state = { ...p, nickname: visibleNickname(p.nickname) };
            }
        }
        catch {
            this.warning = '紀錄損壞或無法讀取，已使用新的護照。';
        }
    }
    save() {
        try {
            this.storage.setItem(this.key, JSON.stringify(this.state));
            return true;
        }
        catch {
            this.warning = '本次可下載，但無法保留到下次；收藏與集章也只保留在本次。';
            return false;
        }
    }
    toggle(kind: 'boothFavorites' | 'workFavorites', id: string) { const list = this.state[kind]; this.state[kind] = list.includes(id) ? list.filter(x => x !== id) : [...list, id]; this.save(); }
    clear(spawn: Point) {
        try {
            this.storage.removeItem(this.key);
        }
        catch {
            this.warning = '無法清除裝置紀錄，已清除本次記憶體紀錄。';
        }
        this.state = defaults(this.state.eventId, spawn);
        this.save();
    }
}
export function safeStorage(): StorageAdapter {
    try {
        return window.localStorage;
    }
    catch {
        return { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); }, removeItem: () => { throw Error('blocked'); } };
    }
}
