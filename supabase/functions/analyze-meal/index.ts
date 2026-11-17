// Analyse d'un repas par Claude : photo d'assiette, photo d'un plat partagé, ou description en texte (français ou darija).
// Renvoie les aliments reconnus avec portion, poids, calories et macros estimés.
import { cors, json, requireUser } from '../_shared/common.ts';
import { anthropic, MODEL, checkAccessAndQuota, aiError, replyText } from '../_shared/ai.ts';

const MAX_IMAGE_BYTES = 4_500_000;
const BASE = `Tu es un diététicien qui estime le contenu nutritionnel des repas.
Pour chaque aliment, donne un nom court en français, une portion lisible ("1 assiette", "2 tranches"),
le poids estimé en grammes, et les valeurs pour ce poids : kcal, protéines, glucides, lipides (en grammes).
Appuie-toi sur les valeurs nutritionnelles habituelles (tables Ciqual), pense aux matières grasses de cuisson et aux sauces probables, et inclus-les.
Tu connais très bien les cuisines maghrébine et française (couscous, tajine, harira, msemen, baghrir, chebakia, etc.).
Indique ta confiance pour chaque aliment et, dans comment, une phrase courte en français sur ce qui est incertain.`;
const PROMPTS: Record<string, string> = {
  photo: `${BASE}\nOn te donne la photo d'une assiette individuelle. Utilise les indices de taille visibles (assiette, couverts, main). Si la photo ne montre pas de nourriture, mets is_food à false et laisse items vide.`,
  shared: `${BASE}\nOn te donne la photo d'un plat commun posé au centre de la table, que plusieurs personnes mangent ensemble, à la main ou avec du pain, comme c'est l'usage pour le tajine ou le couscous.
Estime d'abord le contenu du plat entier, puis donne pour chaque aliment UNIQUEMENT LA PART D'UNE PERSONNE (plat entier divisé par le nombre de convives indiqué).
Si du pain sert à saucer, ajoute une ligne "Pain (pour saucer)" avec la quantité indiquée par personne, et compte la sauce absorbée.
Dans comment, rappelle le poids estimé du plat entier. Si la photo ne montre pas de nourriture, mets is_food à false.`,
  text: `${BASE}\nOn te donne la description d'un repas, tapée ou dictée, en français, en darija (arabe marocain, algérien ou tunisien, en lettres latines ou arabes) ou un mélange des deux.
Exemples de darija : "jouj msemen b l3sel" = deux msemen au miel, "kas d atay" = un verre de thé, "khobz" = pain, "djaj" = poulet, "lben" = lait fermenté.
Le texte vient souvent d'une dictée vocale : il peut contenir des fautes de transcription (mots de darija mal reconnus, écrits en français approximatif ou en arabe). Interprète-les au mieux.
Respecte les quantités indiquées ; sinon, prends une portion habituelle. Si le texte ne décrit pas de nourriture, mets is_food à false.`,
};
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['is_food', 'items', 'comment'],
  properties: {
    is_food: { type: 'boolean' }, comment: { type: 'string' },
    items: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['name', 'portion', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
      properties: {
        name: { type: 'string' }, portion: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' },
        protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
        confidence: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
      },
    } },
  },
};
type MediaType = 'image/jpeg' | 'image/png' | 'image/webp';
const MEDIA: MediaType[] = ['image/jpeg', 'image/png', 'image/webp'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);
  const user = await requireUser(req);
  if (!user) return json({ error: 'Non connecté' }, 401);

  const body = await req.json().catch(() => ({}));
  const task = body.task ?? 'photo';
  if (!PROMPTS[task]) return json({ error: 'Demande inconnue' }, 400);

  // deno-lint-ignore no-explicit-any
  let content: any[];
  if (task === 'text') {
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 1000) return json({ error: 'Décrivez votre repas en moins de 1000 caractères' }, 400);
    content = [{ type: 'text', text: `<repas>\n${text}\n</repas>` }];
  } else {
    if (typeof body.image !== 'string' || !MEDIA.includes(body.mediaType)) return json({ error: 'Image manquante' }, 400);
    if (body.image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'Image trop lourde' }, 413);
    const guests = Math.min(20, Math.max(2, Number(body.guests) || 4));
    const bread = Math.min(4, Math.max(0, Number(body.bread) || 0));
    const note = task === 'shared'
      ? `Nombre de convives : ${guests}. Pain pour saucer par personne : ${bread ? `${bread} quart(s) de galette` : 'aucun'}.`
      : 'Analyse ce repas.';
    content = [{ type: 'image', source: { type: 'base64', media_type: body.mediaType as MediaType, data: body.image } }, { type: 'text', text: note }];
  }

  const denied = await checkAccessAndQuota(user.id);
  if (denied) return denied;

  try {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: PROMPTS[task],
      messages: [{ role: 'user', content }],
    });
    const text = replyText(response);
    return typeof text === 'string' ? json(JSON.parse(text)) : text;
  } catch (e) {
    return aiError(e);
  }
});
