/**
 * linux.do 公开 Discourse JSON 的最小消费模型。
 * 字段以 2026-11-16 实测样本（.probe/）为准；只声明 UI 用到的字段，
 * 其余字段原样存在但不进类型。
 *
 * 注意：linux.do 是 Discourse 改版 —— `tags` 是对象数组 `{id,name,slug}`
 * （不是 string[]）；楼层点赞被 emoji `reactions` 替换，没有 per-post like_count。
 */

export interface Category {
  id: number;
  name: string;
  slug: string;
  color: string;
  text_color: string;
  emoji?: string;
  description_excerpt?: string;
  topic_count: number;
  post_count?: number;
  read_restricted: boolean;
  has_children?: boolean;
  subcategory_ids?: number[];
  permission?: number;
}

export interface TopicTag {
  id: number;
  name: string;
  slug: string;
}

export interface TopicPoster {
  user_id: number;
  description?: string;
  primary_group_id?: number | null;
  flair_group_id?: number | null;
}

export interface DiscourseUser {
  id: number;
  username: string;
  name?: string;
  avatar_template: string;
  flair_name?: string | null;
  flair_url?: string | null;
  flair_bg_color?: string | null;
  flair_color?: string | null;
  admin?: boolean;
  moderator?: boolean;
}

export interface Topic {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  like_count?: number;
  op_like_count?: number;
  views: number;
  created_at: string;
  last_posted_at?: string | null;
  category_id: number;
  tags: TopicTag[];
  closed?: boolean;
  archived?: boolean;
  pinned?: boolean;
  pinned_globally?: boolean;
  bumped?: boolean;
  has_accepted_answer?: boolean;
  posters?: TopicPoster[];
  excerpt?: string;
}

export interface PostReaction {
  id: string;
  type?: string;
  count: number;
}

export interface Post {
  id: number;
  username: string;
  name?: string;
  avatar_template: string;
  created_at: string;
  cooked: string;
  post_number: number;
  reply_to_post_number?: number | null;
  reads?: number;
  score?: number;
  reactions?: PostReaction[];
  trust_level?: number;
  wiki?: boolean;
  accepted_answer?: boolean;
  user_signature?: string | null;
  primary_group_name?: string | null;
  flair_name?: string | null;
  flair_url?: string | null;
  flair_bg_color?: string | null;
  flair_color?: string | null;
  admin?: boolean;
  moderator?: boolean;
  staff?: boolean;
}

export interface TopicDetail {
  id: number;
  title: string;
  slug: string;
  posts_count: number;
  reply_count: number;
  category_id: number;
  like_count?: number;
  views: number;
  created_at: string;
  last_posted_at?: string | null;
  tags: TopicTag[];
  closed?: boolean;
  archived?: boolean;
  pinned?: boolean;
  has_accepted_answer?: boolean;
  chunk_size?: number;
  post_stream: {
    posts: Post[];
    stream: number[];
  };
  details?: {
    participants?: DiscourseUser[];
    created_by?: DiscourseUser;
    last_poster?: DiscourseUser;
  };
  suggested_topics?: { topics?: Topic[] };
}

export interface TopicListEnvelope {
  users?: DiscourseUser[];
  topic_list: {
    topics: Topic[];
    more_topics_url?: string;
    per_page?: number;
  };
}

export interface CategoriesEnvelope {
  category_list: {
    can_create_category?: boolean;
    can_create_topic?: boolean;
    categories: (Category & { subcategory_list?: Category[] })[];
  };
}

/** 列表路由类型（api.ts 重导出，供 UI 装配使用）。 */
export type ListKind = 'latest' | 'hot' | 'top' | 'cat';
export type TopPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'all';

export interface ListSource {
  kind: ListKind;
  categoryId?: number;
  slug?: string;
  period?: TopPeriod;
}
