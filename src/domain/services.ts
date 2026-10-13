import type { RewardSnapshot, StampCampaign, VisitorState } from './models';
import { rewardRecipes } from './reward-recipes';
export class StampService {
    collect(state: VisitorState, campaign: StampCampaign, participationId: string) {
        if (!campaign.participantIds.includes(participationId))
            return false;
        const stamps = state.stamps[campaign.id] ??= [];
        if (stamps.includes(participationId))
            return false;
        stamps.push(participationId);
        return true;
    }
    count(state: VisitorState, campaign: StampCampaign) { return new Set((state.stamps[campaign.id] ?? []).filter(id => campaign.participantIds.includes(id))).size; }
    complete(state: VisitorState, campaign: StampCampaign) { return this.count(state, campaign) >= campaign.requiredCount; }
}
export class RewardService {
    constructor(private rng = () => Math.random(), private now = () => new Date()) { }
    issue(state: VisitorState, campaign: StampCampaign): RewardSnapshot {
        if (state.rewards[campaign.id])
            return state.rewards[campaign.id];
        if (!new StampService().complete(state, campaign))
            throw Error('還沒集滿印章喔。');
        const recipe = rewardRecipes[campaign.rewardRecipeId as keyof typeof rewardRecipes];
        if (!recipe)
            throw Error('找不到紀念卡配方。');
        const choose = (options: readonly string[]) => options[Math.min(options.length - 1, Math.max(0, Math.floor(this.rng() * options.length)))];
        const reward: RewardSnapshot = {
            eventId: state.eventId, campaignId: campaign.id, issuedAt: this.now().toISOString(),
            avatarId: state.avatarId, nicknameSnapshot: state.nickname || '訪客',
            companionId: choose(recipe.companions), detailId: choose(recipe.details), recipeVersion: recipe.version
        };
        state.rewards[campaign.id] = reward;
        return reward;
    }
}
export function normalizeSearch(value: string) { return value.normalize('NFKC').trim().toLocaleLowerCase(); }
export function visibleNickname(value: string) { const segmenter = new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }); return Array.from(segmenter.segment(value.trim()), x => x.segment).slice(0, 12).join(''); }
