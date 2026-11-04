export type PublicHistoryMatch = {
  _id: string; status: 'confirmed'; format: 'singles' | 'doubles';
  sport?: string; date?: string; location?: string; duration?: string;
  players: Array<{ userId: string; name: string; avatar?: string; sets: Array<number | null>; role?: 'side-1' | 'side-2' }>;
  resultConflict: boolean; winnerUserIds?: string[];
};
export type PublicHistoryPage = {
  userId: string; matches: PublicHistoryMatch[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
};

export const publicHistoryId = (value: unknown): string =>
  typeof value === 'string' && /^[a-f\d]{24}$/.test(value) ? value : '';

const invalid = (): never => { throw new Error('Invalid public match history response'); };
const object = (value: any): boolean => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const optionalText = (value: unknown, max: number): string | undefined => {
  if (value === undefined) return undefined;
  return typeof value === 'string' && value.length <= max ? value : invalid();
};

export function readPublicHistoryMatch(value: any, userId: string, matchId?: string): PublicHistoryMatch {
  if (!publicHistoryId(userId) || !object(value) || !publicHistoryId(value._id) || (matchId && value._id !== matchId)
    || value.status !== 'confirmed' || !['singles', 'doubles'].includes(value.format) || typeof value.resultConflict !== 'boolean'
    || !Array.isArray(value.players) || value.players.length !== (value.format === 'doubles' ? 4 : 2)) return invalid();
  const players: PublicHistoryMatch['players'] = value.players.map((player: any) => {
    if (!object(player) || !publicHistoryId(player.userId) || typeof player.name !== 'string' || player.name.length > 120
      || !Array.isArray(player.sets) || player.sets.length > 10
      || player.sets.some((set: any) => set !== null && !(Number.isSafeInteger(set) && set >= 0))
      || (player.role !== undefined && !['side-1', 'side-2'].includes(player.role))) return invalid();
    return { userId: player.userId, name: player.name, avatar: optionalText(player.avatar, 2048), sets: [...player.sets], role: player.role };
  });
  const ids = players.map(player => player.userId);
  if (!ids.includes(userId) || new Set(ids).size !== ids.length) return invalid();
  const winners = value.winnerUserIds;
  if (winners !== undefined && (!Array.isArray(winners) || !winners.length || winners.length > 2
    || new Set(winners).size !== winners.length || winners.some((id: any) => !ids.includes(id)) || value.resultConflict)) return invalid();
  return { _id: value._id, status: 'confirmed', format: value.format, players, resultConflict: value.resultConflict,
    ...(winners ? { winnerUserIds: [...winners] } : {}), sport: optionalText(value.sport, 80), date: optionalText(value.date, 80),
    location: optionalText(value.location, 300), duration: optionalText(value.duration, 80) };
}

export function readPublicHistoryPage(value: any, userId: string, limit: number, requestedCursor?: string): PublicHistoryPage {
  if (!object(value) || value.userId !== userId || !Array.isArray(value.matches) || value.matches.length > limit
    || !object(value.pagination) || value.pagination.limit !== limit || typeof value.pagination.hasMore !== 'boolean') return invalid();
  const { hasMore, nextCursor } = value.pagination;
  if (hasMore ? (!value.matches.length || typeof nextCursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(nextCursor) || nextCursor === requestedCursor)
    : nextCursor !== null) return invalid();
  const matches = value.matches.map((match: any) => readPublicHistoryMatch(match, userId));
  if (new Set(matches.map((match: PublicHistoryMatch) => match._id)).size !== matches.length) return invalid();
  return { userId, matches, pagination: { limit, hasMore, nextCursor } };
}

export const publicHistoryFailure = (error: any): 'private' | 'unavailable' | 'load' => {
  const status = error?.response?.status;
  return status === 401 || status === 403 ? 'private' : status === 404 ? 'unavailable' : 'load';
};
