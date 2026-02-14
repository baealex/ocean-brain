import { getHash } from './hash';

function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

export function drawSketchyCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    seed: number
) {
    const segments = 24;
    const wobble = radius * 0.08;

    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const offset = seededRandom(seed + i) * wobble * 2 - wobble;
        const r = radius + offset;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();
}

export function drawSketchyLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number
) {
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const offset = Math.min(dist * 0.05, 3);
    const cpX = midX + (seededRandom(seed) * 2 - 1) * offset;
    const cpY = midY + (seededRandom(seed + 1) * 2 - 1) * offset;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cpX, cpY, x2, y2);
}

export function drawSketchyRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    seed: number
) {
    const wobble = 1;
    const tl = {
        x: x + (seededRandom(seed) * 2 - 1) * wobble,
        y: y + (seededRandom(seed + 1) * 2 - 1) * wobble
    };
    const tr = {
        x: x + w + (seededRandom(seed + 2) * 2 - 1) * wobble,
        y: y + (seededRandom(seed + 3) * 2 - 1) * wobble
    };
    const br = {
        x: x + w + (seededRandom(seed + 4) * 2 - 1) * wobble,
        y: y + h + (seededRandom(seed + 5) * 2 - 1) * wobble
    };
    const bl = {
        x: x + (seededRandom(seed + 6) * 2 - 1) * wobble,
        y: y + h + (seededRandom(seed + 7) * 2 - 1) * wobble
    };

    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(tr.x, tr.y);
    ctx.lineTo(br.x, br.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.closePath();
}

export function getSketchySeed(id: string) {
    return getHash(id);
}
