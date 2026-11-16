// Crée une session Stripe Checkout pour l'abonnement mensuel ou annuel.
import { stripe, APP_URL, cors, json, requireUser, ensureCustomer } from '../_shared/common.ts';

const PRICES: Record<string, string | undefined> = {
  monthly: Deno.env.get('STRIPE_PRICE_MONTHLY'),
  yearly: Deno.env.get('STRIPE_PRICE_YEARLY'),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'Non connecté' }, 401);

  const { plan = 'monthly' } = await req.json().catch(() => ({}));
  const price = PRICES[plan];
  if (!price) return json({ error: 'Formule inconnue' }, 400);

  try {
    const { profile, customerId } = await ensureCustomer(user.id, user.email);

    if (['active', 'trialing', 'past_due'].includes(profile.sub_status ?? '')) {
      return json({ error: 'Abonnement déjà actif' }, 409);
    }

    // S'abonner pendant l'essai gratuit ne fait pas perdre les jours restants.
    // (Stripe exige une fin d'essai au moins 48 h dans le futur.)
    const trialEnd = Math.floor(new Date(profile.trial_ends_at).getTime() / 1000);
    const keepTrial = trialEnd > Date.now() / 1000 + 48 * 3600;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price, quantity: 1 }],
      subscription_data: {
        metadata: { user_id: user.id },
        ...(keepTrial ? { trial_end: trialEnd } : {}),
      },
      allow_promotion_codes: true,
      locale: 'fr',
      ...(Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true'
        ? { automatic_tax: { enabled: true }, customer_update: { address: 'auto' } }
        : {}),
      success_url: `${APP_URL}?paiement=ok`,
      cancel_url: `${APP_URL}?paiement=annule`,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: 'Impossible de créer le paiement' }, 500);
  }
});
