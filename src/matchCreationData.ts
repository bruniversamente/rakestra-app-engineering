import { exactProfileId } from './athleteProfileReadData.ts';
import { publicHistoryId } from './publicMatchHistoryData.ts';

const invalid = (): never => { throw new Error('Unverified match creation'); };
export const matchReferenceId = (value: any): string => publicHistoryId(typeof value === 'string' ? value : exactProfileId(value));
export const matchCreationKey = (value: unknown): value is string => typeof value === 'string' && /^match-create:[A-Za-z0-9:_-]{12,100}$/.test(value);
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const matchCreationFingerprint = (value: any): string => JSON.stringify(canonical(value));

/** Snapshot exactly the JSON sent to the server. Never accept caller-provided command identities. */
export function snapshotMatchCreationIntent(input: any, actorUserId: string): Record<string, any> {
    if (!publicHistoryId(actorUserId) || !input || typeof input !== 'object' || Array.isArray(input)
        || input.createdBy !== actorUserId || Object.prototype.hasOwnProperty.call(input, 'idempotencyKey')
        || input._id !== undefined || input.id !== undefined || input.tournamentId
        || !['singles', 'doubles'].includes(input.format) || typeof input.sport !== 'string' || !input.sport.trim()
        || input.clubId !== undefined && !publicHistoryId(input.clubId)
        || input.durationMinutes !== undefined && (!Number.isSafeInteger(input.durationMinutes) || input.durationMinutes <= 0)) return invalid();
    const ids = Array.isArray(input.players) ? input.players.map((p: any) => publicHistoryId(p?.userId)) : [];
    if (ids.length !== (input.format === 'doubles' ? 4 : 2) || ids.some((id: string) => !id)
        || !ids.includes(actorUserId) || new Set(ids).size !== ids.length) return invalid();
    for (const player of input.players) {
        if (!Array.isArray(player.sets) || !player.sets.length || player.sets.length > 20
            || player.sets.some((score: any) => !Number.isSafeInteger(score) || score < 0)
            || player.role !== undefined && typeof player.role !== 'string'
            || player.teamId !== undefined && typeof player.teamId !== 'string') return invalid();
    }
    // Reject values JSON would silently corrupt (NaN/Infinity, functions, cycles, custom objects).
    const check = (value: any, depth: number): void => {
        if (depth > 12 || typeof value === 'number' && !Number.isFinite(value)
            || ['function', 'symbol', 'bigint'].includes(typeof value)) return invalid();
        if (value && typeof value === 'object') {
            if (typeof value.toJSON === 'function' || !Array.isArray(value)
                && Object.getPrototypeOf(value)?.constructor?.name !== 'Object') return invalid();
            for (const child of Object.values(value)) check(child, depth + 1);
        }
    };
    check(input, 0);
    const raw = JSON.stringify(input);
    // Maximum UTF-8 length of this snapshot plus the key remains below the 96 kB endpoint bound.
    if (raw.length > 22_000) return invalid();
    return JSON.parse(raw);
}

export function readMatchCreationReceipt(receipt: any, actorUserId: string, key: string): string {
    if (!publicHistoryId(actorUserId) || !matchCreationKey(key) || receipt?.version !== 1
        || receipt.actorUserId !== actorUserId || receipt.idempotencyKey !== key || !publicHistoryId(receipt.matchId)) return invalid();
    return receipt.matchId;
}

/** A creation receipt proves identity only; read the actual match before continuing its result. */
export function readCreatedMatch(match: any, actorUserId: string, matchId: string, intent: Record<string, any>) {
    if (!publicHistoryId(matchId) || exactProfileId(match) !== matchId || matchReferenceId(match.createdBy) !== actorUserId
        || match.sport !== intent.sport || match.format !== intent.format || match.tournamentId
        || match.clubId && !matchReferenceId(match.clubId)
        || matchReferenceId(match.clubId) !== matchReferenceId(intent.clubId)
        || !Array.isArray(match.players) || match.players.length !== intent.players.length) return invalid();
    const expected = new Map<string, string>(intent.players.map((player: any) => [player.userId,
        JSON.stringify([player.teamId || '', player.role || '', player.sets])]));
    const seen = new Set<string>();
    for (const player of match.players) {
        const id = matchReferenceId(player?.userId);
        if (!id || seen.has(id) || !Array.isArray(player.sets)
            || player.sets.some((score: any) => !Number.isSafeInteger(score) || score < 0)
            || expected.get(id) !== JSON.stringify([player.teamId || '', player.role || '', player.sets])) return invalid();
        seen.add(id);
    }
    if (intent.format === 'singles' && matchReferenceId(match.winnerId) !== intent.winnerId) return invalid();
    if (intent.format === 'doubles') {
        const winners = (match.winnerUserIds || []).map(matchReferenceId).sort();
        if (JSON.stringify(winners) !== JSON.stringify([...(intent.winnerUserIds || [])].sort())) return invalid();
    }
    if (intent.durationMinutes !== undefined && (!Number.isSafeInteger(intent.durationMinutes)
        || intent.durationMinutes <= 0 || match.durationMinutes !== intent.durationMinutes)) return invalid();
    for (const field of ['date', 'time', 'location', 'duration']) {
        if (intent[field] !== undefined && match[field] !== intent[field]) return invalid();
    }
    if (intent.startAt !== undefined && (!Number.isFinite(Date.parse(intent.startAt))
        || Date.parse(match.startAt) !== Date.parse(intent.startAt))) return invalid();
    if (intent.stats) {
        for (const [field, pair] of Object.entries(intent.stats) as Array<[string, any]>) {
            if (!pair || !Number.isSafeInteger(pair.me) || !Number.isSafeInteger(pair.opp) || pair.me < 0 || pair.opp < 0
                || match.stats?.[field]?.me !== pair.me || match.stats?.[field]?.opp !== pair.opp) return invalid();
        }
    }
    if (!['scheduled', 'accepted', 'confirmed'].includes(match.status)
        || typeof match.isConfirmed !== 'boolean' || match.isConfirmed !== (match.status === 'confirmed')
        || !Array.isArray(match.confirmations) || match.confirmations.some((id: any) => !seen.has(matchReferenceId(id)))
        || new Set(match.confirmations.map(matchReferenceId)).size !== match.confirmations.length) return invalid();
    return match;
}
