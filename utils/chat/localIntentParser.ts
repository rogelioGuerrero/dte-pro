/* eslint-disable @typescript-eslint/no-explicit-any */
// Parser local determinístico: intenta resolver la pregunta sin llamar al LLM.
// Si matchea una o más reglas, combina los filtros y genera un reply canned.

import type { ChatDomain, ChatResponse, LocalIntentRule } from './types';

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim();

const matchRule = <TFilters extends Record<string, any>>(
  rule: LocalIntentRule<TFilters>,
  question: string,
  normalizedQuestion: string
): { filters: Partial<TFilters>; match: RegExpMatchArray } | null => {
  let match: RegExpMatchArray | null = null;
  if (rule.match instanceof RegExp) {
    match = question.match(rule.match) || normalizedQuestion.match(rule.match);
  } else {
    const idx = normalizedQuestion.indexOf(normalize(rule.match));
    if (idx >= 0) match = [rule.match] as unknown as RegExpMatchArray;
  }
  if (!match) return null;
  const filters =
    typeof rule.filters === 'function'
      ? rule.filters(match, question)
      : rule.filters;
  return { filters: filters || {}, match };
};

/**
 * Intenta resolver la pregunta usando solo reglas locales.
 * Devuelve null si:
 *  - ninguna regla matchea, o
 *  - la pregunta contiene keywords analíticas (conviene delegar al LLM).
 */
export const parseLocalIntent = <TFilters extends Record<string, any>>(
  domain: ChatDomain<TFilters>,
  question: string
): ChatResponse | null => {
  const normalized = normalize(question);

  // Si la pregunta es analítica, fuerza LLM.
  if (domain.analyticalKeywords?.some((kw) => normalized.includes(normalize(kw)))) {
    return null;
  }

  const appliedFilters: Partial<TFilters> = {};
  const replies: string[] = [];

  for (const rule of domain.localRules) {
    const res = matchRule(rule, question, normalized);
    if (!res) continue;
    Object.assign(appliedFilters, res.filters);
    if (rule.reply) {
      const r = typeof rule.reply === 'function' ? rule.reply(res.filters) : rule.reply;
      if (r) replies.push(r);
    }
  }

  if (Object.keys(appliedFilters).length === 0) return null;

  const description = Object.entries(appliedFilters)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  const content =
    replies.length > 0
      ? replies.join(' ')
      : `Aplicando filtro: ${description}.`;

  return {
    content,
    action: { type: 'filter', filters: appliedFilters },
    source: 'local',
  };
};
