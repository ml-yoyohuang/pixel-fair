import type { ContentRepository, ID } from '../domain/models';
import { event, sceneView, testScene, boothData, workData, campaigns } from '../data/fixtures/content';
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
