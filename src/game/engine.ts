import type { ActorState, BoothSummary, SceneView, StampCampaign, VisitorState, Point } from '../domain/models';
import { SceneRenderer } from './renderer';
import { NavigationService } from './navigation';
import { MovementController } from './movement';
import { InputAdapter } from './input';
import { InteractionController, type InteractionTarget } from './interaction';
import { NpcController } from './npc';
export class StreetGame {
    renderer: SceneRenderer;
    nav: NavigationService;
    movement: MovementController;
    input: InputAdapter;
    interactions: InteractionController;
    npcs: NpcController;
    player: ActorState;
    running = false;
    modal = false;
    frame = 0;
    last = 0;
    time = 0;
    marker: Point | null = null;
    near: InteractionTarget | undefined;
    fps = 60;
    onInteraction = (target: InteractionTarget) => { };
    onNearby = (target: InteractionTarget | undefined) => { };
    onMessage = (message: string) => { };
    onPosition = (point: Point) => { };
    onStep = () => { };
    stepCooldown = 0;
    private pointerStart: {
        x: number;
        y: number;
        id: number;
    } | null = null;
    private down = (e: PointerEvent) => { this.pointerStart = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
    private up = (e: PointerEvent) => {
        const start = this.pointerStart;
        this.pointerStart = null;
        if (!start || e.pointerId !== start.id || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9 || this.modal || !this.running)
            return;
        const world = this.renderer.worldFromPointer(e);
        const hit = this.interactions.hit(world);
        if (hit) {
            this.navigate(hit);
            return;
        }
        this.interactions.selected = null;
        if (this.movement.navigate(world)) {
            this.marker = this.movement.destination;
        }
        else {
            this.marker = null;
            this.onMessage('這裡走不到喔');
        }
    };
    private resize = () => this.renderer.resize();
    private visibility = () => { this.last = 0; this.input.clear(); };
    constructor(private canvas: HTMLCanvasElement, public scene: SceneView, booths: BoothSummary[], campaigns: StampCampaign[], public visitor: VisitorState) {
        this.nav = new NavigationService(scene);
        const spawn = this.nav.walkable(visitor.position) ? visitor.position : { x: scene.definition.spawn.x + .5, y: scene.definition.spawn.y + .5 };
        this.player = { id: 'local-visitor', source: 'local', sceneId: scene.definition.id, position: { ...spawn }, facing: 'up', action: 'idle', avatarId: visitor.avatarId };
        this.movement = new MovementController(this.player, this.nav);
        this.movement.onArrive = () => {
            this.marker = null;
            const target = this.interactions.targets.find(t => t.id === this.interactions.selected);
            if (target)
                this.player.facing = 'up';
        };
        this.movement.onStop = () => this.onPosition(this.player.position);
        this.input = new InputAdapter(() => this.interact());
        this.input.enabled = false;
        this.interactions = new InteractionController(scene, booths);
        this.npcs = new NpcController(scene, this.nav);
        this.renderer = new SceneRenderer(canvas, scene, booths, campaigns);
        canvas.addEventListener('pointerdown', this.down);
        canvas.addEventListener('pointerup', this.up);
        window.addEventListener('resize', this.resize);
        document.addEventListener('visibilitychange', this.visibility);
        this.renderer.resize();
        this.frame = requestAnimationFrame(this.tick);
    }
    private tick = (timestamp: number) => {
        const dt = this.last ? Math.min(.05, (timestamp - this.last) / 1000) : 0;
        this.last = timestamp;
        if (!document.hidden) {
            if (dt > 0)
                this.fps = this.fps * .95 + (1 / dt) * .05;
            this.time += dt;
            if (this.running) {
                if (!this.modal) {
                    const direction = this.input.direction();
                    if (direction) {
                        this.marker = null;
                        this.interactions.selected = null;
                    }
                    this.movement.update(dt, direction);
                    this.stepCooldown -= dt;
                    if (this.player.action === 'walk' && this.stepCooldown <= 0) {
                        this.onStep();
                        this.stepCooldown = .32;
                    }
                    const near = this.interactions.nearest(this.player.position);
                    if (near?.id !== this.near?.id) {
                        this.near = near;
                        this.onNearby(near);
                    }
                }
                this.npcs.update(dt, this.visitor.settings.npcCount);
            }
            this.renderer.draw(this.time, this.player, this.npcs.actors(this.visitor.settings.npcCount), this.marker, this.interactions.selected, this.visitor.settings.reducedMotion);
        }
        this.frame = requestAnimationFrame(this.tick);
    };
    start() { this.running = true; this.player.avatarId = this.visitor.avatarId; this.input.enabled = true; }
    setModal(open: boolean) { this.modal = open; this.input.enabled = this.running && !open; this.input.clear(); this.movement.cancel(); this.marker = null; }
    navigate(target: InteractionTarget) {
        this.setModal(false);
        this.interactions.selected = target.id;
        if (!this.movement.navigate(target.anchor)) {
            this.onMessage('無法走到這裡；仍可從目錄閱讀。');
            return false;
        }
        this.marker = this.movement.destination;
        this.onMessage(`前往 ${target.label} · 抵達後按「查看」`);
        return true;
    }
    interact() {
        if (this.running && !this.modal && this.near) {
            this.movement.cancel();
            this.onInteraction(this.near);
        }
    }
    sit() { this.movement.cancel(); this.player.action = 'sit'; }
    destroy() { cancelAnimationFrame(this.frame); this.input.destroy(); this.canvas.removeEventListener('pointerdown', this.down); this.canvas.removeEventListener('pointerup', this.up); window.removeEventListener('resize', this.resize); document.removeEventListener('visibilitychange', this.visibility); }
}
