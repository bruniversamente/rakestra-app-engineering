export type MatchNotificationLanguage = 'pt-BR' | 'en' | 'es';

/** Author-owned presentation data; names/location remain original user content. */
export type MatchAcceptancePresentation = {
  template: 'match-acceptance-v1';
  fullyAccepted: boolean;
  awaitingCount: number;
  actorName: string;
  sport: string;
  teammateNames: string[];
  opponentNames: string[];
  startAt: string | null;
  location: string;
};

const idOf = (value: any): string => String(value?._id || value?.id || value || '').trim();
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export function buildMatchAcceptancePresentation(
  match: any,
  recipientId: string,
  participantNames: ReadonlyMap<string, string>,
  acceptance: { fullyAccepted: boolean; awaitingCount: number; actorName?: string },
): MatchAcceptancePresentation {
  const players: any[] = Array.isArray(match?.players) ? match.players : [];
  const doubles = match?.format === 'doubles';
  // Legacy doubles use the first two positions as one side. Singles always
  // have one athlete per side, even when legacy team ids are absent/equal.
  const sideOf = (player: any, index: number) => doubles
    ? String(player?.teamId ?? '').trim() || (index < 2 ? '1' : '2')
    : `single-${index}`;
  const recipientIndex = players.findIndex(player => idOf(player?.userId) === recipientId);
  const ownSide = recipientIndex >= 0 ? sideOf(players[recipientIndex], recipientIndex) : null;
  const teammateNames: string[] = [];
  const opponentNames: string[] = [];
  players.forEach((player, index) => {
    const id = idOf(player?.userId);
    if (id === recipientId) return;
    const name = text(participantNames.get(id));
    (ownSide !== null && sideOf(player, index) === ownSide ? teammateNames : opponentNames).push(name);
  });
  const date = match?.startAt || match?.date;
  const parsedDate = date ? new Date(date) : null;
  return {
    template: 'match-acceptance-v1',
    fullyAccepted: acceptance.fullyAccepted,
    awaitingCount: acceptance.awaitingCount,
    actorName: text(acceptance.actorName),
    sport: text(match?.sport),
    teammateNames,
    opponentNames,
    startAt: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : null,
    location: text(match?.location),
  };
}

const copy = {
  'pt-BR': {
    locale: 'pt-BR', confirmed: 'Jogo confirmado', recorded: 'Aceite registrado',
    you: 'Você', teammate: 'Parceiro', opponent: 'Adversário', someone: 'Alguém', tennis: 'Tênis', and: 'e',
    confirmedBody: (sport: string, sides: string, details: string) => `Sua partida de ${sport}${sides ? ` entre ${sides}` : ''} está confirmada${details ? ` ${details}` : ''}.`,
    detail: (day: string, time: string, location: string) => [day ? `dia ${day}` : '', time ? `às ${time}` : '', location ? `em ${location}` : ''].filter(Boolean).join(' '),
    acceptedBody: (actor: string, sport: string, count: number) => `${actor} aceitou a proposta de ${sport}. ${count === 1 ? 'Falta 1 confirmação' : `Faltam ${count} confirmações`}.`,
    legacyConfirmed: 'Sua partida foi confirmada. Abra o jogo para conferir horário e local.',
    legacyPending: (count: number) => `Um aceite foi registrado. ${count === 1 ? 'Falta 1 confirmação' : `Faltam ${count} confirmações`}.`,
  },
  en: {
    locale: 'en-US', confirmed: 'Match confirmed', recorded: 'Acceptance recorded',
    you: 'You', teammate: 'Teammate', opponent: 'Opponent', someone: 'Someone', tennis: 'Tennis', and: 'and',
    confirmedBody: (sport: string, sides: string, details: string) => `Your ${sport} match${sides ? ` between ${sides}` : ''} is confirmed${details ? ` ${details}` : ''}.`,
    detail: (day: string, time: string, location: string) => [day ? `on ${day}` : '', time ? `at ${time}` : '', location ? `at ${location}` : ''].filter(Boolean).join(' '),
    acceptedBody: (actor: string, sport: string, count: number) => `${actor} accepted the ${sport} proposal. ${count} ${count === 1 ? 'confirmation remains' : 'confirmations remain'}.`,
    legacyConfirmed: 'Your match was confirmed. Open the match to check the time and location.',
    legacyPending: (count: number) => `An acceptance was recorded. ${count} ${count === 1 ? 'confirmation remains' : 'confirmations remain'}.`,
  },
  es: {
    locale: 'es-AR', confirmed: 'Partido confirmado', recorded: 'Aceptación registrada',
    you: 'Vos', teammate: 'Compañero', opponent: 'Rival', someone: 'Alguien', tennis: 'Tenis', and: 'y',
    confirmedBody: (sport: string, sides: string, details: string) => `Tu partido de ${sport}${sides ? ` entre ${sides}` : ''} está confirmado${details ? ` ${details}` : ''}.`,
    detail: (day: string, time: string, location: string) => [day ? `el ${day}` : '', time ? `a las ${time}` : '', location ? `en ${location}` : ''].filter(Boolean).join(' '),
    acceptedBody: (actor: string, sport: string, count: number) => `${actor} aceptó la propuesta de ${sport}. ${count === 1 ? 'Falta 1 confirmación' : `Faltan ${count} confirmaciones`}.`,
    legacyConfirmed: 'Tu partido fue confirmado. Abrí el partido para consultar el horario y el lugar.',
    legacyPending: (count: number) => `Se registró una aceptación. ${count === 1 ? 'Falta 1 confirmación' : `Faltan ${count} confirmaciones`}.`,
  },
} as const;

