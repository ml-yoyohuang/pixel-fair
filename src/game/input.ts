import type { Facing } from '../domain/models';
export class InputAdapter {
    held: string[] = [];
    enabled = true;
    private keydown = (event: KeyboardEvent) => {
        if (this.isTyping(event.target) || !this.enabled)
            return;
        const k = event.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', 'e', 'enter'].includes(k)) {
            event.preventDefault();
            if (!this.held.includes(k))
                this.held.push(k);
            if (k === 'e' || k === 'enter')
                this.interact();
        }
    };
    private keyup = (e: KeyboardEvent) => { this.held = this.held.filter(k => k !== e.key.toLowerCase()); };
    private blur = () => { this.clear(); };
    constructor(private interact: () => void) { window.addEventListener('keydown', this.keydown); window.addEventListener('keyup', this.keyup); window.addEventListener('blur', this.blur); }
    isTyping(target: EventTarget | null) { return target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable); }
    direction(): Facing | undefined { const keys: Record<string, Facing> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' }; return this.held.map(k => keys[k]).filter(Boolean).at(-1); }
    clear() { this.held = []; }
    destroy() { window.removeEventListener('keydown', this.keydown); window.removeEventListener('keyup', this.keyup); window.removeEventListener('blur', this.blur); }
}
