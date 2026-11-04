import { exactProfileId } from './athleteProfileReadData.ts';
import { publicHistoryId } from './publicMatchHistoryData.ts';
import { matchReferenceId } from './matchCreationData.ts';

const invalid = (): never => { throw new Error('Unverified match proposal'); };
const fields = new Set(['createdBy', 'creatorId', 'opponentId', 'sport', 'format', 'type', 'startAt', 'proposalSlots', 'isProposal', 'date', 'time', 'location', 'proposalMessage', 'status', 'isDoubles', 'players', 'teamAId', 'teamBId']);

/** Scoreless invitations have their own contract; never weaken the scored-match validator. */
export function snapshotMatchProposalIntent(input: any, actor: string): Record<string, any> {
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
    if (!publicHistoryId(actor) || !input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some(key => !fields.has(key)) || input.createdBy !== actor || input.creatorId !== actor
        || input.isProposal !== true || input.status !== 'scheduled' || !['friendly', 'ranked'].includes(input.type)
        || !['singles', 'doubles'].includes(input.format) || input.isDoubles !== (input.format === 'doubles')
        || !publicHistoryId(input.opponentId) || input.opponentId === actor) return invalid();
    for (const key of ['sport', 'date', 'time', 'location']) if (typeof input[key] !== 'string' || !input[key].trim()) return invalid();
    if (input.proposalMessage !== undefined && typeof input.proposalMessage !== 'string') return invalid();
    if (!Array.isArray(input.proposalSlots) || input.proposalSlots.length < 1 || input.proposalSlots.length > 3
        || input.proposalSlots.some((s: any) => typeof s !== 'string' || !Number.isFinite(Date.parse(s)))
        || input.startAt !== input.proposalSlots[0]) return invalid();
    if (!Array.isArray(input.players) || input.players.length !== (input.isDoubles ? 4 : 2)) return invalid();
    const ids = input.players.map((player: any) => publicHistoryId(player?.userId));
    if (ids.some((id: string) => !id) || new Set(ids).size !== ids.length || !ids.includes(actor) || !ids.includes(input.opponentId)) return invalid();
    for (const player of input.players) {
        if (!player || Object.keys(player).some(key => !['userId', 'teamId'].includes(key))
            || (input.isDoubles ? !['1', '2'].includes(player.teamId) : player.teamId !== undefined)) return invalid();
    }
    if (input.isDoubles && (!publicHistoryId(input.teamAId) || !publicHistoryId(input.teamBId) || input.teamAId === input.teamBId
        || input.players.filter((p: any) => p.teamId === '1').length !== 2
        || input.players.find((p: any) => p.userId === actor).teamId !== '1'
        || input.players.find((p: any) => p.userId === input.opponentId).teamId !== '2')) return invalid();
    const raw = JSON.stringify(input);
    if (raw.length > 22_000) return invalid();
    return JSON.parse(raw);
}

/** The receipt binds the original body. Mutable proposal details may have changed since then. */
export function readCreatedProposal(match: any, actor: string, id: string, intent: Record<string, any>, originalResponse = false) {
    if (!publicHistoryId(id) || exactProfileId(match) !== id || matchReferenceId(match.createdBy) !== actor
        || match.sport !== intent.sport || match.format !== intent.format || match.tournamentId || match.clubId
        || !Array.isArray(match.players) || match.players.length !== intent.players.length
        || !Number.isSafeInteger(match.proposalVersion) || match.proposalVersion < 1
        || !['pending', 'accepted', 'rejected', 'countered'].includes(match.proposalStatus)
        || !['pending', 'scheduled', 'accepted', 'rejected', 'finished', 'cancelled', 'confirmed'].includes(match.status)) return invalid();
    const expected = new Map(intent.players.map((p: any) => [p.userId, p.teamId || '']));
    const seen = new Set<string>();
    for (const player of match.players) {
        const playerId = matchReferenceId(player?.userId);
        if (!playerId || seen.has(playerId) || expected.get(playerId) !== (player.teamId || '')) return invalid();
        seen.add(playerId);
    }
    if (intent.isDoubles && (matchReferenceId(match.teamAId) !== intent.teamAId || matchReferenceId(match.teamBId) !== intent.teamBId)) return invalid();
    if (originalResponse && (match.proposalVersion !== 1 || match.proposalStatus !== 'pending' || match.status !== 'pending'
        || match.isConfirmed !== false || !Array.isArray(match.confirmations) || match.confirmations.length !== 0
        || JSON.stringify(match.proposalSlots) !== JSON.stringify(intent.proposalSlots)
        || (match.proposalMessage || '') !== (intent.proposalMessage || '').slice(0, 500)
        || match.location !== intent.location || match.date !== intent.date || match.time !== intent.time
        || Date.parse(match.startAt) !== Date.parse(intent.startAt))) return invalid();
    return match;
}
