import type { Assignment, BoothDetail, BoothSlot, BoothSummary, Circle, ContentRepository, EventView, Exhibit, ID, Participation, SceneDefinition, SceneView, StampCampaign, Venue, Layout, Work, WorkDetail } from '../domain/models';

type DocumentRow = { collection: string; id: string; event_id: string; data: Record<string, unknown>; is_published: boolean };
type EventRecord = Omit<EventView, 'layout' | 'venue'> & { layoutId: ID; venueId: ID };

/** Public, read-only repository. PostgreSQL RLS filters out every draft row. */
export class SupabaseContentRepository implements ContentRepository {
    private readonly rowsByEvent = new Map<string, Promise<DocumentRow[]>>();

    constructor(private readonly projectUrl: string, private readonly publishableKey: string, private readonly defaultEventId = 'twilight-only') {
        let parsed: URL;
        try { parsed = new URL(projectUrl); } catch { throw new Error('Supabase 專案網址格式不正確。'); }
        const local = parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname);
        if (parsed.protocol !== 'https:' && !local) throw new Error('Supabase 網址必須使用 HTTPS（本機 localhost 除外）。');
        if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== '/' && parsed.pathname !== '')) throw new Error('Supabase 專案網址只能包含 origin，不可嵌入帳密或額外路徑。');
        if (!publishableKey) throw new Error('缺少 Supabase publishable key。');
    }

    private rows(eventId: ID): Promise<DocumentRow[]> {
        let rowsPromise = this.rowsByEvent.get(eventId);
        if (!rowsPromise) {
            const url = this.projectUrl.replace(/\/+$/, '');
            rowsPromise = (async () => {
                const pageSize = 1000;
                const rows: DocumentRow[] = [];
                for (let offset = 0; ; offset += pageSize) {
                    const query = `?select=collection,id,event_id,data,is_published&event_id=eq.${encodeURIComponent(eventId)}&order=collection.asc,id.asc&limit=${pageSize}&offset=${offset}`;
                    const response = await fetch(`${url}/rest/v1/content_documents${query}`, {
                        headers: { apikey: this.publishableKey, Accept: 'application/json' },
                        signal: AbortSignal.timeout(10000)
                    });
                    if (!response.ok) throw new Error(`無法讀取已發布內容（HTTP ${response.status}）。`);
                    const result: unknown = await response.json();
                    if (!Array.isArray(result)) throw new Error('內容服務回傳格式不正確。');
                    rows.push(...result as DocumentRow[]);
                    if (result.length < pageSize) return rows;
                }
            })().catch(error => {
                this.rowsByEvent.delete(eventId);
                throw error;
            });
            this.rowsByEvent.set(eventId, rowsPromise);
        }
        return rowsPromise;
    }

    private async find<T>(collection: string, id: ID, eventId: ID): Promise<T> {
        const row = (await this.rows(eventId)).find(item => item.collection === collection && item.id === id);
        if (!row) throw new Error('找不到這份內容。');
        return row.data as T;
    }

    async getEvent(id: ID): Promise<EventView> {
        const [record, rows] = await Promise.all([this.find<EventRecord>('events', id, id), this.rows(id)]);
        const layout = rows.find(row => row.collection === 'layouts' && row.id === record.layoutId && row.event_id === id)?.data as Layout | undefined;
        const venue = rows.find(row => row.collection === 'venues' && row.id === record.venueId && row.event_id === id)?.data as Venue | undefined;
        if (!layout || !venue) throw new Error('活動參照的場館或場地配置不存在。');
        const { layoutId: _layoutId, venueId: _venueId, ...event } = record;
        return { ...event, layout, venue };
    }

    async getScene(id: ID): Promise<SceneView> {
        const [definition, rows] = await Promise.all([this.find<SceneDefinition>('scenes', id, this.defaultEventId), this.rows(this.defaultEventId)]);
        const event = rows.find(row => row.collection === 'events' && row.data.sceneId === id);
        if (!event) throw new Error('找不到場景所屬的活動。');
        const layoutId = String(event.data.layoutId);
        const slots = rows.filter(row => row.collection === 'slots' && row.data.layoutId === layoutId && row.event_id === event.event_id).map(row => row.data as unknown as BoothSlot);
        const assignments = rows.filter(row => row.collection === 'assignments' && row.event_id === event.event_id).map(row => row.data as unknown as Assignment);
        return { definition, slots, assignments };
    }

    async listBooths(eventId: ID): Promise<BoothSummary[]> {
        const rows = await this.rows(eventId);
        const data = (collection: string) => rows.filter(row => row.collection === collection && row.event_id === eventId).map(row => row.data);
        const circles = data('circles') as unknown as Circle[];
        const slots = data('slots') as unknown as BoothSlot[];
        const assignments = data('assignments') as unknown as Assignment[];
        const exhibits = data('exhibits') as unknown as Exhibit[];
        const works = data('works') as unknown as Work[];
        const boothRows = data('participations') as unknown as Participation[];
        return boothRows.map(participation => {
            const circle = circles.find(item => item.id === participation.circleId);
            if (!circle) throw new Error(`參展資料 ${participation.id} 找不到創作團體。`);
            const assignment = assignments.find(item => item.participationId === participation.id);
            const boothSlots = slots.filter(slot => assignment?.slotIds.includes(slot.id));
            const boothWorks: WorkDetail[] = exhibits.filter(exhibit => exhibit.participationId === participation.id).map(exhibit => {
                const work = works.find(item => item.id === exhibit.workId);
                if (!work) throw new Error(`出展作品 ${exhibit.id} 找不到作品資料。`);
                return { work, exhibit, author: circle.author };
            });
            return { participation, circle, slots: boothSlots, works: boothWorks };
        });
    }

    async getBooth(eventId: ID, participationId: ID): Promise<BoothDetail> {
        const booth = (await this.listBooths(eventId)).find(item => item.participation.id === participationId);
        if (!booth) throw new Error('找不到這份內容。');
        return booth;
    }

    async getWork(eventId: ID, exhibitId: ID): Promise<WorkDetail> {
        const work = (await this.listBooths(eventId)).flatMap(booth => booth.works).find(item => item.exhibit.id === exhibitId);
        if (!work) throw new Error('找不到這份內容。');
        return work;
    }

    async listCampaigns(eventId: ID): Promise<StampCampaign[]> {
        const rows = await this.rows(eventId);
        return rows.filter(row => row.collection === 'campaigns' && row.event_id === eventId).map(row => row.data as unknown as StampCampaign);
    }
}
