import type { BoothDetail, BoothSummary, ContentRepository, EventView, ID, SceneView, StampCampaign, WorkDetail } from '../domain/models';
import { event, sceneView, testScene, boothData, workData, campaigns } from '../data/fixtures/content';

/** A failed HTTP content request with a stable status for UI and telemetry. */
export class ContentHttpError extends Error {
    constructor(message: string, readonly status?: number) {
        super(message);
        this.name = 'ContentHttpError';
    }
}

/** Reads the public event DTOs described in docs/CONTENT_API.md. */
export class HttpContentRepository implements ContentRepository {
    private readonly baseUrl: string;

    constructor(
        baseUrl: string,
        private readonly options: { timeoutMs?: number; retries?: number; fetcher?: typeof fetch } = {}
    ) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
        if (!this.baseUrl) throw new Error('請設定內容 API 網址。');
    }

    getEvent(id: ID): Promise<EventView> { return this.get<EventView>(`/events/${encodeURIComponent(id)}`); }
    getScene(id: ID): Promise<SceneView> { return this.get<SceneView>(`/scenes/${encodeURIComponent(id)}`); }
    listBooths(eventId: ID): Promise<BoothSummary[]> { return this.get<BoothSummary[]>(`/events/${encodeURIComponent(eventId)}/booths`); }
    getBooth(eventId: ID, participationId: ID): Promise<BoothDetail> { return this.get<BoothDetail>(`/events/${encodeURIComponent(eventId)}/booths/${encodeURIComponent(participationId)}`); }
    getWork(eventId: ID, exhibitId: ID): Promise<WorkDetail> { return this.get<WorkDetail>(`/events/${encodeURIComponent(eventId)}/works/${encodeURIComponent(exhibitId)}`); }
    listCampaigns(eventId: ID): Promise<StampCampaign[]> { return this.get<StampCampaign[]>(`/events/${encodeURIComponent(eventId)}/campaigns`); }

    private async get<T>(path: string): Promise<T> {
        const fetcher = this.options.fetcher ?? fetch;
        const retries = Math.max(0, this.options.retries ?? 1);
        for (let attempt = 0; ; attempt++) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 8000);
            try {
                const response = await fetcher(`${this.baseUrl}${path}`, {
                    headers: { Accept: 'application/json' }, signal: controller.signal
                });
                if (response.status === 404) throw new ContentHttpError('找不到這份內容。', 404);
                if (!response.ok) {
                    if (response.status >= 500 && attempt < retries) {
                        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
                        continue;
                    }
                    throw new ContentHttpError(`內容服務暫時無法使用（HTTP ${response.status}）。`, response.status);
                }
                try {
                    return await response.json() as T;
                } catch {
                    throw new ContentHttpError('內容服務回傳的資料格式不正確。', response.status);
                }
            } catch (error) {
                if (error instanceof ContentHttpError) throw error;
                if (controller.signal.aborted) throw new ContentHttpError('讀取內容逾時，請再試一次。');
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
                    continue;
                }
                throw new ContentHttpError('無法連線到內容服務，請檢查網路後再試一次。');
            } finally {
                clearTimeout(timeout);
            }
        }
    }
}

export class MockRepository implements ContentRepository {
    constructor(private options: {
        delay?: number;
        fail?: boolean;
        empty?: boolean;
        scene?: string;
    } = {}) { }
    private async load<T>(value: T | undefined): Promise<T> {
        await new Promise(r => setTimeout(r, this.options.delay ?? 30));
        if (this.options.fail)
            throw new Error('暫時讀不到內容，請再試一次。');
        if (value === undefined)
            throw new Error('找不到這份內容。');
        return structuredClone(value);
    }
    getEvent(id: ID) { return this.load(id === event.id ? event : undefined); }
    getScene(id: ID) { return this.load(this.options.scene === 'test' || id === 'test-yard' ? testScene : id === sceneView.definition.id ? sceneView : undefined); }
    listBooths(id: ID) { return this.load(id === event.id ? (this.options.empty ? [] : boothData()) : undefined); }
    getBooth(id: ID, pid: ID) { return this.load(id === event.id ? boothData().find(b => b.participation.id === pid) : undefined); }
    getWork(id: ID, eid: ID) { return this.load(id === event.id ? workData(eid) : undefined); }
    listCampaigns(id: ID) { return this.load(id === event.id ? campaigns : undefined); }
}
