/**
 * mock 数据集（`?mock=1` 离线预览）。
 *
 * 以 2026-11-16 过盾抓取的真实样本（.probe/）为底裁剪：
 * 分类、主题标题与用户名保留（公开数据），cooked 正文一律替换为编写的占位 HTML。
 * 另含空分页样例（Review Focus #5）与 `?blocked=1` 的 403 盾样例（走查引导文案）。
 */

export interface MockContext {
  method?: string;
}

export interface MockResponse {
  status: number;
  body: string;
}

interface MockUser {
  id: number;
  username: string;
  name: string;
  avatar_template: string;
  flair_name?: string | null;
  flair_url?: string | null;
  flair_bg_color?: string | null;
}

interface MockCategory {
  id: number;
  name: string;
  slug: string;
  color: string;
  text_color: string;
  topic_count: number;
  post_count: number;
  position: number;
  description_excerpt: string;
  read_restricted?: boolean;
  permission?: number;
  subcategory_ids?: number[];
  has_children?: boolean;
}

const CATEGORIES: MockCategory[] = [
  { id: 4, name: '开发调优', slug: 'develop', color: '32c3c3', text_color: '000000', topic_count: 128171, post_count: 1941746, position: 1, description_excerpt: '此版块包含开发、测试、调试、部署、优化、安全等方面的内容。', permission: 1, has_children: false },
  { id: 98, name: '国产替代', slug: 'domestic', color: 'D12C25', text_color: 'FFFFFF', topic_count: 4182, post_count: 58011, position: 2, description_excerpt: '国产软硬件替代方案的交流阵地。', permission: 1, has_children: false },
  { id: 14, name: '资源荟萃', slug: 'resource', color: '12A89D', text_color: 'FFFFFF', topic_count: 29058, post_count: 210432, position: 3, description_excerpt: '软件、教程、素材等资源的分享与求助。', permission: 1, has_children: false },
  { id: 42, name: '文档共建', slug: 'wiki', color: '9cb6c4', text_color: '000000', topic_count: 1614, post_count: 9882, position: 4, description_excerpt: '协作共建的文档与知识库。', permission: 1, has_children: false },
  { id: 27, name: '非我莫属', slug: 'job', color: 'a8c6fe', text_color: '000000', topic_count: 1963, post_count: 12904, position: 5, description_excerpt: '求职、招聘与职业发展交流。', permission: 1, has_children: false },
  { id: 32, name: '读书成诗', slug: 'reading', color: 'e0d900', text_color: '000000', topic_count: 1412, post_count: 8421, position: 6, description_excerpt: '读书笔记、书评与阅读分享。', permission: 1, has_children: false },
  { id: 34, name: '前沿快讯', slug: 'news', color: 'BB8FCE', text_color: '000000', topic_count: 28068, post_count: 98201, position: 7, description_excerpt: '科技前沿资讯的速递与讨论。', permission: 1, has_children: false },
  { id: 92, name: '网络记忆', slug: 'feeds', color: 'F7941D', text_color: '000000', topic_count: 77, post_count: 812, position: 8, description_excerpt: '值得留存的网络内容存档。', permission: 1, has_children: false },
  { id: 36, name: '福利羊毛', slug: 'welfare', color: 'E45735', text_color: 'FFFFFF', topic_count: 19889, post_count: 156210, position: 9, description_excerpt: '优惠、福利与羊毛线报。', permission: 1, has_children: false },
  { id: 11, name: '搞七捻三', slug: 'gossip', color: '3AB54A', text_color: '000000', topic_count: 274830, post_count: 3120845, position: 10, description_excerpt: '闲聊灌水，天下大事。', permission: 1, has_children: false },
  { id: 110, name: '虫洞广场', slug: 'square', color: 'ff00f7', text_color: '000000', topic_count: 140, post_count: 2044, position: 11, description_excerpt: '跨越次元的交流广场。', permission: 1, has_children: false },
  { id: 2, name: '运营反馈', slug: 'feedback', color: '808281', text_color: '000000', topic_count: 7023, post_count: 41255, position: 12, description_excerpt: '站点运营公告与反馈收集。', permission: 1, has_children: false },
];

