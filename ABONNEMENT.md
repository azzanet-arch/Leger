# Mettre en place l'abonnement Léger (Stripe + Supabase)

Fonctionnement : l'utilisateur crée un compte avec son e-mail (lien magique, sans mot de passe) → **7 jours d'essai gratuit, sans carte** → puis **4,99 €/mois** ou **39,99 €/an** via Stripe Checkout. La résiliation se fait dans l'app (portail client Stripe). Tant que `config.js` est vide, l'app tourne en **mode démo**, sans compte ni paiement.

```
Téléphone (app statique)  ──connexion / lecture abonnement──▶  Supabase (Auth + table profiles)
        │                                                            ▲
        └─▶ fonction create-checkout ─▶ Stripe Checkout ─▶ webhook ──┘ (met à jour l'abonnement)
```

Les données de santé (poids, repas…) restent dans le téléphone. Seuls l'e-mail et l'état d'abonnement sont sur le serveur.

## 1. Supabase (gratuit pour démarrer)
1. Créez un projet sur supabase.com (région **UE, Francfort**, pour le RGPD).
2. **SQL Editor** › collez et exécutez `supabase/migrations/20261113000000_abonnements.sql`.
3. **Authentication › URL Configuration** :
   - Site URL = l'adresse publique de l'app, ex. `https://azzanet-arch.github.io/Leger/app/`
   - Redirect URLs : ajoutez la même adresse.
4. **Authentication › Emails › Templates** : remplacez les modèles anglais par les modèles français fournis.
   - **Confirm signup** : objet `Bienvenue sur Léger : confirmez votre e-mail`, contenu = `supabase/templates/inscription.html`
   - **Magic Link** : objet `Votre lien de connexion à Léger`, contenu = `supabase/templates/connexion.html`
   Configurez aussi un SMTP (Brevo, gratuit jusqu'à 300 e-mails/jour) dans **Authentication › Emails › SMTP Settings** : l'envoi intégré de Supabase est limité à quelques e-mails par heure.
5. **Project Settings › API** : copiez l'URL et la clé `anon public` dans `app/config.js`.

## 2. Stripe
1. Créez le compte sur stripe.com et activez-le (SIRET, IBAN).
2. **Catalogue de produits** › produit « Léger » avec deux prix récurrents : 4,99 € / mois et 39,99 € / an. Notez les identifiants `price_…`.
3. **Paramètres › Facturation › Portail client** : activez la résiliation, le changement de formule (entre les deux prix) et la mise à jour de la carte.
4. **Paramètres › Facturation › Abonnements et e-mails** : activez les relances de paiement échoué et l'e-mail de rappel avant renouvellement des abonnements annuels (obligation légale en France).
5. TVA : si vous êtes assujetti, activez **Stripe Tax** et mettez `STRIPE_AUTOMATIC_TAX=true` (étape 3). En franchise de TVA (micro-entreprise), laissez désactivé.

## 3. Déployer les fonctions serveur
Avec la CLI Supabase (`npm i -g supabase`) depuis la racine du dépôt :
```bash
supabase login
supabase link --project-ref VOTRE_REF_PROJET
supabase secrets set \
  STRIPE_SECRET_KEY=sk_live_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_... \
  APP_URL=https://azzanet-arch.github.io/Leger/app/
supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```
Ensuite, dans Stripe › **Développeurs › Webhooks**, ajoutez le point de terminaison
`https://VOTRE_REF_PROJET.supabase.co/functions/v1/stripe-webhook` avec les événements :
`checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`.
Copiez le secret de signature puis lancez `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.

> Faites d'abord tout en **mode test** Stripe (`sk_test_…`, carte `4242 4242 4242 4242`), puis refaites l'étape 2 et les secrets en mode live.

## 4. Légal (obligatoire avant d'encaisser)
Complétez les passages surlignés de `app/legal.html` (identité, SIRET, contact, médiateur de la consommation) et faites-les relire. Indiquez cette page dans Stripe (Paramètres › Informations publiques).

## Limites à connaître
- Le contrôle d'accès est fait dans l'application. Comme les fonctionnalités tournent dans le téléphone, un utilisateur très technique pourrait le contourner en modifiant le code. Pour un service grand public c'est l'usage courant ; pour verrouiller totalement, il faudrait déplacer des fonctionnalités côté serveur.
- Hors ligne, l'accès reste ouvert 3 jours après la dernière vérification.
- Pour publier sur l'App Store ou Google Play, les abonnements devront passer par leurs systèmes de paiement (commission de 15 à 30 %). En tant que site web / PWA, Stripe suffit.
