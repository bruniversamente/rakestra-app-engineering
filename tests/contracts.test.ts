import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotMatchProposalIntent } from '../src/matchProposalData.ts';
import { matchCreationFingerprint, readMatchCreationReceipt } from '../src/matchCreationData.ts';
import { buildMatchAcceptancePresentation, readMatchAcceptancePresentation, formatMatchAcceptancePresentation } from '../src/match-acceptance-notification.ts';
import { readMatchRejectionPresentation } from '../src/match-rejection-notification.ts';

const actor = 'a'.repeat(24), opponent = 'b'.repeat(24);
function invitation() {
  return { createdBy: actor, creatorId: actor, opponentId: opponent, sport: 'tennis',
    format: 'singles', type: 'friendly', isDoubles: false, isProposal: true,
    date: '01/01/2099', time: '15:00', location: 'Quadra demonstrativa',
    startAt: '2099-01-01T18:00:00.000Z', proposalSlots: ['2099-01-01T18:00:00.000Z'],
    status: 'scheduled', players: [{ userId: actor }, { userId: opponent }] };
}
test('a valid invitation is copied independently of later edits in the form', () => {
  const draft = invitation(), snapshot = snapshotMatchProposalIntent(draft, actor);
  draft.location = 'Outro local';
  assert.equal(snapshot.location, 'Quadra demonstrativa');
});
test('an invitation cannot impersonate another actor', () => {
  assert.throws(() => snapshotMatchProposalIntent(invitation(), opponent));
});
test('an invitation cannot include a score or overwrite its command identity', () => {
  assert.throws(() => snapshotMatchProposalIntent({ ...invitation(), players: [{ userId: actor, sets: [6] }, { userId: opponent }] }, actor));
  assert.throws(() => snapshotMatchProposalIntent({ ...invitation(), idempotencyKey: 'external-command' }, actor));
});
test('participants and available slots must be consistent', () => {
  assert.throws(() => snapshotMatchProposalIntent({ ...invitation(), players: [{ userId: actor }, { userId: actor }] }, actor));
  assert.throws(() => snapshotMatchProposalIntent({ ...invitation(), startAt: '2099-02-01T18:00:00.000Z' }, actor));
});
test('a changed invitation has a different fingerprint, reordered object keys do not', () => {
  const body = invitation(), reordered = Object.fromEntries(Object.entries(body).reverse());
  assert.equal(matchCreationFingerprint(body), matchCreationFingerprint(reordered));
  assert.notEqual(matchCreationFingerprint(body), matchCreationFingerprint({ ...body, location: 'Outro local' }));
});
test('a receipt must belong to the same actor and original command', () => {
  const key = 'match-create:public-example-0001', matchId = 'c'.repeat(24);
  const receipt = { version: 1, actorUserId: actor, idempotencyKey: key, matchId };
  assert.equal(readMatchCreationReceipt(receipt, actor, key), matchId);
  assert.throws(() => readMatchCreationReceipt(receipt, opponent, key));
  assert.throws(() => readMatchCreationReceipt(receipt, actor, key + '-different'));
});
test('a partial acceptance remains different from a fully accepted match', () => {
  const names = new Map([[actor, 'Atleta A'], [opponent, 'Atleta B']]);
  const presentation = buildMatchAcceptancePresentation({ ...invitation(), players: [{ userId: actor }, { userId: opponent }] }, actor, names,
    { fullyAccepted: false, awaitingCount: 1, actorName: 'Atleta B' });
  assert.ok(readMatchAcceptancePresentation(presentation));
  assert.notEqual(formatMatchAcceptancePresentation(presentation, 'pt-BR').title, 'Partida confirmada');
});
test('an inconsistent acceptance payload is rejected before formatting', () => {
  assert.equal(readMatchAcceptancePresentation({ template: 'match-acceptance-v1', fullyAccepted: true, awaitingCount: 2 }), null);
});
test('rejection payloads preserve the proposal version and reject invalid versions', () => {
  assert.equal(readMatchRejectionPresentation({ template: 'match-rejection-v1', actorName: 'Atleta B', sport: 'tennis', proposalVersion: -1 }), null);
  assert.ok(readMatchRejectionPresentation({ template: 'match-rejection-v1', actorName: 'Atleta B', sport: 'tennis', proposalVersion: 2 }));
});
