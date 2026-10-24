import { describe, expect, it } from 'vitest';
import { validateContentDocument, validateContentImport } from '../admin/document-validation';
import * as demo from '../data/fixtures/content';

describe('admin content validation', () => {
    it('explains invalid imports before sending them to the database', () => {
        const row = { collection: 'venues', id: 'venue', event_id: 'event', data: { id: 'venue', name: '市集場館' }, is_published: false };
        expect(validateContentImport([row])).toBeNull();
        expect(validateContentImport({})).toContain('JSON 陣列');
        expect(validateContentImport([{ ...row, collection: 'unknown' }])).toContain('格式不正確');
        expect(validateContentImport([row, row])).toContain('重複');
        expect(validateContentImport([{ ...row, data: { id: 'different', name: '市集場館' } }])).toContain('外層 ID');
        expect(validateContentImport([{ ...row, data: { id: 'venue', name: '市集場館'.repeat(400000) } }])).toContain('超過 1 MB');
    });

    it('keeps every demo seed document valid and all references resolvable', () => {
        const event = { ...demo.event, layoutId: demo.event.layout.id, venueId: demo.event.venue.id } as Record<string, unknown>;
        delete event.layout;
        delete event.venue;
        const documents: Array<{ collection: string; data: Record<string, unknown> }> = [
            { collection: 'venues', data: demo.event.venue as unknown as Record<string, unknown> },
            { collection: 'layouts', data: demo.event.layout as unknown as Record<string, unknown> },
            { collection: 'events', data: event },
            { collection: 'scenes', data: demo.scene as unknown as Record<string, unknown> },
            ...demo.slots.map(data => ({ collection: 'slots', data: data as unknown as Record<string, unknown> })),
            ...demo.circles.map(data => ({ collection: 'circles', data: data as unknown as Record<string, unknown> })),
            ...demo.participations.map(data => ({ collection: 'participations', data: data as unknown as Record<string, unknown> })),
            ...demo.sceneView.assignments.map(data => ({ collection: 'assignments', data: { ...data, id: `assignment-${data.participationId}` } as Record<string, unknown> })),
            ...demo.works.map(data => ({ collection: 'works', data: data as unknown as Record<string, unknown> })),
            ...demo.exhibits.map(data => ({ collection: 'exhibits', data: data as unknown as Record<string, unknown> })),
            ...demo.campaigns.map(data => ({ collection: 'campaigns', data: data as unknown as Record<string, unknown> }))
        ];

        for (const { collection, data } of documents) {
            expect(validateContentDocument(collection, data), `${collection}/${String(data.id)}`).toBeNull();
        }

        const ids = (collection: string) => new Set(documents.filter(document => document.collection === collection).map(document => document.data.id));
        const expectReferences = (collection: string, field: string, target: string) => {
            const targets = ids(target);
            for (const { data } of documents.filter(document => document.collection === collection)) {
                expect(targets.has(data[field]), `${collection}/${String(data.id)} → ${field}`).toBe(true);
            }
        };
        expectReferences('layouts', 'venueId', 'venues');
        expectReferences('events', 'layoutId', 'layouts');
        expectReferences('events', 'venueId', 'venues');
        expectReferences('events', 'sceneId', 'scenes');
        expectReferences('slots', 'layoutId', 'layouts');
        expectReferences('participations', 'circleId', 'circles');
        expectReferences('assignments', 'participationId', 'participations');
        expectReferences('works', 'circleId', 'circles');
        expectReferences('exhibits', 'participationId', 'participations');
        expectReferences('exhibits', 'workId', 'works');

        const slotIds = ids('slots');
        for (const { data } of documents.filter(document => document.collection === 'assignments')) {
            for (const slotId of data.slotIds as string[]) expect(slotIds.has(slotId), `assignment/${String(data.id)} → slot ${slotId}`).toBe(true);
        }
        const participationIds = ids('participations');
        for (const { data } of documents.filter(document => document.collection === 'campaigns')) {
            for (const participationId of data.participantIds as string[]) expect(participationIds.has(participationId), `campaign/${String(data.id)} → participation ${participationId}`).toBe(true);
        }
        expect(documents).toHaveLength(77);
    });

    it('accepts a minimum valid document for each supported collection', () => {
        const documents: Record<string, Record<string, unknown>> = {
            venues: { id: 'venue', name: '場館' },
            layouts: { id: 'layout', venueId: 'venue', version: 1, width: 52, height: 32 },
            events: { id: 'event', name: '活動', tagline: '標語', layoutId: 'layout', venueId: 'venue', sceneId: 'scene', startsAt: '2026-10-01T00:00:00+08:00', endsAt: '2026-11-01T00:00:00+08:00', timezone: 'Asia/Taipei', announcements: [] },
            scenes: { id: 'scene', width: 20, height: 20, spawn: { x: 1, y: 1 }, ground: [], objects: [], npcWaypoints: [] },
            slots: { id: 'slot', layoutId: 'layout', code: 'A01', zoneId: 'main', origin: { x: 1, y: 1 }, width: 3, height: 2, facing: 'down', interactionAnchors: [], npcStopPoints: [] },
            circles: { id: 'circle', name: '團體', author: '作者' },
            participations: { id: 'participation', eventId: 'event', circleId: 'circle', intro: '介紹', greeting: '招呼', attendantAvatarId: 'human-amber', decoration: {}, status: 'published' },
            assignments: { id: 'assignment', participationId: 'participation', slotIds: ['slot'] },
            works: { id: 'work', circleId: 'circle', title: '作品', medium: 'comic', coverAssetId: 'cover', description: '簡介', preview: { kind: 'none' } },
            exhibits: { id: 'exhibit', participationId: 'participation', workId: 'work', release: 'new', availability: 'display', demoOnly: true },
            campaigns: { id: 'campaign', eventId: 'event', title: '集章', participantIds: ['participation'], requiredCount: 1, rewardRecipeId: 'recipe' }
        };

        for (const [collection, data] of Object.entries(documents)) {
            expect(validateContentDocument(collection, data), collection).toBeNull();
        }
    });

    it('rejects a cross-site script URL and unsupported collection values', () => {
        expect(validateContentDocument('exhibits', {
            id: 'exhibit', participationId: 'participation', workId: 'work', release: 'new', availability: 'sale', demoOnly: false, url: 'javascript:alert(1)'
        })).toContain('http 或 https');
        expect(validateContentDocument('admin_users', { id: 'owner' })).toContain('不支援');
    });

    it('rejects incomplete relationships and invalid reward thresholds', () => {
        expect(validateContentDocument('assignments', { id: 'assignment', participationId: '', slotIds: [] })).toContain('participationId');
        expect(validateContentDocument('assignments', { id: 'assignment', participationId: 'part', slotIds: ['slot-1', 'slot-1'] })).toContain('不可重複');
        expect(validateContentDocument('campaigns', { id: 'campaign', eventId: 'event', title: '集章', participantIds: ['one'], requiredCount: 2, rewardRecipeId: 'recipe' })).toContain('完成章數');
        expect(validateContentDocument('campaigns', { id: 'campaign', eventId: 'event', title: '集章', participantIds: ['same', 'same'], requiredCount: 2, rewardRecipeId: 'recipe' })).toContain('不可重複');
    });

    it('rejects invalid event periods, timezones, and oversized maps', () => {
        const event = { id: 'event', name: '活動', tagline: '標語', layoutId: 'layout', venueId: 'venue', sceneId: 'scene', startsAt: '2026-11-01T00:00:00+08:00', endsAt: '2026-10-01T00:00:00+08:00', timezone: 'Asia/Taipei', announcements: [] };
        expect(validateContentDocument('events', event)).toContain('結束時間');
        expect(validateContentDocument('events', { ...event, endsAt: '2026-12-01T00:00:00+08:00', timezone: 'Mars/Olympus' })).toContain('IANA 時區');
        expect(validateContentDocument('events', { ...event, startsAt: '2026-11-01', endsAt: '2026-12-01T00:00:00+08:00' })).toContain('ISO');
        expect(validateContentDocument('scenes', { id: 'scene', width: 129, height: 20, spawn: { x: 1, y: 1 }, ground: [], objects: [], npcWaypoints: [] })).toContain('128');
        expect(validateContentDocument('scenes', { id: 'scene', width: 20, height: 20, spawn: { x: 20, y: 1 }, ground: [], objects: [], npcWaypoints: [] })).toContain('場景範圍');
    });

    it('validates nested map regions and objects before saving', () => {
        const base = { id: 'scene', width: 20, height: 20, spawn: { x: 1, y: 1 }, ground: [], objects: [], npcWaypoints: [] };
        expect(validateContentDocument('scenes', { ...base, ground: [{ x: 19, y: 0, width: 2, height: 1, kind: 'street' }] })).toContain('ground');
        expect(validateContentDocument('scenes', { ...base, objects: [{ id: 'tree', kind: 'tree', origin: { x: 1, y: 1 }, width: 2, height: 2, collidable: 'yes' }] })).toContain('objects');
        expect(validateContentDocument('scenes', { ...base, objects: [{ id: 'tree', kind: 'tree', origin: { x: 1, y: 1 }, width: 2, height: 2 }, { id: 'tree', kind: 'tree', origin: { x: 4, y: 1 }, width: 2, height: 2 }] })).toContain('不可重複');
    });
});
