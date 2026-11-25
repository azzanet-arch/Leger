// Ouvre le portail client Stripe : changer de carte, de formule, résilier, télécharger les factures.
import { APP_URL, cors, json, requireUser } from '../_shared/common.ts';
import { stripe, ensureCustomer } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405);

  const user = await requireUser(req);
  if (!user) return json({ error: 'Non connecté' }, 401);

  try {
    const { customerId } = await ensureCustomer(user.id, user.email);
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: APP_URL, locale: 'fr' });
    return json({ url: session.url });
  } catch (e) {
    console.error(e);
    return json({ error: 'Portail indisponible' }, 500);
  }
});
