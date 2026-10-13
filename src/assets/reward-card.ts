import type { RewardSnapshot, SceneView, BoothSummary, StampCampaign } from '../domain/models';
import { SceneRenderer } from '../game/renderer';
import { drawActor, rect, text } from '../game/art';
import { palette as p } from '../styles/palette';
export function renderRewardCard(reward: RewardSnapshot, scene: SceneView, booths: BoothSummary[], campaigns: StampCampaign[]) {
    const card = document.createElement('canvas');
    card.width = 1600;
    card.height = 1000;
    const c = card.getContext('2d')!;
    rect(c, 0, 0, 1600, 1000, p.cream);
    rect(c, 35, 35, 1530, 930, p.wood);
    rect(c, 43, 43, 1514, 914, p.paper);
    const miniature = document.createElement('canvas');
    miniature.width = 400;
    miniature.height = 155;
    const renderer = new SceneRenderer(miniature, scene, booths, campaigns);
    const position = scene.definition.rewardViewPoint ?? { x: scene.definition.width / 2, y: scene.definition.height / 2 };
    renderer.draw(0, { id: 'background', source: 'local', sceneId: scene.definition.id, position, avatarId: 'human-sage', facing: 'up', action: 'idle' }, [], null, null, true, true);
    c.imageSmoothingEnabled = false;
    c.drawImage(miniature, 80, 180, 1440, 558);
    rect(c, 80, 180, 1440, 558, '#f4e6c518');
    text(c, '黃 昏 故 事 街', 800, 125, 58, p.wood);
    text(c, '街角六景集章散步  /  2026', 800, 163, 23, p.shadow);
    rect(c, 570, 490, 440, 190, p.pavingLight);
    drawActor(c, { id: 'reward-player', source: 'local', sceneId: scene.definition.id, position: { x: 50, y: 42 }, facing: 'down', action: 'idle', avatarId: reward.avatarId }, 0, 6);
    drawActor(c, { id: 'reward-companion', source: 'npc', sceneId: scene.definition.id, position: { x: 61, y: 42 }, facing: 'down', action: 'idle', avatarId: reward.companionId }, 0, 4);
    const dx = 615, dy = 630;
    if (reward.detailId === 'books') {
        rect(c, dx, dy, 62, 65, p.mustard);
        rect(c, dx + 10, dy - 23, 25, 45, p.blue);
        rect(c, dx + 38, dy - 12, 22, 33, p.coral);
        rect(c, dx + 10, dy - 17, 25, 4, p.paper);
    }
    else if (reward.detailId === 'coffee') {
        rect(c, dx, dy, 43, 48, p.paper);
        rect(c, dx + 42, dy + 9, 17, 22, p.wood);
        rect(c, dx + 45, dy + 12, 10, 16, p.pavingLight);
        text(c, '♥', dx + 24, dy - 7, 28, p.coral);
    }
    else {
        rect(c, dx - 12, dy + 35, 69, 35, p.paper);
        text(c, 'STORY', dx + 23, dy + 61, 17, p.coral);
    }
    text(c, `${reward.nicknameSnapshot} 的黃昏散步`, 800, 817, 42, p.wood);
    text(c, '把喜歡的故事，帶進街角的晚風。', 800, 864, 26, p.shadow);
    rect(c, 1280, 780, 160, 130, p.coral);
    rect(c, 1288, 788, 144, 114, p.paper);
    text(c, '六景完成', 1360, 844, 27, p.coral);
    text(c, '6 / 6', 1360, 884, 24, p.coral);
    const localDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(new Date(reward.issuedAt));
    text(c, `虛構內容 Demo · ${localDate} · recipe ${reward.recipeVersion}`, 800, 925, 18, p.shadow);
    return card;
}
