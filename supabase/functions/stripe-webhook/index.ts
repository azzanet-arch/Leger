// Reçoit les événements Stripe et met à jour l'état d'abonnement du compte.
// À déployer avec --no-verify-jwt : Stripe s'authentifie par signature, pas par jeton Supabase.
import Stripe from 'npm:stripe@17.5.0';
import { stripe, admin } from '../_shared/common.ts';

const SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const crypto = Stripe.createSubtleCryptoProvider();
const PLAN_BY_PRICE: Record<string, string> = {
  [Deno.env.get('STRIPE_PRICE_MONTHLY') ?? '-']: 'monthly',
  [Deno.env.get('STRIPE_PRICE_YEARLY') ?? '-']: 'yearly',
};

async function sync(subscriptionId: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  // Selon la version d'API Stripe, la fin de période est sur l'abonnement ou sur l'élément.
  // deno-lint-ignore no-explicit-any
  const periodEnd = (sub as any).current_period_end ?? (item as any)?.current_period_end;

  const { error } = await admin.from('profiles').update({
    sub_status: sub.status,
    sub_plan: PLAN_BY_PRICE[item?.price.id ?? ''] ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  }).eq('stripe_customer_id', customerId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  if (!signature) return new Response('Signature manquante', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, SECRET, undefined, crypto);
  } catch (e) {
    console.error('Signature invalide', e);
    return new Response('Signature invalide', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.mode === 'subscription' && s.subscription) await sync(String(s.subscription));
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await sync((event.data.object as Stripe.Subscription).id);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        // deno-lint-ignore no-explicit-any
        const inv = event.data.object as any;
        const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription;
        if (subId) await sync(String(subId));
        break;
      }
    }
  } catch (e) {
    console.error(e);
    return new Response('Erreur de traitement', { status: 500 }); // Stripe réessaiera
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
