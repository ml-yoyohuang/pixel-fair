export type ID = string;
export type Facing = 'up' | 'down' | 'left' | 'right';
export type Point = {
    x: number;
    y: number;
};
export interface Venue {
    id: ID;
    name: string;
}
export interface Layout {
    id: ID;
    venueId: ID;
    version: number;
    width: number;
    height: number;
}
export interface BoothSlot {
    id: ID;
    layoutId: ID;
    code: string;
    zoneId: ID;
    origin: Point;
    width: number;
    height: number;
    facing: Facing;
    interactionAnchors: Point[];
    npcStopPoints: Point[];
}
export interface Circle {
    id: ID;
    name: string;
    author: string;
}
export interface Participation {
    id: ID;
    eventId: ID;
    circleId: ID;
    intro: string;
    greeting: string;
    attendantAvatarId: ID;
    decoration: {
        tableclothId: ID;
        signId: ID;
        propIds: ID[];
    };
    status: 'published';
}
export interface Assignment {
    participationId: ID;
    slotIds: ID[];
}
export interface Work {
    id: ID;
    circleId: ID;
    title: string;
    medium: 'comic' | 'novel' | 'illustration' | 'goods';
    coverAssetId: ID;
    description: string;
    preview: {
        kind: 'images';
        assetIds: ID[];
    } | {
        kind: 'text';
        paragraphs: string[];
    } | {
        kind: 'none';
    };
}
export interface Exhibit {
    id: ID;
    participationId: ID;
    workId: ID;
    release: 'new' | 'existing';
    availability: 'sale' | 'free' | 'display';
    priceLabel?: string;
    url?: string;
    downloadAssetId?: ID;
    demoOnly: boolean;
}
export interface StampCampaign {
    id: ID;
    eventId: ID;
    title: string;
    participantIds: ID[];
    requiredCount: number;
    rewardRecipeId: ID;
}
export interface RewardSnapshot {
    eventId: ID;
    campaignId: ID;
    issuedAt: string;
    avatarId: ID;
    nicknameSnapshot: string;
    companionId: ID;
    detailId: ID;
    recipeVersion: number;
}
export interface ActorState {
    id: ID;
    source: 'local' | 'npc' | 'remote';
    sceneId: ID;
    position: Point;
    facing: Facing;
    action: 'idle' | 'walk' | 'sit';
    avatarId: ID;
}
export interface SceneObject {
    id: ID;
    kind: 'building' | 'tree' | 'bench' | 'poster' | 'board' | 'plant' | 'lamp' | 'bike' | 'vending' | 'gate' | 'stringLights';
    origin: Point;
    width: number;
    height: number;
    label?: string;
    color?: string;
    collidable?: boolean;
    anchor?: Point;
    interaction?: 'service' | 'bookshop' | 'coffee' | 'print' | 'board' | 'poster' | 'reader' | 'seat';
}
export interface SceneDefinition {
    id: ID;
    width: number;
    height: number;
    spawn: Point;
    rewardViewPoint?: Point;
    objects: SceneObject[];
    npcWaypoints: Point[];
    ground: {
        x: number;
        y: number;
        width: number;
        height: number;
        kind: 'street' | 'plaza' | 'alley';
        label?: string;
    }[];
}
export interface EventView {
    id: ID;
    name: string;
    tagline: string;
    layout: Layout;
    venue: Venue;
    sceneId: ID;
    startsAt: string;
    endsAt: string;
    timezone: string;
    announcements: string[];
}
export interface SceneView {
    definition: SceneDefinition;
    slots: BoothSlot[];
    assignments: Assignment[];
}
export interface BoothSummary {
    participation: Participation;
    circle: Circle;
    slots: BoothSlot[];
    works: WorkDetail[];
}
export type BoothDetail = BoothSummary;
export interface WorkDetail {
    work: Work;
    exhibit: Exhibit;
    author: string;
}
export interface ContentRepository {
    getEvent(id: ID): Promise<EventView>;
    getScene(id: ID): Promise<SceneView>;
    listBooths(eventId: ID): Promise<BoothSummary[]>;
    getBooth(eventId: ID, participationId: ID): Promise<BoothDetail>;
    getWork(eventId: ID, exhibitId: ID): Promise<WorkDetail>;
    listCampaigns(eventId: ID): Promise<StampCampaign[]>;
}
export interface Settings {
    music: boolean;
    sfx: boolean;
    musicVolume: number;
    sfxVolume: number;
    reducedMotion: boolean;
    textSize: number;
    npcCount: number;
}
export interface VisitorState {
    schemaVersion: 2;
    eventId: ID;
    entered: boolean;
    avatarId: ID;
    nickname: string;
    position: Point;
    boothFavorites: ID[];
    workFavorites: ID[];
    stamps: Record<ID, ID[]>;
    rewards: Record<ID, RewardSnapshot>;
    settings: Settings;
    tutorialSeen: boolean;
}