const USERS: MockUser[] = [
  { id: 1, username: 'neo', name: 'Neo', avatar_template: '/user_avatar/linux.do/neo/{size}/136369_2.png', flair_name: 'admins', flair_url: 'battery-quarter', flair_bg_color: '00aeff' },
  { id: 2082940, username: 'bobox', name: 'bobox', avatar_template: '/user_avatar/linux.do/bobox/{size}/2082940_2.png' },
  { id: 348355, username: 'doop2010', name: 'doop', avatar_template: '/user_avatar/linux.do/doop2010/{size}/348355_2.png' },
  { id: 51201, username: 'neo_test', name: 'NT', avatar_template: '/letter_avatar_proxy/v4/letter/n/e0d900/{size}/2.png' },
  { id: 88421, username: 'qingfeng', name: '清风', avatar_template: '/letter_avatar_proxy/v4/letter/q/32c3c3/{size}/2.png' },
  { id: 10001, username: 'papaya', name: '木瓜', avatar_template: '/user_avatar/linux.do/papaya/{size}/411002_2.png' },
  { id: 20022, username: 'kernelpanic', name: 'KP', avatar_template: '/letter_avatar_proxy/v4/letter/k/BB8FCE/{size}/2.png' },
];

const userById = (id: number): MockUser => USERS.find((user) => user.id === id) ?? USERS[0];

interface MockTopicSeed {
  id: number;
  title: string;
  category_id: number;
  posts_count: number;
  reply_count: number;
  like_count: number;
  views: number;
  posters: number[];
  tags?: Array<{ id: number; name: string; slug: string }>;
  created_at: string;
  closed?: boolean;
  pinned?: boolean;
  has_accepted_answer?: boolean;
}

const TOPIC_SEEDS: MockTopicSeed[] = [
  { id: 3153778, title: '大 Vibe coding 时代，勇敢的人先站上舞台', category_id: 2, posts_count: 670, reply_count: 70, like_count: 3690, views: 35639, posters: [1, 2082940, 51201], tags: [{ id: 31, name: '公告', slug: '31-tag' }], created_at: '2026-11-11T03:20:40.638Z', pinned: true },
  { id: 847468, title: '《秘密花园园丁邀请函》', category_id: 2, posts_count: 5794, reply_count: 370, like_count: 75681, views: 440203, posters: [1, 348355], created_at: '2026-10-02T09:12:00.000Z' },
  { id: 482293, title: '请不要把互联网上的戾气带来这里！', category_id: 2, posts_count: 7974, reply_count: 429, like_count: 145426, views: 555337, posters: [1, 88421], created_at: '2026-08-15T10:00:00.000Z' },
  { id: 3187153, title: '现在逆向App用什么AI最好？', category_id: 4, posts_count: 19, reply_count: 7, like_count: 12, views: 543, posters: [2082940, 20022, 51201], created_at: '2026-11-16T09:30:00.000Z' },
  { id: 3186806, title: 'Gemini 4 oxygen 也要来了？', category_id: 34, posts_count: 44, reply_count: 16, like_count: 85, views: 2314, posters: [10001, 88421], tags: [{ id: 3871, name: '微应用', slug: '3871-tag' }], created_at: '2026-11-15T21:05:00.000Z' },
  { id: 3187514, title: 'Grok4.7怎么样？', category_id: 11, posts_count: 2, reply_count: 0, like_count: 0, views: 16, posters: [20022], created_at: '2026-11-16T14:02:00.000Z' },
  { id: 3187018, title: 'Claude新账户注册立马弹portal门户验证，中国护照秒过！', category_id: 11, posts_count: 16, reply_count: 7, like_count: 19, views: 485, posters: [51201, 10001], created_at: '2026-11-16T11:48:00.000Z' },
  { id: 3186804, title: '【消费自动抽奖】11.11大促开奖啦！ 10位幸运儿喜提官网 ¥158', category_id: 36, posts_count: 10, reply_count: 1, like_count: 1, views: 240, posters: [348355, 2082940], created_at: '2026-11-15T18:30:00.000Z' },
  { id: 3187484, title: 'claude续费报错', category_id: 11, posts_count: 2, reply_count: 0, like_count: 0, views: 44, posters: [88421], created_at: '2026-11-16T13:40:00.000Z' },
  { id: 3187516, title: '反重力手机验证有限制吗？', category_id: 11, posts_count: 1, reply_count: 0, like_count: 0, views: 1, posters: [20022], created_at: '2026-11-16T14:30:00.000Z' },
  { id: 3187333, title: '【富可敌国】飓星API 上新：租号、拼车、聚合站一站俱全｜回帖留 ID', category_id: 36, posts_count: 72, reply_count: 25, like_count: 7, views: 188, posters: [10001, 20022, 51201], created_at: '2026-11-16T07:15:00.000Z' },
  { id: 3187515, title: 'Google的ai产品怎么有点乱', category_id: 4, posts_count: 1, reply_count: 0, like_count: 0, views: 9, posters: [88421], created_at: '2026-11-16T14:28:00.000Z' },
];

