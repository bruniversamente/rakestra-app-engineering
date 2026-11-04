import type { MatchNotificationLanguage } from './match-acceptance-notification.ts';

export type MatchRejectionPresentation = {
  template: 'match-rejection-v1';
  actorName: string;
  sport: string;
  proposalVersion: number;
};

export function buildMatchRejectionPresentation(input: {
  actorName?: string;
  sport?: string;
  proposalVersion: number;
}): MatchRejectionPresentation {
  return {
    template: 'match-rejection-v1',
    actorName: typeof input.actorName === 'string' ? input.actorName.trim() : '',
    sport: typeof input.sport === 'string' ? input.sport.trim() : '',
    proposalVersion: input.proposalVersion,
  };
}

export function readMatchRejectionPresentation(value: unknown): MatchRejectionPresentation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Partial<MatchRejectionPresentation>;
  if (data.template !== 'match-rejection-v1' || typeof data.actorName !== 'string'
    || typeof data.sport !== 'string' || !Number.isSafeInteger(data.proposalVersion)
    || data.proposalVersion! < 0) return null;
  return data as MatchRejectionPresentation;
}

export function formatMatchRejectionPresentation(
  data: MatchRejectionPresentation,
  language: MatchNotificationLanguage,
  localizedSport?: string,
): { title: string; message: string } {
  const sport = localizedSport ?? data.sport;
  if (language === 'en') {
    const actor = data.actorName || 'Someone';
    return { title: 'Proposal declined', message: `${actor} declined your${sport ? ` ${sport}` : ''} proposal.` };
  }
  if (language === 'es') {
    const actor = data.actorName || 'Alguien';
    return { title: 'Propuesta rechazada', message: `${actor} rechazó tu propuesta${sport ? ` de ${sport}` : ''}.` };
  }
  const actor = data.actorName || 'Alguém';
  return { title: 'Proposta recusada', message: `${actor} recusou sua proposta${sport ? ` de ${sport}` : ''}.` };
}
