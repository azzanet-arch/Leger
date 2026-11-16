import Stripe from 'npm:stripe@17.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

export const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  httpClient: Stripe.createFetchHttpClient(),
});

// Client « service » : contourne la RLS, à n'utiliser que côté serveur.
export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

export const APP_URL = Deno.env.get('APP_URL')!; // ex. https://azzanet-arch.github.io/Leger/app/

export const cors = {
  'Access-Control-Allow-Origin': new URL(APP_URL).origin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Utilisateur connecté à partir du jeton envoyé par l'application. */
export async function requireUser(req: Request) {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  return error ? null : data.user;
}

/** Récupère (ou crée) le client Stripe lié au compte. */
export async function ensureCustomer(userId: string, email?: string) {
  const { data: profile, error } = await admin.from('profiles').select('*').eq('id', userId).single();
  if (error || !profile) throw new Error('Profil introuvable');
  if (profile.stripe_customer_id) return { profile, customerId: profile.stripe_customer_id as string };
  const customer = await stripe.customers.create({ email, metadata: { user_id: userId } });
  await admin.from('profiles').update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() }).eq('id', userId);
  return { profile, customerId: customer.id };
}