const topicMock = (seed: MockTopicSeed) => ({
  id: seed.id,
  title: seed.title,
  fancy_title: seed.title,
  slug: 'topic',
  posts_count: seed.posts_count,
  reply_count: seed.reply_count,
  like_count: seed.like_count,
  op_like_count: Math.round(seed.like_count * 0.6),
  views: seed.views,
  created_at: seed.created_at,
  last_posted_at: seed.created_at,
  bumped: true,
  category_id: seed.category_id,
  tags: seed.tags ?? [],
  closed: seed.closed ?? false,
  archived: false,
  pinned: seed.pinned ?? false,
  pinned_globally: false,
  has_accepted_answer: seed.has_accepted_answer ?? false,
  posters: (seed.posters ?? []).map((userId, index) => ({
    extras: index === 0 ? 'latest single' : null,
    description: index === 0 ? '原始发帖人' : '常用发帖人',
    user_id: userId,
    primary_group_id: null,
    flair_group_id: null,
  })),
});

const listEnvelope = (seeds: MockTopicSeed[], withMoreTopics: boolean) => ({
  users: USERS.map((user) => ({ ...user })),
  primary_groups: [],
  topic_list: {
    can_create_topic: false,
    per_page: 30,
    ...(withMoreTopics ? { more_topics_url: '/latest?no_definitions=true&page=1' } : {}),
    topics: seeds.map(topicMock),
  },
});

const HOT_SEEDS = [TOPIC_SEEDS[3], TOPIC_SEEDS[4], TOPIC_SEEDS[6], TOPIC_SEEDS[7], TOPIC_SEEDS[10], TOPIC_SEEDS[0], TOPIC_SEEDS[1], TOPIC_SEEDS[2]];
const TOP_SEEDS = [TOPIC_SEEDS[0], TOPIC_SEEDS[1], TOPIC_SEEDS[2], TOPIC_SEEDS[4], TOPIC_SEEDS[6], TOPIC_SEEDS[10], TOPIC_SEEDS[7], TOPIC_SEEDS[3]];

const DETAIL_TOPIC = TOPIC_SEEDS[3];

const placeholderPost = (floor: number, userId: number, createdAt: string, options: { reactions?: number; replyTo?: number; accepted?: boolean } = {}) => {
  const user = userById(userId);
  const reactionList = options.reactions
    ? [{ id: 'heart', type: 'emoji', count: options.reactions }]
    : [];
  return {
    id: 900000 + floor,
    name: user.name,
    username: user.username,
    avatar_template: user.avatar_template,
    created_at: createdAt,
    cooked:
      floor === 1
        ? '<p>最近想逆向下日常App，弄成自己的App方便使用，发现好几个AI太容易不干活了。</p><p>（mock 占位正文：实际实现以白名单清洗后的 HTML 渲染，图片懒加载，站内链接站内跳转。）</p>'
        : `<p>（mock 占位回复 ${floor} 楼：推荐用前端渲染占位内容验证楼层样式、引用标记与表情反应条。）</p>`,
    post_number: floor,
    post_type: 1,
    posts_count: DETAIL_TOPIC.posts_count,
    reply_count: 0,
    reply_to_post_number: options.replyTo ?? null,
    quote_count: 0,
    incoming_link_count: 0,
    reads: 100 + floor,
    readers_count: 90 + floor,
    score: 1.5 * floor,
    yours: false,
    topic_id: DETAIL_TOPIC.id,
    topic_slug: 'topic',
    display_username: user.name,
    primary_group_name: null,
    flair_name: user.flair_name ?? null,
    flair_url: user.flair_url ?? null,
    flair_bg_color: user.flair_bg_color ?? null,
    flair_color: null,
    version: 1,
    can_edit: false,
    read: true,
    bookmarked: false,
    actions_summary: [],
    moderator: false,
    admin: user.id === 1,
    staff: user.id === 1,
    user_id: user.id,
    hidden: false,
    trust_level: 2,
    deleted_at: null,
    wiki: false,
    reactions: reactionList,
    user_signature: null,
    accepted_answer: options.accepted ?? false,
  };
};