export function formatMatchAcceptancePresentation(
  data: MatchAcceptancePresentation,
  language: MatchNotificationLanguage,
  localizedSport?: string,
): { title: string; message: string } {
  const c = copy[language];
  const sport = localizedSport || data.sport || c.tennis;
  if (!data.fullyAccepted) return { title: c.recorded, message: c.acceptedBody(data.actorName || c.someone, sport, data.awaitingCount) };
  const join = (names: string[]) => names.length < 2 ? names[0] || '' : `${names.slice(0, -1).join(', ')} ${c.and} ${names[names.length - 1]}`;
  const own = join([c.you, ...data.teammateNames.map(name => name || c.teammate)]);
  const opponent = join(data.opponentNames.map(name => name || c.opponent));
  const date = data.startAt ? new Date(data.startAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  // Preserve the existing notification timezone; formatting follows app language.
  const timeZone = 'America/Sao_Paulo';
  const day = validDate ? date.toLocaleDateString(c.locale, { day: '2-digit', month: '2-digit', timeZone }) : '';
  const time = validDate ? date.toLocaleTimeString(c.locale, { hour: '2-digit', minute: '2-digit', timeZone }) : '';
  return { title: c.confirmed, message: c.confirmedBody(sport, opponent ? `${own} VS ${opponent}` : '', c.detail(day, time, data.location)) };
}

export function readMatchAcceptancePresentation(value: unknown): MatchAcceptancePresentation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const d = value as Partial<MatchAcceptancePresentation>;
  const names = (items: unknown): items is string[] => Array.isArray(items) && items.length <= 3 && items.every(item => typeof item === 'string');
  if (d.template !== 'match-acceptance-v1' || typeof d.fullyAccepted !== 'boolean'
    || !Number.isInteger(d.awaitingCount) || d.awaitingCount! < 0 || d.awaitingCount! > 3
    || d.fullyAccepted !== (d.awaitingCount === 0)
    || typeof d.actorName !== 'string' || typeof d.sport !== 'string' || typeof d.location !== 'string'
    || !names(d.teammateNames) || !names(d.opponentNames)
    || !(d.startAt === null || (typeof d.startAt === 'string' && Number.isFinite(new Date(d.startAt).getTime())))) return null;
  return d as MatchAcceptancePresentation;
}

/** Old records have no trustworthy participant/date presentation fields. */
export function formatLegacyMatchAcceptance(language: MatchNotificationLanguage, awaitingCount: number) {
  const c = copy[language];
  return awaitingCount === 0
    ? { title: c.confirmed, message: c.legacyConfirmed }
    : { title: c.recorded, message: c.legacyPending(awaitingCount) };
}
