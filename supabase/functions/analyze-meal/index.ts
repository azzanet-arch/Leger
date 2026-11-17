// Analyse d'une photo de repas par Claude : aliments reconnus, portions, calories et macros estimées.
// Réservé aux comptes en essai gratuit ou abonnés, avec une limite quotidienne pour maîtriser les coûts.
import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { admin, cors, json, requireUser } from '../_shared/common.ts';

const anthropic = new Anthropic(); // lit ANTHROPIC_API_KEY dans les secrets Supabase
const MODEL = Deno.env.get('CLAUDE_MODEL') ?? 'claude-opus-5-5';
const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? '10');
const MAX_IMAGE_BYTES = 4_500_000;

const SYSTEM = `Tu es un diététicien qui estime le contenu nutritionnel d'un repas à partir d'une photo.
Pour chaque aliment visible, donne un nom court en français, une portion lisible ("1 assiette", "2 tranches"),
le poids estimé en grammes, et les valeurs pour ce poids : kcal, protéines, glucides, lipides (en grammes).
Appuie-toi sur les valeurs nutritionnelles habituelles (tables Ciqual) et sur les indices de taille visibles
(assiette, couverts, main). Pense aux matières grasses de cuisson et aux sauces probables, et inclus-les.
Reconnais aussi les plats maghrébins et français (couscous, tajine, harira, msemen, etc.).
Si la photo ne montre pas de nourriture, mets is_food à false et laisse items vide.
Indique ta confiance pour chaque aliment, et dans comment, une phrase courte en français sur ce qui est incertain.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_food', 'items', 'comment'],
  properties: {
    is_food: { type: 'boolean' },
    comment: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'portion', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
        properties: {
          name: { type: 'string' },
          portion: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          confidence: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
        },
      },
    },
  },
};

type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';
const MEDIA: MediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'Non connecté' }, 401);

  // Accès : essai gratuit en cours ou abonnement actif
  const { data: p } = await admin.from('profiles').select('trial_ends_at,sub_status,current_period_end').eq('id', user.id).single();
  const now = Date.now();
  const subscribed = p && ['active', 'trialing', 'past_due'].includes(p.sub_status ?? '') && p.current_period_end && Date.parse(p.current_period_end) > now;
  const trial = p && Date.parse(p.trial_ends_at) > now;
  if (!subscribed && !trial) return json({ error: 'Abonnement requis' }, 402);

  const { image, mediaType } = await req.json().catch(() => ({}));
  if (typeof image !== 'string' || !MEDIA.includes(mediaType)) return json({ error: 'Image manquante' }, 400);
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'Image trop lourde' }, 413);

  const { data: used, error: usageErr } = await admin.rpc('increment_ai_usage', { p_user: user.id });
  if (usageErr) { console.error(usageErr); return json({ error: 'Service indisponible' }, 500); }
  if (Number(used) > DAILY_LIMIT) return json({ error: `Limite de ${DAILY_LIMIT} analyses par jour atteinte` }, 429);

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType as MediaType, data: image } },
          { type: 'text', text: 'Analyse ce repas.' },
        ],
      }],
    });

    if (response.stop_reason === 'refusal') return json({ error: 'Photo non analysable' }, 422);
    if (response.stop_reason === 'max_tokens') return json({ error: 'Analyse incomplète, réessayez' }, 502);
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return json({ error: 'Réponse vide' }, 502);
    return json(JSON.parse(text.text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'Service très demandé, réessayez dans une minute' }, 429);
    if (e instanceof Anthropic.BadRequestError) { console.error('requête refusée', e.message); return json({ error: 'Photo non prise en charge' }, 400); }
    if (e instanceof Anthropic.APIError) { console.error('API', e.status, e.message); return json({ error: 'Service indisponible' }, 502); }
    console.error(e);
    return json({ error: 'Analyse impossible' }, 500);
  }
});