const DETAIL_POSTS_PAGE1 = [
  placeholderPost(1, 2082940, '2026-11-16T09:30:00.000Z', { reactions: 3 }),
  placeholderPost(2, 20022, '2026-11-16T09:41:00.000Z', { reactions: 1 }),
  placeholderPost(3, 51201, '2026-11-16T10:02:00.000Z', { replyTo: 2 }),
  placeholderPost(4, 10001, '2026-11-16T10:33:00.000Z', { reactions: 2, accepted: true }),
  placeholderPost(5, 88421, '2026-11-16T11:20:00.000Z'),
];

const DETAIL_POSTS_PAGE2 = [
  placeholderPost(6, 348355, '2026-11-16T12:05:00.000Z', { replyTo: 4 }),
  placeholderPost(7, 2082940, '2026-11-16T13:44:00.000Z'),
];

const detailEnvelope = (page: number) => {
  const posts = page > 1 ? DETAIL_POSTS_PAGE2 : DETAIL_POSTS_PAGE1;
  return {
    post_stream: {
      posts,
      stream: [...DETAIL_POSTS_PAGE1, ...DETAIL_POSTS_PAGE2].map((post) => post.id),
    },
    timeline_lookup: [[1, 0]],
    user_badges: [],
    suggested_topics: {
      topics: [TOPIC_SEEDS[4], TOPIC_SEEDS[5], TOPIC_SEEDS[11]].map(topicMock),
    },
    tags: [],
    fancy_title: DETAIL_TOPIC.title,
    id: DETAIL_TOPIC.id,
    title: DETAIL_TOPIC.title,
    posts_count: DETAIL_TOPIC.posts_count,
    created_at: DETAIL_TOPIC.created_at,
    views: DETAIL_TOPIC.views,
    reply_count: DETAIL_TOPIC.reply_count,
    like_count: DETAIL_TOPIC.like_count,
    last_posted_at: '2026-11-16T13:44:00.000Z',
    visible: true,
    closed: false,
    archived: false,
    has_summary: false,
    archetype: 'regular',
    slug: 'topic',
    category_id: DETAIL_TOPIC.category_id,
    chunk_size: 20,
    pinned: false,
    highest_post_number: 7,
    details: {
      can_edit: false,
      notification_level: 1,
      participants: USERS.slice(1, 6).map((user) => ({ ...user, post_count: 2 })),
      created_by: { ...userById(2082940) },
      last_poster: { ...userById(2082940) },
    },
  };
};

const CHALLENGE_HTML = '<html dir="ltr"><head><title>Just a moment...</title></head><body><div class="cf-please-wait">请稍候…</div></body></html>';

export function resolveMock(url: string, _ctx?: MockContext): MockResponse | null {
  if (typeof window !== 'undefined') {
    try {
      const query = new URLSearchParams(window.location.search);
      if (query.has('blocked')) {
        return { status: 403, body: CHALLENGE_HTML };
      }
    } catch {
      // ignore
    }
  }

  const path = url.replace(/^https?:\/\/linux\.do/, '');

  if (path.startsWith('/latest.json')) {
    const page = Number(new URLSearchParams(path.split('?')[1] ?? '').get('page') ?? '1');
    // 页 2 返回空列表且无 more_topics_url：钉住空分页行为（Review Focus #5）。
    return page > 1
      ? { status: 200, body: JSON.stringify(listEnvelope([], false)) }
      : { status: 200, body: JSON.stringify(listEnvelope(TOPIC_SEEDS, false)) };
  }
  if (path.startsWith('/hot.json')) {
    return { status: 200, body: JSON.stringify(listEnvelope(HOT_SEEDS, false)) };
  }
  if (path.startsWith('/top.json')) {
    return { status: 200, body: JSON.stringify(listEnvelope(TOP_SEEDS, false)) };
  }
  if (path.startsWith('/categories.json')) {
    return {
      status: 200,
      body: JSON.stringify({ category_list: { can_create_category: false, can_create_topic: false, categories: CATEGORIES } }),
    };
  }

  const topicMatch = path.match(/^\/t\/(\d+)\.json/);
  if (topicMatch) {
    const id = Number(topicMatch[1]);
    if (id !== DETAIL_TOPIC.id) {
      return { status: 404, body: JSON.stringify({ errors: ['The requested URL or topic could not be found.'] }) };
    }
    const page = Number(new URLSearchParams(path.split('?')[1] ?? '').get('page') ?? '1');
    return { status: 200, body: JSON.stringify(detailEnvelope(page)) };
  }

  return null;
}
