import type { ActorState, Facing, Point } from '../domain/models';
import { NavigationService } from './navigation';
export class MovementController {
    path: Point[] = [];
    speed = 3.6;
    destination: Point | null = null;
    onArrive = () => { };
    onStop = () => { };
    constructor(public actor: ActorState, private nav: NavigationService) { }
    cancel() {
        this.path = [];
        this.destination = null;
        if (this.actor.action !== 'sit')
            this.actor.action = 'idle';
        this.onStop();
    }
    navigate(target: Point) {
        const path = this.nav.findPath(this.actor.position, target);
        if (path === null) {
            this.cancel();
            return false;
        }
        this.actor.action = 'idle';
        this.path = [];
        const cell = this.nav.cell(this.actor.position);
        const center = { x: cell.x + .5, y: cell.y + .5 };
        const first = path[0];
        const needsX = Math.abs(center.x - this.actor.position.x) > .01, needsY = Math.abs(center.y - this.actor.position.y) > .01;
        if (needsX && (needsY || !first || first.y !== center.y))
            this.path.push({ x: center.x, y: this.actor.position.y });
        if (needsY && (needsX || !first || first.x !== center.x))
            this.path.push(center);
        this.path.push(...path);
        this.destination = { x: Math.floor(target.x) + .5, y: Math.floor(target.y) + .5 };
        if (!this.path.length) {
            this.destination = null;
            this.onArrive();
            this.onStop();
        }
        return true;
    }
    update(dt: number, direction?: Facing) {
        if (direction) {
            if (this.destination)
                this.cancel();
            this.actor.action = 'walk';
            this.actor.facing = direction;
            const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
            const next = { x: this.actor.position.x + delta[0] * this.speed * dt, y: this.actor.position.y + delta[1] * this.speed * dt };
            const radius = .19;
            const okay = [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]].every(([x, y]) => this.nav.walkable({ x: next.x + x, y: next.y + y }));
            if (okay)
                this.actor.position = next;
            else
                this.actor.action = 'idle';
            return;
        }
        let distance = dt * this.speed;
        while (this.path.length && distance > 0) {
            const next = this.path[0], p = this.actor.position;
            const dx = next.x - p.x, dy = next.y - p.y, len = Math.hypot(dx, dy);
            this.actor.facing = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
            this.actor.action = 'walk';
            if (len <= distance) {
                this.actor.position = { ...next };
                this.path.shift();
                distance -= len;
            }
            else {
                this.actor.position = { x: p.x + dx / len * distance, y: p.y + dy / len * distance };
                distance = 0;
            }
        }
        if (!this.path.length && this.actor.action === 'walk') {
            this.actor.action = 'idle';
            if (this.destination) {
                this.onArrive();
                this.destination = null;
            }
            this.onStop();
        }
    }
}
