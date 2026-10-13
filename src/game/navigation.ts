import type { Point, SceneView } from '../domain/models';
export class NavigationService {
    width: number;
    height: number;
    blocked: Set<string> = new Set();
    constructor(scene: SceneView) {
        this.width = scene.definition.width;
        this.height = scene.definition.height;
        const block = (x: number, y: number, w: number, h: number) => {
            for (let yy = y; yy < y + h; yy++)
                for (let xx = x; xx < x + w; xx++)
                    this.blocked.add(`${xx},${yy}`);
        };
        for (const s of scene.slots)
            block(s.origin.x, s.origin.y, s.width, s.height);
        for (const o of scene.definition.objects)
            if (o.collidable !== false)
                block(o.origin.x, o.origin.y, o.width, o.height);
    }
    walkable(p: Point) { const x = Math.floor(p.x), y = Math.floor(p.y); return x > 0 && y > 0 && x < this.width - 1 && y < this.height - 1 && !this.blocked.has(`${x},${y}`); }
    cell(p: Point): Point { return { x: Math.floor(p.x), y: Math.floor(p.y) }; }
    findPath(start: Point, target: Point): Point[] | null {
        const a = this.cell(start), b = this.cell(target);
        if (!this.walkable(a) || !this.walkable(b))
            return null;
        const key = (p: Point) => `${p.x},${p.y}`;
        const queue: Point[] = [a], prev = new Map<string, Point | null>([[key(a), null]]);
        let head = 0;
        while (head < queue.length) {
            const p = queue[head++];
            if (p.x === b.x && p.y === b.y) {
                const path: Point[] = [];
                let cursor: Point | null = p;
                while (cursor) {
                    path.unshift(cursor);
                    cursor = prev.get(key(cursor)) ?? null;
                }
                return path.slice(1).map(t => ({ x: t.x + .5, y: t.y + .5 }));
            }
            for (const d of [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
                const n = { x: p.x + d.x, y: p.y + d.y };
                if (this.walkable(n) && !prev.has(key(n))) {
                    prev.set(key(n), p);
                    queue.push(n);
                }
            }
        }
        return null;
    }
}
