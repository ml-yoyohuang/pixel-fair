import type { BoothSlot, Circle, Participation, Work, Exhibit, EventView, SceneDefinition, SceneView, StampCampaign, WorkDetail, BoothSummary } from '../../domain/models';
export const EVENT_ID = 'twilight-only';
export const avatarNames: Record<string, string> = { 'human-amber': '小杏', 'human-blue': '阿澄', 'human-sage': '青禾', 'cat': '奶茶貓', 'dog': '豆柴', 'rabbit': '白兔' };
const seeds = [
    ['mail', '雨後郵局', '小雨', '寄給明天的信', 'comic', '郵差收到一封明天才會寫出的信。沿著雨後的屋簷，他把尚未發生的心事送到收件人手中。', '新作在左邊，歡迎翻翻！', '每個信封，都有自己的天氣。'],
    ['train', '夜車終點', '里山', '末班車不靠站', 'comic', '夜班司機與一位提著空行李的乘客，在城市睡著後，繞行地圖上不存在的車站。', '末班車還沒走，慢慢看！', '收藏夜色與城市邊緣的短篇。'],
    ['repair', '貓掌修理部', '阿爪', '今天也修不好', 'comic', '貓店長把收音機修成烤吐司機，狗助手只好重新寫下今日營業項目。壞掉的日子，也能變好笑。', '壞掉的心情也可以拿來修！', '一間工具比店員更可靠的動物修理店。'],
    ['tide', '紙上潮汐', '海砂', '退潮之後有人等你', 'novel', '離開海邊十年的女孩，回到祖母的小店。潮水退去以後，沙灘上出現一封留給她的邀請。', '這裡有海風，坐下讀一段吧。', '把小鎮裡不善言語的人，寫進潮汐之間。'],
    ['star', '星圖失物招領', '星野', '遺失的第七顆星', 'novel', '在負責收存失物的太空站，一顆沒有編號的星星突然醒來。管理員決定陪它找回名字。', '如果找到星星，記得通知我們。', '獻給那些還在尋找歸途的微小光芒。'],
    ['nap', '午睡色票', '眠眠', '午後的十二種顏色', 'illustration', '把曬被單、窗邊橘子、便利商店冰箱與貓的背影，裝進一冊生活色彩。', '今天最喜歡哪一種顏色？', '慢慢畫，讓日常也有自己的展覽。'],
    ['plant', '盆栽旅行社', '葉子', '帶著一盆綠出門', 'illustration', '一盆薄荷搭上火車，走過山路與海岸。旅行的距離，也可以用新葉子計算。', '盆栽今天也有好好喝水！', '帶植物去旅行，帶故事回家。'],
    ['weather', '小小天氣站', '雲朵', '晴時多雲偶有貓', 'illustration', '晴天的貓打盹，雨天的貓讀詩。四張明信片，為心情預報下一個好天氣。', '本日預報：適合逛攤。', '小小觀測員的手繪氣象紀錄。'],
    ['pocket', '口袋工房', '阿口', '城市散步貼紙', 'goods', '四款建築貼紙：老書店、木窗咖啡館、街角影印店與沒有名字的小門牌。霧面紙，約五公分。', '小門牌可以放在手帳裡喔。', '把街角的小東西裝進口袋。'],
    ['candy', '糖紙收藏室', '糖糖', '甜點徽章與票根書籤', 'goods', '奶油布丁與櫻桃汽水的圓形徽章，搭配印有虛構列車日期的厚紙書籤。', '今日甜度，剛剛好。', '保存每次旅行留下的糖紙與票根。'],
    ['page', '一頁就好', '一頁', '給路過的你', 'novel', '一頁短篇：一位總是錯過公車的人，終於在等待的時間裡，認識站牌旁的老樹。', '免費作品放這邊，帶一頁回家吧！', '不用很長，也能留下一個故事。'],
    ['sketch', '未完成陳列室', '線線', '還沒決定名字的人', 'illustration', '角色服裝、表情研究與街景鉛筆稿。未完成的空白，也是創作過程的一部分。', '攤主買飲料去了，我來顧攤！', '歡迎看看那些尚未完成的想像。']
] as const;
const tideParagraphs = [
    '小夏回到海邊那天，公車站牌比記憶裡矮了一點。她知道不是站牌變矮，而是自己終於長成了可以獨自提行李的人。十年前，她站在這裡哭，祖母把一顆薄荷糖塞進她的掌心，說海風會替她把眼淚吹乾。如今風依舊帶著鹽，手心卻沒有糖。',
    '祖母的小店還在巷尾。木門上的鈴鐺換過一次，聲音清脆得陌生。鄰居阿伯幫忙照看了好幾年，把每一天的營業額、下雨時間與路過的貓，全寫在同一本帳簿裡。他交出鑰匙時沒有說什麼，只問她要不要吃晚飯。小夏點頭，突然覺得十年的路程，可以短到一碗熱湯的距離。',
    '隔天清晨，她在櫃檯底下找到一個玻璃罐。裡面不是糖，而是一疊折得整整齊齊的信。信封上只寫著日期，沒有收件人。最上面那封說：「今天有人買走最後一張明信片。她說，要寄給還沒出生的孩子。」祖母用鉛筆補了一行：有些等待，比郵票走得更遠。',
    '小夏把店門打開，讓風吹過信紙。退潮後的沙灘露出一道彎彎的水線，像有人用手指替海畫了笑容。她沿著水線走，發現一隻小木船，船底壓著一張紙。紙上是祖母年輕時的字：「如果有一天你回來，請幫我把這個帶去燈塔。有人一直在等。」',
    '燈塔的管理員是位頭髮全白的女人。她看見木船，先笑，然後慢慢坐下。原來那是兩個女孩曾經約定的旅行：不用買船票，只要在退潮時一起走過堤岸。後來一個開店，一個守塔，約定被忙碌藏了半輩子，卻沒有真的弄丟。小夏陪她坐到午後，聽她說起那些沒有寫進信裡的夏天。',
    '回店裡的路上，小夏買了薄荷糖。她把糖放進玻璃罐，空出一個位置給新的信。今晚她想寫給明天的自己：不必立刻決定留多久，先把木門修好，把燈點亮。有人在退潮之後等你，也有人願意在漲潮之前，陪你慢慢走回家。'
];
const starParagraphs = [
    '失物招領站的窗外沒有白天，只有每隔六小時亮一次的導航燈。阿岑負責編號、擦灰與等待。他收過忘記旋律的八音盒、沒有人認領的船票，還有一雙比主人大上三個尺寸的鞋。站規第一條是：任何失物都值得被妥善保存，即使它暫時找不到用途。',
    '第七號抽屜在星期三亮起來。阿岑拉開它，看見一顆像橘子那麼大的星星，正用很小的聲音問：「請問，我是不是放錯地方了？」他翻遍登記冊，沒有找到它的名字。星星說它記得一片海、幾扇窗，和一個人抬頭時的眼睛。那些記憶都太柔軟，無法填進制式欄位。',
    '阿岑決定帶它去觀測平台。他們搭上一部緩慢的升降梯，經過沉睡的貨艙與長滿苔的管道。星星照亮每一個角落，卻總說自己不夠亮。阿岑想起父親修燈的時候，也經常這樣說。他那時不懂，後來才知道，有些人習慣把自己留在光的後面。',
    '平台上，導航系統顯示六顆恆星。第七個位置是空的。星星以為那裡就是它的家，急著往外飛，卻被一層透明的玻璃擋住。它撞得暗了一下，沒有哭。阿岑把手掌貼在玻璃旁，陪它看了很久。他說，地圖上的空位也可能只是尚未更新，不一定是誰的缺席。',
    '他們回到招領站，發現一封延遲送達的訊息。訊息來自很遠的海邊小鎮：「謝謝你保存那顆光。它不是天上的星，是我們小孩做的夜燈。離開以前，她把最喜歡的海和窗，都裝進去了。」原來星星沒有遺失，它只是帶著記憶旅行，走得比訊息更快。',
    '阿岑替它換了新的標籤：第七顆星，暫住，無領取期限。星星第一次覺得名字不必很宏大。那晚它留在窗口，照著阿岑吃一碗泡麵。窗外導航燈亮起，又熄滅。遠處的船看見這一點小光，知道有人還醒著。這就足夠成為一個地方的名字。'
];
export const circles: Circle[] = seeds.map(s => ({ id: `circle-${s[0]}`, name: s[1], author: s[2] }));
export const participations: Participation[] = seeds.map((s, i) => ({ id: `part-${s[0]}`, eventId: EVENT_ID, circleId: `circle-${s[0]}`, intro: s[7], greeting: s[6], attendantAvatarId: Object.keys(avatarNames)[i % 6], decoration: { tableclothId: `cloth-${i}`, signId: s[0], propIds: [s[0]] }, status: 'published' }));
export const works: Work[] = seeds.map(s => ({ id: `work-${s[0]}`, circleId: `circle-${s[0]}`, title: s[3], medium: s[4], coverAssetId: `cover-${s[0]}`, description: s[5], preview: s[4] === 'novel' ? { kind: 'text', paragraphs: s[0] === 'tide' ? tideParagraphs : s[0] === 'star' ? starParagraphs : ['站牌旁的老樹每天都看著同一位少年錯過公車。他總是在最後一秒跑來，鞋帶散了，麵包還叼在嘴上。少年以為等待是浪費，直到有一天，他聽見樹葉在說話。', '「你知道嗎？今天第一隻鳥比昨天早來了三分鐘。」老樹說。少年抬頭，看見巢裡三個小腦袋。他第一次沒有拿出手機，而是把麵包掰成兩半，自己吃一半，另一半留給回來的風。', '下一班公車停下時，少年忽然不急了。他向老樹揮手，說明天見。原來一段等待，也能長成一個小小的約定。'] } : { kind: 'images', assetIds: s[4] === 'comic' ? [`preview-${s[0]}-1`, `preview-${s[0]}-2`, `preview-${s[0]}-3`] : [`preview-${s[0]}-1`, `preview-${s[0]}-2`] } }));
export const exhibits: Exhibit[] = seeds.map((s, i) => ({ id: `exhibit-${s[0]}`, participationId: `part-${s[0]}`, workId: `work-${s[0]}`, release: i % 3 === 1 ? 'existing' : 'new', availability: i === 10 ? 'free' : i === 11 ? 'display' : 'sale', priceLabel: i < 10 ? `Demo · NT$ ${i < 5 ? 180 : 120}` : undefined, downloadAssetId: i === 10 ? 'free-page' : undefined, demoOnly: true }));
// Display codes may change; associations always use stable descriptive IDs.
const locations = [[8, 9], [14, 9], [20, 9], [8, 18], [14, 18], [20, 18], [29, 8], [35, 8], [29, 18], [35, 18], [43, 12], [43, 20]];
export const slots: BoothSlot[] = seeds.map((s, i) => ({ id: `slot-${s[0]}`, layoutId: 'street-layout-v1', code: `A${String(i + 1).padStart(2, '0')}`, zoneId: i < 6 ? 'main' : i < 10 ? 'plaza' : 'alley', origin: { x: locations[i][0], y: locations[i][1] }, width: 3, height: 2, facing: 'down', interactionAnchors: [{ x: locations[i][0] + 1, y: locations[i][1] + 2 }], npcStopPoints: [{ x: locations[i][0] + 2, y: locations[i][1] + 3 }] }));
export const event: EventView = { id: EVENT_ID, name: '黃昏故事街', tagline: '把喜歡的故事，帶進街角的晚風。', layout: { id: 'street-layout-v1', venueId: 'venue-dusk', version: 1, width: 52, height: 32 }, venue: { id: 'venue-dusk', name: '黃昏商店街' }, sceneId: 'dusk-street', startsAt: '2026-10-13T00:00:00+08:00', endsAt: '2026-12-31T23:59:59+08:00', timezone: 'Asia/Taipei', announcements: ['歡迎來到線上原創市集！所有作品都是本 Demo 的原創內容。', '沿街有十二個創作攤位。點地面走動，點攤桌會帶你到桌前，再按「查看」。', '六個集章攤位散落主街、廣場與支巷。集滿後到影印店領取紀念卡。'] };
export const scene: SceneDefinition = {
    id: 'dusk-street', width: 52, height: 32, spawn: { x: 5, y: 12 }, rewardViewPoint: { x: 24, y: 5.5 }, ground: [{ x: 3, y: 7, width: 23, height: 22, kind: 'street', label: '主 街' }, { x: 26, y: 6, width: 14, height: 22, kind: 'plaza', label: '小 廣 場' }, { x: 40, y: 8, width: 9, height: 20, kind: 'alley', label: '支 巷' }], objects: [
        { id: 'plaza-lights', kind: 'stringLights', origin: { x: 27, y: 5 }, width: 12, height: 1, collidable: false },
        { id: 'service', kind: 'building', origin: { x: 1, y: 5 }, width: 5, height: 5, label: '服務處', color: 'blue', anchor: { x: 3, y: 10 }, interaction: 'service' },
        { id: 'books', kind: 'building', origin: { x: 7, y: 1 }, width: 7, height: 6, label: '暮色書店', color: 'sage', anchor: { x: 10, y: 7 }, interaction: 'bookshop' },
        { id: 'print', kind: 'building', origin: { x: 16, y: 1 }, width: 8, height: 6, label: '街角影印店', color: 'coral', anchor: { x: 20, y: 7 }, interaction: 'print' },
        { id: 'cafe', kind: 'building', origin: { x: 41, y: 2 }, width: 8, height: 6, label: '慢慢咖啡', color: 'mustard', anchor: { x: 45, y: 8 }, interaction: 'coffee' },
        { id: 'house-one', kind: 'building', origin: { x: 8, y: 24 }, width: 7, height: 6, label: '山田雜貨', color: 'mustard' },
        { id: 'house-two', kind: 'building', origin: { x: 17, y: 24 }, width: 8, height: 6, label: '小巷日常', color: 'sage' },
        { id: 'gate', kind: 'gate', origin: { x: 1, y: 14 }, width: 6, height: 2, label: '故事市集' },
        { id: 'board', kind: 'board', origin: { x: 33, y: 3 }, width: 3, height: 2, label: '公告欄', anchor: { x: 34, y: 5 }, interaction: 'board' },
        { id: 'poster', kind: 'poster', origin: { x: 26, y: 23 }, width: 1, height: 2, anchor: { x: 27, y: 24 }, interaction: 'poster' },
        { id: 'seat', kind: 'bench', origin: { x: 42, y: 25 }, width: 3, height: 1, anchor: { x: 43, y: 26 }, interaction: 'seat' },
        { id: 'reader', kind: 'bench', origin: { x: 47, y: 16 }, width: 2, height: 1, label: '讀書的兔子', anchor: { x: 48, y: 17 }, interaction: 'reader' },
        { id: 'photo', kind: 'gate', origin: { x: 30, y: 25 }, width: 7, height: 2, label: '故事在這裡相遇' },
        { id: 'bench-square', kind: 'bench', origin: { x: 31, y: 13 }, width: 3, height: 1 },
        { id: 'tree-1', kind: 'tree', origin: { x: 1, y: 20 }, width: 3, height: 4 },
        { id: 'tree-2', kind: 'tree', origin: { x: 26, y: 1 }, width: 3, height: 4 },
        { id: 'tree-3', kind: 'tree', origin: { x: 37, y: 24 }, width: 3, height: 4 },
        { id: 'tree-4', kind: 'tree', origin: { x: 48, y: 25 }, width: 3, height: 4 },
        { id: 'pot-1', kind: 'plant', origin: { x: 7, y: 7 }, width: 1, height: 1 },
        { id: 'pot-2', kind: 'plant', origin: { x: 24, y: 7 }, width: 1, height: 1 },
        { id: 'pot-3', kind: 'plant', origin: { x: 40, y: 10 }, width: 1, height: 1 },
        { id: 'bike', kind: 'bike', origin: { x: 26, y: 17 }, width: 2, height: 1 },
        { id: 'vending', kind: 'vending', origin: { x: 49, y: 10 }, width: 1, height: 2 },
        { id: 'lamp-1', kind: 'lamp', origin: { x: 6, y: 13 }, width: 1, height: 2 },
        { id: 'lamp-2', kind: 'lamp', origin: { x: 25, y: 13 }, width: 1, height: 2 },
        { id: 'lamp-3', kind: 'lamp', origin: { x: 39, y: 15 }, width: 1, height: 2 }
    ], npcWaypoints: [{ x: 10, y: 13 }, { x: 17, y: 14 }, { x: 22, y: 22 }, { x: 30, y: 12 }, { x: 36, y: 22 }, { x: 45, y: 23 }, { x: 43, y: 26 }]
};
export const sceneView: SceneView = { definition: scene, slots, assignments: participations.map((p, i) => ({ participationId: p.id, slotIds: [slots[i].id] })) };
export const testScene: SceneView = { definition: { id: 'test-yard', width: 16, height: 14, spawn: { x: 2, y: 10 }, ground: [{ x: 1, y: 1, width: 14, height: 12, kind: 'plaza' }], objects: [], npcWaypoints: [{ x: 4, y: 8 }, { x: 10, y: 8 }] }, slots: slots.slice(0, 2).map((s, i) => ({ ...s, origin: { x: 3 + i * 6, y: 3 }, interactionAnchors: [{ x: 4 + i * 6, y: 5 }], npcStopPoints: [{ x: 5 + i * 6, y: 6 }] })), assignments: sceneView.assignments.slice(0, 2) };
export const campaigns: StampCampaign[] = [{ id: 'six-corners', eventId: EVENT_ID, title: '街角六景集章散步', participantIds: participations.filter((_, i) => i % 2 === 0).map(p => p.id), requiredCount: 6, rewardRecipeId: 'dusk-card-v1' }];
export function boothData(): BoothSummary[] { return participations.map(p => ({ participation: p, circle: circles.find(c => c.id === p.circleId)!, slots: slots.filter(s => sceneView.assignments.find(a => a.participationId === p.id)?.slotIds.includes(s.id)), works: exhibits.filter(e => e.participationId === p.id).map(e => ({ exhibit: e, work: works.find(w => w.id === e.workId)!, author: circles.find(c => c.id === p.circleId)!.author })) })); }
export function workData(id: string): WorkDetail | undefined { return boothData().flatMap(b => b.works).find(w => w.exhibit.id === id); }
