import type { ActorState, BoothSummary, SceneView, StampCampaign, Point } from '../domain/models';
import { palette as p } from '../styles/palette';
import { drawActor, drawBooth, drawObject, rect, text, TILE } from './art';
export class SceneRenderer {
    camera = { x: 0, y: 0 };
    zoom = 3;
    ground: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    constructor(public canvas: HTMLCanvasElement, public scene: SceneView, private booths: BoothSummary[], private campaigns: StampCampaign[]) { this.context = canvas.getContext('2d')!; this.ground = document.createElement('canvas'); this.ground.width = scene.definition.width * TILE; this.ground.height = scene.definition.height * TILE; this.drawGround(); }
    resize() { const parent = this.canvas.parentElement!; const width = parent.clientWidth, height = parent.clientHeight; this.zoom = width < 1000 ? 3 : 4; this.canvas.width = Math.ceil(width / this.zoom); this.canvas.height = Math.ceil(height / this.zoom); this.canvas.style.width = `${this.canvas.width * this.zoom}px`; this.canvas.style.height = `${this.canvas.height * this.zoom}px`; this.context.imageSmoothingEnabled = false; }
    drawGround() {
        const c = this.ground.getContext('2d')!, s = this.scene.definition;
        rect(c, 0, 0, this.ground.width, this.ground.height, p.sage);
        for (let y = 0; y < s.height; y++)
            for (let x = 0; x < s.width; x++) {
                if ((x * 13 + y * 7) % 9 === 0) {
                    rect(c, x * TILE + 3, y * TILE + 9, 3, 1, '#7d9169');
                    rect(c, x * TILE + 4, y * TILE + 7, 1, 3, '#7d9169');
                }
            }
        for (const g of s.ground) {
            rect(c, g.x * TILE, g.y * TILE, g.width * TILE, g.height * TILE, g.kind === 'plaza' ? p.pavingLight : p.pavement);
            for (let y = g.y; y < g.y + g.height; y++)
                for (let x = g.x; x < g.x + g.width; x++) {
                    rect(c, x * TILE, y * TILE, 16, 1, '#c6b69f');
                    rect(c, x * TILE, y * TILE, 1, 16, '#c6b69f');
                    rect(c, x * TILE, y * TILE + 8, 16, 1, '#c6b69f');
                    rect(c, x * TILE + 8, y * TILE + 8, 1, 8, '#c6b69f');
                    if ((x + y) % 4 === 0)
                        rect(c, x * TILE + 4, y * TILE + 5, 5, 1, '#f1e0c2');
                }
        }
        for (const g of s.ground) {
            if (g.label)
                text(c, g.label, (g.x + g.width / 2) * TILE, (g.y + g.height * .7) * TILE, 10, '#ad967d');
            if (g.kind === 'street')
                for (let y = g.y + 1; y < g.y + g.height - 1; y += 2) {
                    rect(c, g.x * TILE, y * TILE, 2, 13, p.cream);
                    rect(c, (g.x + g.width - 1) * TILE, y * TILE, 2, 13, p.cream);
                }
        }
    }
    draw(time: number, player: ActorState, npcs: ActorState[], target: Point | null, selected: string | null, reduced = false, hidePlayer = false) {
        const c = this.context, w = this.canvas.width, h = this.canvas.height;
        this.camera.x = Math.max(0, Math.min(this.ground.width - w, Math.round(player.position.x * TILE - w / 2)));
        this.camera.y = Math.max(0, Math.min(this.ground.height - h, Math.round(player.position.y * TILE - h / 2)));
        c.clearRect(0, 0, w, h);
        c.save();
        c.translate(-this.camera.x, -this.camera.y);
        c.drawImage(this.ground, 0, 0);
        const layers: {
            y: number;
            draw: () => void;
        }[] = [];
        for (const object of this.scene.definition.objects)
            layers.push({ y: (object.origin.y + object.height) * TILE, draw: () => drawObject(c, object, time, reduced) });
        for (const slot of this.scene.slots) {
            const assignment = this.scene.assignments.find(a => a.slotIds.includes(slot.id));
            const booth = this.booths.find(b => b.participation.id === assignment?.participationId);
            if (!booth)
                continue;
            const a = booth.participation;
            layers.push({ y: (slot.origin.y + slot.height) * TILE, draw: () => {
                    drawBooth(c, slot, a.decoration.tableclothId, a.decoration.propIds[0], a.attendantAvatarId, this.campaigns.some(c => c.participantIds.includes(a.id)), reduced ? 0 : time);
                    if (selected === a.id) {
                        rect(c, slot.origin.x * TILE + 23, slot.origin.y * TILE - 16, 1, 14, p.wood);
                        rect(c, slot.origin.x * TILE + 24, slot.origin.y * TILE - 16, 10, 6, p.gold);
                    }
                } });
        }
        for (const actor of [...npcs, ...(hidePlayer ? [] : [player])])
            layers.push({ y: actor.position.y * TILE, draw: () => {
                    drawActor(c, actor, time);
                    if (!reduced && actor.source === 'npc' && actor.action === 'idle' && Math.floor(time / 8) % 6 === npcs.indexOf(actor) && time % 8 < 1.2)
                        text(c, '♥', actor.position.x * TILE, actor.position.y * TILE - 29, 8, p.coral);
                } });
        layers.sort((a, b) => a.y - b.y);
        for (const layer of layers) {
            layer.draw();
        }
        if (target) {
            const x = target.x * TILE, y = target.y * TILE;
            rect(c, x - 4, y - 1, 9, 2, p.coral);
            rect(c, x - 1, y - 4, 2, 9, p.coral);
            rect(c, x - 1, y - 1, 2, 2, p.paper);
        }
        c.restore();
    }
    worldFromPointer(event: PointerEvent) { const box = this.canvas.getBoundingClientRect(); return { x: ((event.clientX - box.left) / box.width * this.canvas.width + this.camera.x) / TILE, y: ((event.clientY - box.top) / box.height * this.canvas.height + this.camera.y) / TILE }; }
}
