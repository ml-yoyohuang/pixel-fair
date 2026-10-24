import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    logLevel: 'error'
});
try {
    const source = await server.ssrLoadModule('/src/data/fixtures/content.ts');
    const event = { ...source.event, layoutId: source.event.layout.id, venueId: source.event.venue.id };
    delete event.layout;
    delete event.venue;
    const records = [
        ['venues', [source.event.venue]],
        ['layouts', [source.event.layout]],
        ['events', [event]],
        ['scenes', [source.scene]],
        ['slots', source.slots],
        ['circles', source.circles],
        ['participations', source.participations],
        ['assignments', source.sceneView.assignments],
        ['works', source.works],
        ['exhibits', source.exhibits],
        ['campaigns', source.campaigns]
    ].flatMap(([collection, items]) => items.map(item => {
        const data = collection === 'assignments' ? { ...item, id: `assignment-${item.participationId}` } : item;
        return { collection, id: data.id, event_id: source.EVENT_ID, data, is_published: true };
    }));
    const output = resolve(process.argv[2] ?? 'supabase/seed-content.json');
    await writeFile(output, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    process.stdout.write(`Exported ${records.length} content documents to ${output}\n`);
} finally {
    await server.close();
}
