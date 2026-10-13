import { describe, it, expect } from 'vitest';
import { NavigationService } from '../game/navigation';
import { MovementController } from '../game/movement';
import { StampService, RewardService, normalizeSearch, visibleNickname } from '../domain/services';
import { VisitorRepository, defaults, type StorageAdapter } from '../repositories/visitor';
import { sceneView, testScene, campaigns, participations, works, event } from '../data/fixtures/content';
import { MockRepository } from '../repositories/content';
import type { ActorState } from '../domain/models';
const storage = (): StorageAdapter => { const map = new Map<string, string>(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } }; };
describe('navigation and actual fixtures', () => {
    it('all twelve booths, public shops and NPC stops are reachable', () => {
        const nav = new NavigationService(sceneView);
        for (const s of sceneView.slots) {
            expect(nav.findPath(sceneView.definition.spawn, s.interactionAnchors[0]), s.code).not.toBeNull();
            for (const stop of s.npcStopPoints)
                expect(nav.findPath(sceneView.definition.spawn, stop), s.code + ' NPC').not.toBeNull();
        }
        for (const o of sceneView.definition.objects)
            if (o.anchor)
                expect(nav.findPath(sceneView.definition.spawn, o.anchor), o.id).not.toBeNull();
    });
    it('uses four neighbors, rejects blocked and out-of-bounds cells', () => {
        const nav = new NavigationService(sceneView);
        expect(nav.findPath({ x: 5, y: 25 }, { x: 8, y: 9 })).toBeNull();
        expect(nav.findPath({ x: 5, y: 25 }, { x: -1, y: 25 })).toBeNull();
        const path = nav.findPath({ x: 5.5, y: 25.5 }, { x: 21, y: 11 })!;
        let prev = { x: 5.5, y: 25.5 };
        for (const point of path) {
            expect(Math.abs(prev.x - point.x) + Math.abs(prev.y - point.y)).toBe(1);
            expect(nav.walkable(point)).toBe(true);
            prev = point;
        }
    });
    it('can load a second data-defined scene without renderer changes', async () => {
        const repo = new MockRepository({ scene: 'test' });
        const scene = await repo.getScene('test-yard');
        expect(scene.slots).toHaveLength(2);
        const nav = new NavigationService(testScene);
        for (const slot of testScene.slots)
            expect(nav.findPath(testScene.definition.spawn, slot.interactionAnchors[0])).not.toBeNull();
    });
    it('time-based movement, new destination and keyboard cancel are safe', () => { const nav = new NavigationService(testScene); const actor: ActorState = { id: 'test', source: 'local', sceneId: 'test-yard', avatarId: 'cat', position: { x: 2.5, y: 10.5 }, facing: 'up', action: 'idle' }; const movement = new MovementController(actor, nav); movement.navigate({ x: 10, y: 10 }); movement.update(.5); expect(actor.position.x).toBeCloseTo(4.3); movement.navigate({ x: 2, y: 10 }); movement.update(.5); expect(actor.position.x).toBeCloseTo(2.5); movement.navigate({ x: 10, y: 10 }); movement.update(.1, 'up'); expect(movement.path).toHaveLength(0); expect(movement.destination).toBeNull(); });
});
describe('passport and reward rules', () => {
    it('stamps are idempotent and require campaign membership', () => {
        const state = defaults(event.id, { x: 5, y: 25 }), service = new StampService(), campaign = campaigns[0];
        expect(service.collect(state, campaign, 'part-train')).toBe(false);
        for (const id of campaign.participantIds) {
            expect(service.collect(state, campaign, id)).toBe(true);
            expect(service.collect(state, campaign, id)).toBe(false);
        }
        expect(service.count(state, campaign)).toBe(6);
        expect(service.complete(state, campaign)).toBe(true);
    });
    it('blocks early rewards and captures identity only once', () => { const state = defaults(event.id, { x: 5, y: 25 }), service = new RewardService(() => 0, () => new Date('2026-10-13T08:00:00Z')); expect(() => service.issue(state, campaigns[0])).toThrow(); state.stamps[campaigns[0].id] = [...campaigns[0].participantIds]; state.nickname = '小夏'; const first = service.issue(state, campaigns[0]); state.avatarId = 'rabbit'; state.nickname = '改名'; expect(service.issue(state, campaigns[0])).toBe(first); expect(first.nicknameSnapshot).toBe('小夏'); expect(first.avatarId).toBe('human-amber'); });
    it('two independent equal-sized buckets yield all nine recipes', () => {
        const recipes = new Set<string>();
        for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
                const state = defaults(event.id, { x: 5, y: 25 });
                state.stamps[campaigns[0].id] = [...campaigns[0].participantIds];
                const values = [(a + .5) / 3, (b + .5) / 3];
                const result = new RewardService(() => values.shift()!).issue(state, campaigns[0]);
                recipes.add(`${result.companionId}/${result.detailId}`);
            }
        expect(recipes.size).toBe(9);
    });
    it('failed writes preserve the in-memory recipe without re-rolling', () => { const blocked: StorageAdapter = { getItem: () => null, setItem: () => { throw Error('quota'); }, removeItem: () => { } }; const repo = new VisitorRepository(event.id, { x: 5, y: 25 }, blocked); repo.state.stamps[campaigns[0].id] = [...campaigns[0].participantIds]; let calls = 0; const service = new RewardService(() => { calls++; return .5; }); const reward = service.issue(repo.state, campaigns[0]); expect(repo.save()).toBe(false); expect(service.issue(repo.state, campaigns[0])).toBe(reward); expect(calls).toBe(2); expect(repo.warning).toContain('無法保留到下次'); });
});
describe('storage and content', () => {
    it('isolates events and persists reward snapshots', () => { const adapter = storage(); const a = new VisitorRepository('event-a', { x: 5, y: 25 }, adapter); a.state.nickname = '甲'; a.save(); const b = new VisitorRepository('event-b', { x: 5, y: 25 }, adapter); expect(b.state.nickname).toBe(''); expect(new VisitorRepository('event-a', { x: 5, y: 25 }, adapter).state.nickname).toBe('甲'); });
    it('recovers broken JSON and inaccessible storage', () => { const adapter = storage(); adapter.setItem('fan-street:v2:' + event.id, '{no'); const repo = new VisitorRepository(event.id, { x: 5, y: 25 }, adapter); expect(repo.state.entered).toBe(false); expect(repo.warning).not.toBe(''); });
    it('rejects nested damaged stamps, rewards and unsafe settings', () => {
        for (const bad of [{ stamps: { 'six-corners': 'oops' } }, { rewards: { 'six-corners': {} } }, { settings: { musicVolume: 200 } }]) {
            const adapter = storage();
            adapter.setItem('fan-street:v2:' + event.id, JSON.stringify({ ...defaults(event.id, { x: 5, y: 25 }), ...bad }));
            const repo = new VisitorRepository(event.id, { x: 5, y: 25 }, adapter);
            expect(repo.warning).not.toBe('');
            expect(repo.state.stamps).toEqual({});
        }
    });
    it('normalizes full-width searches and counts visible graphemes', () => { expect(normalizeSearch(' Ａ０１ ')).toBe('a01'); expect(visibleNickname('👨‍👩‍👧‍👦'.repeat(15))).toBe('👨‍👩‍👧‍👦'.repeat(12)); });
    it('contains differentiated complete original works and sufficient novel previews', () => {
        expect(participations).toHaveLength(12);
        expect(new Set(participations.map(p => p.greeting)).size).toBe(12);
        for (const work of works.filter(w => w.id === 'work-tide' || w.id === 'work-star')) {
            expect(work.preview.kind).toBe('text');
            if (work.preview.kind === 'text') {
                const count = work.preview.paragraphs.join('').length;
                expect(count).toBeGreaterThanOrEqual(500);
                expect(count).toBeLessThanOrEqual(800);
            }
        }
    });
    it('repository errors remain explicit', async () => { await expect(new MockRepository({ fail: true }).getEvent(event.id)).rejects.toThrow('暫時讀不到'); await expect(new MockRepository().getBooth(event.id, 'unknown')).rejects.toThrow('找不到'); });
});
