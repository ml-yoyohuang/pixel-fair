import type { BoothSummary, Point, SceneObject, SceneView } from '../domain/models';
export interface InteractionTarget {
    id: string;
    label: string;
    anchor: Point;
    origin: Point;
    width: number;
    height: number;
    booth?: BoothSummary;
    object?: SceneObject;
}
export class InteractionController {
    targets: InteractionTarget[];
    selected: string | null = null;
    constructor(scene: SceneView, booths: BoothSummary[]) { this.targets = scene.slots.map(slot => ({ id: scene.assignments.find(a => a.slotIds.includes(slot.id))!.participationId, label: `${slot.code} ${booths.find(b => b.slots.some(s => s.id === slot.id))?.circle.name ?? '攤位'}`, anchor: slot.interactionAnchors[0], origin: slot.origin, width: slot.width, height: slot.height, booth: booths.find(b => b.slots.some(s => s.id === slot.id)) })); this.targets.push(...scene.definition.objects.filter(o => o.interaction && o.anchor).map(o => ({ id: o.id, label: o.label ?? ({ poster: '街角海報', seat: '咖啡座位' }[o.interaction as 'poster' | 'seat'] ?? '街角'), anchor: o.anchor!, origin: o.origin, width: o.width, height: o.height, object: o }))); }
    hit(p: Point) { return this.targets.find(t => p.x >= t.origin.x && p.x < t.origin.x + t.width && p.y >= t.origin.y && p.y < t.origin.y + t.height); }
    nearest(p: Point) { const nearby = this.targets.filter(t => Math.hypot(p.x - t.anchor.x - .5, p.y - t.anchor.y - .5) <= 1.45); return nearby.find(t => t.id === this.selected) ?? nearby.sort((a, b) => Math.hypot(p.x - a.anchor.x - .5, p.y - a.anchor.y - .5) - Math.hypot(p.x - b.anchor.x - .5, p.y - b.anchor.y - .5))[0]; }
}
