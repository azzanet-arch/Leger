// Configuration de l'abonnement Léger.
// Laissez supabaseUrl vide pour utiliser l'application en « mode démo » (sans compte ni paiement).
// La clé « anon » est publique par conception : la sécurité repose sur les règles RLS de la base.
window.LEGER_CONFIG = {
  supabaseUrl: '',        // ex. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',    // Supabase › Project Settings › API › anon public
  prices: { monthly: '4,99 €', yearly: '39,99 €', yearlyPerMonth: '3,33 €' },
  trialDays: 7,
  legalUrl: 'legal.html'
};
