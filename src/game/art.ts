import type { ActorState, SceneObject, BoothSlot } from '../domain/models';
import { palette as p, clothColors } from '../styles/palette';
export const TILE = 16;
export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); }
export function text(c: CanvasRenderingContext2D, label: string, x: number, y: number, size = 8, color: string = p.ink) { c.fillStyle = color; c.font = `${size}px "Microsoft JhengHei",sans-serif`; c.textAlign = 'center'; c.fillText(label, Math.round(x), Math.round(y)); }
export function drawActor(c: CanvasRenderingContext2D, a: ActorState, time: number, scale = 1) {
    c.save();
    c.translate(Math.round(a.position.x * TILE), Math.round(a.position.y * TILE));
    c.scale(scale, scale);
    const moving = a.action === 'walk', phase = moving ? Math.floor(time * 9) % 4 : 0;
    const step = [0, 1, 0, -1][phase];
    rect(c, -5, -2, 10, 3, '#00000020');
    const animal = ['cat', 'dog', 'rabbit', 'bird'].includes(a.avatarId);
    const color = a.avatarId === 'human-blue' ? p.blue : a.avatarId === 'human-sage' ? p.sage : p.coral;
    const fur = a.avatarId === 'cat' ? '#cf9d70' : a.avatarId === 'dog' ? '#c29263' : p.paper;
    const left = a.facing === 'left', right = a.facing === 'right', up = a.facing === 'up';
    const dx = left ? -1 : right ? 1 : 0;
    if (animal) {
        if (a.avatarId === 'rabbit') {
            rect(c, -4, -25, 3, 9, fur);
            rect(c, 1, -25, 3, 9, fur);
            rect(c, -3, -24, 1, 6, p.coral);
            rect(c, 2, -24, 1, 6, p.coral);
        }
        else if (a.avatarId === 'bird') {
            rect(c, -3, -12, 7, 8, p.blue);
            rect(c, 3, -10, 4, 2, p.mustard);
            rect(c, -5, -8, 3, 4, p.night);
            rect(c, 0, -11, 1, 1, p.ink);
            c.restore();
            return;
        }
        else {
            rect(c, -6, -20, 4, 5, fur);
            rect(c, 2, -20, 4, 5, fur);
            rect(c, -5, -19, 2, 2, p.coral);
            rect(c, 3, -19, 2, 2, p.coral);
        }
        rect(c, -6, -17, 12, 9, fur);
        rect(c, -5, -8, 10, 6, fur);
        rect(c, -5, -17, 10, 1, p.skin);
        rect(c, -5, -10, 10, 2, a.avatarId === 'rabbit' ? p.cream : p.skin);
        rect(c, -4, -3 + step, 3, 3, p.wood);
        rect(c, 1, -3 - step, 3, 3, p.wood);
        rect(c, -5, -8, 10, 2, a.avatarId === 'cat' ? p.blue : p.coral);
        if (a.avatarId === 'dog') {
            rect(c, -7, -17, 3, 9, p.wood);
            rect(c, 4, -17, 3, 9, p.wood);
        }
        if (a.avatarId === 'cat') {
            rect(c, 5, -5, 3, 2, fur);
            rect(c, 7, -8, 2, 4, fur);
        }
        if (!up) {
            rect(c, -3 + dx, -14, 1, 2, p.ink);
            rect(c, 2 + dx, -14, 1, 2, p.ink);
            rect(c, dx, -11, 1, 1, p.wood);
            rect(c, -5, -12, 2, 1, p.coral);
            rect(c, 3, -12, 2, 1, p.coral);
            if (a.avatarId === 'cat') {
                rect(c, -7, -11, 2, 1, p.wood);
                rect(c, 5, -11, 2, 1, p.wood);
            }
        }
    }
    else {
        rect(c, -4, -20, 8, 9, p.wood);
        rect(c, -5, -18, 10, 7, p.skin);
        rect(c, -5, -21, 10, 5, a.avatarId === 'human-blue' ? p.night : p.wood);
        if (a.avatarId === 'human-amber') {
            rect(c, -7, -23, 14, 3, p.mustard);
            rect(c, -4, -26, 8, 3, p.mustard);
            rect(c, -4, -24, 8, 1, p.wood);
        }
        if (a.avatarId === 'human-sage') {
            rect(c, -5, -21, 10, 2, p.sage);
            rect(c, 4, -18, 3, 7, p.wood);
        }
        if (!up) {
            rect(c, -3 + dx, -16, 1, 2, p.ink);
            rect(c, 2 + dx, -16, 1, 2, p.ink);
            rect(c, dx, -12, 2, 1, p.coral);
        }
        rect(c, -5, -11, 10, 8, color);
        rect(c, -4, -11, 8, 1, p.cream);
        rect(c, -3, -9, 1, 4, p.cream);
        rect(c, 1, -7, 3, 2, p.cream);
        rect(c, -6, -9 - step, 2, 5, p.skin);
        rect(c, 4, -9 + step, 2, 5, p.skin);
        rect(c, -4, -3 + step, 3, 3, p.ink);
        rect(c, 1, -3 - step, 3, 3, p.ink);
        if (up) {
            rect(c, -3, -10, 6, 6, p.mustard);
            rect(c, -2, -9, 4, 1, p.cream);
        }
    }
    if (a.action === 'sit')
        rect(c, -5, -2, 10, 2, p.wood);
    c.restore();
}
export function avatarCanvas(id: string) { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 36; drawActor(canvas.getContext('2d')!, { id: 'preview', source: 'local', sceneId: '', position: { x: 1, y: 2 }, facing: 'down', action: 'idle', avatarId: id }, 0); return canvas; }
export function drawBooth(c: CanvasRenderingContext2D, s: BoothSlot, clothId: string, prop: string, avatar: string, stamp: boolean, time: number) {
    const x = s.origin.x * TILE, y = s.origin.y * TILE, w = s.width * TILE;
    const n = Number(clothId.split('-')[1]) || 0;
    const color = clothColors[n % clothColors.length];
    rect(c, x + 2, y + 25, w, 8, '#443d5028');
    drawActor(c, { id: s.id, source: 'npc', sceneId: '', position: { x: s.origin.x + 1.5, y: s.origin.y + .8 }, avatarId: avatar, facing: 'down', action: 'idle' }, time);
    rect(c, x, y + 12, w, 3, p.wood);
    rect(c, x + 1, y + 15, w - 2, 15, color);
    for (let i = 3; i < w; i += 6)
        rect(c, x + i, y + 16, 2, 13, '#ffffff18');
    rect(c, x + 2, y + 28, w - 4, 2, p.wood);
    rect(c, x + 4, y + 30, 3, 3, p.wood);
    rect(c, x + w - 7, y + 30, 3, 3, p.wood);
    for (let i = 0; i < 3; i++) {
        rect(c, x + 4 + i * 9, y + 8 - i % 2 * 2, 7, 6, p.paper);
        rect(c, x + 5 + i * 9, y + 9 - i % 2 * 2, 5, 4, clothColors[(n + i + 2) % 12]);
        rect(c, x + 5 + i * 9, y + 13 - i % 2 * 2, 5, 1, p.cream);
    }
    rect(c, x + w - 12, y + 5, 8, 9, p.paper);
    rect(c, x + w - 11, y + 6, 6, 3, color);
    rect(c, x + w - 10, y + 10, 4, 2, p.mustard);
    if (prop === 'plant' || prop === 'repair') {
        rect(c, x + 31, y + 8, 6, 6, p.terracotta);
        rect(c, x + 29, y + 4, 10, 5, p.sage);
        rect(c, x + 33, y + 1, 3, 6, p.green);
    }
    else if (prop === 'star') {
        rect(c, x + 34, y + 2, 2, 8, p.gold);
        rect(c, x + 31, y + 5, 8, 2, p.gold);
    }
    else if (prop === 'candy') {
        rect(c, x + 31, y + 6, 8, 6, p.cream);
        rect(c, x + 32, y + 3, 6, 4, p.coral);
    }
    else if (prop === 'mail') {
        rect(c, x + 31, y + 5, 8, 6, p.paper);
        rect(c, x + 33, y + 7, 4, 1, p.coral);
    }
    else {
        rect(c, x + 33, y + 3, 4, 8, p.mustard);
        rect(c, x + 32, y + 1, 6, 3, p.cream);
    }
    rect(c, x + 5, y + 18, 20, 10, p.paper);
    text(c, s.code, x + 15, y + 26, 7);
    if (stamp) {
        rect(c, x + 31, y + 21, 7, 7, p.paper);
        rect(c, x + 33, y + 23, 3, 3, p.coral);
    }
}
export function drawObject(c: CanvasRenderingContext2D, o: SceneObject, time: number, reduced: boolean) {
    const x = o.origin.x * TILE, y = o.origin.y * TILE, w = o.width * TILE, h = o.height * TILE;
    if (o.kind !== 'stringLights')
        rect(c, x + 3, y + h - 5, w, 7, '#443d501b');
    if (o.kind === 'stringLights') {
        c.strokeStyle = p.wood;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + w, y + h);
        c.stroke();
        for (let i = 1; i < o.width; i++)
            rect(c, x + i * TILE, y + Math.floor(i / o.width * h) + 1, 3, 4, p.gold);
        return;
    }
    if (o.kind === 'building') {
        const color = o.color === 'blue' ? p.blue : o.color === 'sage' ? p.sage : o.color === 'coral' ? p.coral : p.mustard;
        rect(c, x, y + 8, w, h - 8, p.cream);
        rect(c, x + 3, y + 35, w - 6, h - 35, '#ded0b3');
        for (let row = 0; row < 3; row++)
            for (let col = 0; col < w / 12; col++)
                rect(c, x + 3 + col * 12 + (row % 2 ? 5 : 0), y + 45 + row * 12, 10, 1, '#c4b499');
        rect(c, x - 3, y + 3, w + 6, 30, p.roof);
        for (let r = 0; r < 5; r++)
            for (let col = 0; col < w / 9; col++) {
                rect(c, x - 2 + col * 9 + (r % 2 ? 4 : 0), y + 5 + r * 5, 7, 2, p.roofLight);
            }
        rect(c, x - 4, y + 30, w + 8, 4, p.wood);
        rect(c, x + 7, y + 38, 21, 22, p.wood);
        rect(c, x + 9, y + 40, 17, 17, p.gold);
        rect(c, x + 17, y + 40, 2, 17, p.wood);
        rect(c, x + 9, y + 48, 17, 2, p.wood);
        rect(c, x + w - 29, y + 38, 21, 22, p.wood);
        rect(c, x + w - 27, y + 40, 17, 17, p.gold);
        rect(c, x + w - 20, y + 40, 2, 17, p.wood);
        rect(c, x + w - 27, y + 48, 17, 2, p.wood);
        const door = x + Math.floor(w / 2) - 10;
        rect(c, door, y + h - 30, 20, 30, p.wood);
        rect(c, door + 3, y + h - 27, 14, 24, p.night);
        rect(c, door + 4, y + h - 25, 12, 12, p.gold);
        rect(c, door + 14, y + h - 10, 2, 2, p.gold);
        rect(c, x + 4, y + 62, w - 8, 10, p.paper);
        text(c, o.label ?? '', x + w / 2, y + 70, 8, p.wood);
        rect(c, x + 2, y + 74, w - 4, 7, color);
        for (let i = 2; i < w - 3; i += 10)
            rect(c, x + i, y + 74, 5, 7, p.cream);
        rect(c, x + 1, y + h - 3, w - 2, 3, p.wood);
        if (o.id === 'cafe' && !reduced) {
            for (let i = 0; i < 3; i++)
                rect(c, x + w - 13 + (i % 2), y + 35 - ((time * 5 + i * 5) % 14), 2, 3, '#fff9e966');
        }
    }
    else if (o.kind === 'tree') {
        rect(c, x + w / 2 - 3, y + h - 22, 6, 22, p.wood);
        rect(c, x + 6, y + 6, w - 12, 30, p.green);
        rect(c, x + 2, y + 14, w - 4, 22, p.green);
        rect(c, x + 8, y + 3, w - 16, 26, p.sage);
        rect(c, x + 3, y + 17, 15, 10, p.sage);
        rect(c, x + 19, y + 8, 12, 7, '#a6ac86');
        rect(c, x + 10, y + 26, 6, 3, '#a6ac86');
    }
    else if (o.kind === 'plant') {
        rect(c, x + 3, y + 9, 10, 7, p.terracotta);
        rect(c, x + 2, y + 8, 12, 3, p.roofLight);
        rect(c, x + 6, y, 4, 10, p.green);
        rect(c, x + 1, y + 3, 6, 4, p.sage);
        rect(c, x + 9, y + 1, 6, 5, p.sage);
    }
    else if (o.kind === 'bench') {
        rect(c, x, y + 2, w, 3, p.wood);
        rect(c, x, y + 6, w, 3, p.wood);
        rect(c, x, y + 10, w, 4, p.roofLight);
        rect(c, x + 3, y + 13, 3, 4, p.ink);
        rect(c, x + w - 6, y + 13, 3, 4, p.ink);
        if (o.id === 'reader') {
            drawActor(c, { id: 'reader', source: 'npc', sceneId: '', position: { x: o.origin.x + .7, y: o.origin.y + .6 }, avatarId: 'rabbit', facing: 'down', action: 'sit' }, time);
            rect(c, x + 6, y + 2, 10, 7, p.blue);
            rect(c, x + 10, y + 2, 1, 7, p.paper);
        }
    }
    else if (o.kind === 'board' || o.kind === 'poster') {
        rect(c, x + 2, y + 2, w - 4, h - 5, p.wood);
        rect(c, x + 4, y + 4, w - 8, h - 10, p.paper);
        for (let i = 0; i < Math.max(1, o.width - 1); i++) {
            rect(c, x + 7 + i * 14, y + 7, 9, 12, i % 2 ? p.blue : p.coral);
            rect(c, x + 8 + i * 14, y + 8, 7, 2, p.cream);
        }
        rect(c, x + 4, y + h - 3, 3, 6, p.wood);
        rect(c, x + w - 7, y + h - 3, 3, 6, p.wood);
    }
    else if (o.kind === 'lamp') {
        rect(c, x + 7, y + 5, 2, h - 5, p.wood);
        rect(c, x + 3, y + 2, 10, 2, p.ink);
        rect(c, x + 4, y + 4, 8, 7, p.gold);
        rect(c, x + 3, y + 11, 10, 2, p.ink);
    }
    else if (o.kind === 'vending') {
        rect(c, x, y, w, h, p.blue);
        rect(c, x + 2, y + 3, 12, 12, p.night);
        for (let i = 0; i < 3; i++)
            rect(c, x + 3 + i * 4, y + 5, 2, 7, [p.coral, p.gold, p.sage][i]);
        rect(c, x + 3, y + 22, 10, 5, p.ink);
        rect(c, x + 11, y + 17, 3, 3, p.gold);
    }
    else if (o.kind === 'bike') {
        for (const offset of [6, w - 6]) {
            rect(c, x + offset - 5, y + 5, 10, 2, p.ink);
            rect(c, x + offset - 5, y + 12, 10, 2, p.ink);
            rect(c, x + offset - 5, y + 5, 2, 9, p.ink);
            rect(c, x + offset + 3, y + 5, 2, 9, p.ink);
        }
        rect(c, x + 7, y + 6, 17, 2, p.blue);
        rect(c, x + 17, y + 1, 2, 10, p.blue);
        rect(c, x + 14, y + 1, 7, 2, p.wood);
    }
    else if (o.kind === 'gate') {
        rect(c, x + 3, y + 4, 3, h - 4, p.wood);
        rect(c, x + w - 6, y + 4, 3, h - 4, p.wood);
        rect(c, x, y + 2, w, 15, p.coral);
        text(c, o.label ?? '', x + w / 2, y + 13, 8, p.paper);
        for (let i = 9; i < w; i += 12) {
            const offset = reduced ? 0 : Math.round(Math.sin(time + i) * 1);
            rect(c, x + i, y + 18 + offset, 6, 5, i % 24 === 9 ? p.mustard : p.blue);
        }
    }
    if (o.kind === 'building') {
        rect(c, x + w - 21, y - 3, 8, 18, p.wood);
        rect(c, x + w - 23, y - 4, 12, 3, p.terracotta);
        rect(c, x + w - 20, y, 5, 9, p.roofLight);
        rect(c, x + 4, y + 33, w - 8, 2, p.shadow);
        rect(c, x + 5, y + 38, 2, 23, p.roof);
        rect(c, x + 28, y + 38, 2, 23, p.roof);
        rect(c, x + w - 31, y + 38, 2, 23, p.roof);
        rect(c, x + w - 7, y + 38, 2, 23, p.roof);
        rect(c, x + 10, y + 41, 3, 14, p.paper);
        rect(c, x + w - 26, y + 41, 3, 14, p.paper);
        rect(c, x + 4, y + h - 13, 9, 10, p.terracotta);
        rect(c, x + 2, y + h - 16, 13, 5, p.sage);
        rect(c, x + 7, y + h - 19, 4, 6, p.green);
        rect(c, x + w - 16, y + h - 25, 10, 18, p.paper);
        rect(c, x + w - 15, y + h - 24, 8, 4, p.coral);
        rect(c, x + w - 14, y + h - 17, 6, 1, p.wood);
        rect(c, x + w - 14, y + h - 14, 5, 1, p.wood);
        if (o.id === 'print') {
            rect(c, x + 33, y + 46, 7, 14, p.night);
            rect(c, x + 32, y + 44, 9, 3, p.paper);
        }
        if (o.id === 'books') {
            for (let i = 0; i < 4; i++)
                rect(c, x + 34 + i * 4, y + 46, 3, 12, clothColors[i]);
        }
        if (o.interaction === 'service')
            drawActor(c, { id: 'reception', source: 'npc', sceneId: '', position: { x: o.origin.x + o.width / 2, y: o.origin.y + o.height + .2 }, avatarId: 'human-blue', facing: 'down', action: 'idle' }, reduced ? 0 : time);
    }
}
