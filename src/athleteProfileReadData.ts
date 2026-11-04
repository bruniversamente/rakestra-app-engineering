import { publicHistoryId } from './publicMatchHistoryData.ts';

export const exactProfileId = (value: any): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const ids = [value._id, value.id].filter(id => id !== undefined);
  return ids.length && ids.every(id => typeof id === 'string' && id.trim() && id === ids[0]) ? ids[0] : '';
};

export function readAthleteProfile(value: any, userId: string) {
  if (!publicHistoryId(userId) || exactProfileId(value) !== userId || typeof value.name !== 'string'
    || (value.secondarySports !== undefined && (!Array.isArray(value.secondarySports) || value.secondarySports.some((sport: any) => typeof sport !== 'string')))) {
    throw new Error('Invalid athlete profile response');
  }
  return value;
}

export type AthleteProfilePosts = { posts: any[]; hasMore: boolean };
export function readAthleteProfilePosts(value: any, cursor: unknown, userId: string): AthleteProfilePosts {
  if (!publicHistoryId(userId) || !Array.isArray(value) || value.length > 50
    || value.some(post => !publicHistoryId(exactProfileId(post)) || (typeof post.authorId === 'string' ? post.authorId : exactProfileId(post.authorId)) !== userId)
    || new Set(value.map(exactProfileId)).size !== value.length) throw new Error('Invalid profile posts response');
  if (cursor !== undefined && cursor !== '' && (typeof cursor !== 'string' || cursor.length > 160
    || !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z_[a-f\d]{24}$/.test(cursor) || value.length !== 50)) throw new Error('Invalid profile posts cursor');
  return { posts: value, hasMore: Boolean(cursor) };
}
