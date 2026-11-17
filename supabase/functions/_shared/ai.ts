// Outils communs aux fonctions d'IA : client Claude, accès (essai ou abonnement) et quota quotidien.
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { admin, json } from './common.ts';

export { Anthropic };
export const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY dans les secrets Supabase
export const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '20');

/** Renvoie une réponse d'erreur si l'utilisateur n'a pas accès ou a dépassé son quota, sinon null. */
export async function checkAccessAndQuota(userId: string): Promise<Response | null> {
  const { data: p } = await admin.from('profiles').select('trial_ends_at,sub_status,current_period_end').eq('id', userId).single();
  const now = Date.now();
  const subscribed = p && ['active', 'trialing', 'past_due'].includes(p.sub_status ?? '') && p.current_period_end && Date.parse(p.current_period_end) > now;
  const trial = p && Date.parse(p.trial_ends_at) > now;
  if (!subscribed && !trial) return json({ error: 'Abonnement requis' }, 402);
  const { data: used, error } = await admin.rpc('increment_ai_usage', { p_user: userId });
  if (error) { console.error(error); return json({ error: 'Service indisponible' }, 500); }
  if (Number(used) > DAILY_LIMIT) return json({ error: `Limite de ${DAILY_LIMIT} utilisations de l'IA par jour atteinte. Rendez-vous demain !` }, 429);
  return null;
}

/** Traduit une erreur de l'API Claude en réponse claire pour l'application. */
export function aiError(e: unknown): Response {
  if (e instanceof Anthropic.RateLimitError) return json({ error: 'Service très demandé, réessayez dans une minute' }, 429);
  if (e instanceof Anthropic.BadRequestError) { console.error('requête refusée', e.message); return json({ error: 'Demande non prise en charge' }, 400); }
  if (e instanceof Anthropic.APIError) { console.error('API', e.status, e.message); return json({ error: 'Service indisponible' }, 502); }
  console.error(e);
  return json({ error: 'Analyse impossible' }, 500);
}

/** Texte de la réponse, ou une réponse d'erreur si le modèle a refusé ou a été coupé. */
export function replyText(r: Anthropic.Beta.BetaMessage): string | Response {
  if (r.stop_reason === 'refusal') return json({ error: 'Demande non prise en charge' }, 422);
  if (r.stop_reason === 'max_tokens') return json({ error: 'Réponse incomplète, réessayez' }, 502);
  const t = r.content.find((b) => b.type === 'text');
  return t && t.type === 'text' ? t.text : json({ error: 'Réponse vide' }, 502);
}
