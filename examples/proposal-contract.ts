import { snapshotMatchProposalIntent } from '../src/matchProposalData.ts';
const actor = 'a'.repeat(24), opponent = 'b'.repeat(24);
const draft = { createdBy: actor, creatorId: actor, opponentId: opponent, sport: 'tennis',
  format: 'singles', type: 'friendly', isDoubles: false, isProposal: true,
  date: '01/01/2099', time: '15:00', location: 'Quadra demonstrativa', status: 'scheduled',
  startAt: '2099-01-01T18:00:00.000Z', proposalSlots: ['2099-01-01T18:00:00.000Z'],
  players: [{ userId: actor }, { userId: opponent }] };
console.log('Validação local do contrato. Este exemplo não envia um convite nem se conecta à API.');
console.log(JSON.stringify(snapshotMatchProposalIntent(draft, actor), null, 2));
