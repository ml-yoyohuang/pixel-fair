import type { ActorState, Point, SceneView } from '../domain/models';
import { MovementController } from './movement';
import { NavigationService } from './navigation';
export class NpcController {
    entries: {
        actor: ActorState;
        movement: MovementController;
        wait: number;
        index: number;
        state: 'waiting' | 'walking' | 'watching' | 'resting';
    }[] = [];
    points: Point[];
    constructor(scene: SceneView, nav: NavigationService) {
        this.points = [...scene.definition.npcWaypoints, ...scene.slots.flatMap(s => s.npcStopPoints)].filter(p => nav.walkable(p));
        const avatars = ['human-blue', 'cat', 'human-sage', 'dog', 'human-amber', 'rabbit'];
        for (let i = 0; i < 6; i++) {
            const point = this.points[i % this.points.length] ?? scene.definition.spawn;
            const actor: ActorState = { id: `npc-${avatars[i]}`, source: 'npc', sceneId: scene.definition.id, position: { x: point.x + .5, y: point.y + .5 }, facing: 'down', action: 'idle', avatarId: avatars[i] };
            const movement = new MovementController(actor, nav);
            movement.speed = 2;
            const entry = { actor, movement, wait: i + 1, index: i, state: 'waiting' as 'waiting' | 'walking' | 'watching' | 'resting' };
            movement.onArrive = () => { entry.state = entry.index < scene.definition.npcWaypoints.length ? 'resting' : 'watching'; entry.wait = entry.state === 'resting' ? 5 + Math.random() * 7 : 3 + Math.random() * 5; actor.facing = 'up'; };
            this.entries.push(entry);
        }
    }
    update(dt: number, count: number) {
        for (const e of this.entries.slice(0, count)) {
            e.movement.update(dt);
            if (e.movement.path.length)
                continue;
            e.wait -= dt;
            if (e.wait <= 0) {
                e.index = (e.index + 5) % this.points.length;
                e.state = 'walking';
                e.movement.navigate(this.points[e.index]);
            }
        }
    }
    actors(count: number) { return this.entries.slice(0, count).map(e => e.actor); }
}
