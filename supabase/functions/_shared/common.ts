// Outils communs à toutes les fonctions (sans Stripe : les fonctions d'IA marchent avant la mise en place des paiements).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

// Client « service » : contourne la RLS, à n'utiliser que côté serveur.
export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

// Adresse publique de l'application (pas un secret) ; modifiable avec le secret APP_URL, par exemple pour un nom de domaine.
export const APP_URL = Deno.env.get('APP_URL') ?? 'https://azzanet-arch.github.io/Leger/app/';

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
