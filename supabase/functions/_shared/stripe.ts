// Outils de paiement Stripe (utilisés seulement par les fonctions d'abonnement).
import Stripe from 'npm:stripe@17.5.0';
import { admin } from './common.ts';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
});

/** Récupère (ou crée) le client Stripe lié au compte. */
export async function ensureCustomer(userId: string, email?: string) {
  const { data: profile, error } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (error || !profile) throw new Error('Profil introuvable');
  if (profile.stripe_customer_id) return { profile, customerId: profile.stripe_customer_id as string };
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await admin.from('profiles').update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() }).eq('id', userId);
  return { profile, customerId: customer.id };
}
