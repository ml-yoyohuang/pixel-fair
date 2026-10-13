export interface Asset {
    id: string;
    url: string;
    kind: 'image' | 'download' | 'procedural';
    credit: string;
}
const ids = ['mail', 'train', 'repair', 'tide', 'star', 'nap', 'plant', 'weather', 'pocket', 'candy', 'page', 'sketch'];
export const manifest: Asset[] = [...ids.flatMap(id => [{ id: `cover-${id}`, url: `/assets/cover-${id}.svg`, kind: 'image' as const, credit: '原創 SVG / scripts/generate-assets.mjs' }, ...[1, 2, 3].map(n => ({ id: `preview-${id}-${n}`, url: `/assets/preview-${id}-${n}.svg`, kind: 'image' as const, credit: '原創試閱' }))]), { id: 'free-page', url: '/assets/free-page.txt', kind: 'download', credit: '原創短篇' }, { id: 'town-bgm', url: 'procedural:town-bgm-v1', kind: 'procedural', credit: '原創 Web Audio 結構化旋律與伴奏' }, { id: 'street-art', url: 'procedural:street-v1', kind: 'procedural', credit: '原創 Canvas 點陣素材' }];
function hostedUrl(url:string){return url.startsWith('/assets/')?`${import.meta.env.BASE_URL}${url.slice(1)}`:url;}
export function assetUrl(id: string) { return hostedUrl(manifest.find(a => a.id === id)?.url ?? ''); }
export async function preload(onProgress: (n: number) => void) { let count = 0; const images = manifest.filter(a => a.id.startsWith('cover-')); await Promise.all(images.map(a => new Promise<void>((resolve, reject) => { const i = new Image(); i.onload = () => { onProgress(++count / images.length); resolve(); }; i.onerror = () => reject(Error('素材載入失敗，請重試。')); i.src = hostedUrl(a.url); }))); }
