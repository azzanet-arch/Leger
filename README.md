# Léger — application d'aide à la perte de poids

## Contenu du dépôt
| Dossier / fichier | Rôle |
|---|---|
| `index.html`, `img/` | Page d'accueil de vente (https://azzanet-arch.github.io/Leger/) |
| `app/` | L'application (https://azzanet-arch.github.io/Leger/app/) |
| `supabase/` | Base de données, fonctions Stripe et modèles d'e-mails |
| `ABONNEMENT.md` | Guide de mise en place des paiements (Supabase + Stripe) |
| `LANCEMENT.md` | Kit réseaux sociaux : bios, plan de 30 vidéos, suivi |
| `.github/workflows/pages.yml` | Mise en ligne automatique sur GitHub Pages à chaque envoi sur `main` |

Application web mobile (PWA), sans serveur ni compte : toutes les données restent dans le navigateur (localStorage).

## Fonctionnalités
- **Objectif calorique personnalisé** : métabolisme de base (Mifflin-St Jeor) × niveau d'activité, moins un déficit choisi (0,25 à 1 kg/semaine, 7 700 kcal ≈ 1 kg). Plancher de sécurité à 1 200 kcal (femmes) / 1 500 kcal (hommes) ; un poids visé sous IMC 18,5 est refusé.
- **Journal alimentaire** : environ 80 aliments courants, plus de 3 millions de produits via Open Food Facts (recherche en ligne), **scan de codes-barres** à l'appareil photo, choix de la quantité (portions ou grammes), aliments récents, saisie manuelle.
- **Macronutriments** : glucides, protéines et lipides par aliment, par repas et par jour, avec des objectifs selon le type d'alimentation (équilibré, riche en protéines, pauvre en glucides).
- **Jeûne intermittent** : programmes 12:12 à 20:4, minuteur, phases du jeûne, heure de début modifiable, historique et taux de réussite.
- **Mode Ramadan** : activation automatique selon le calendrier hégirien (Umm al-Qura, réglable ±1 jour), heures du Fajr et du Maghrib calculées pour la ville (32 villes de France, Belgique, Suisse, Canada, Maroc, Algérie, Tunisie, ou position GPS ; méthodes UOIF, ISNA, Ligue islamique mondiale, Maroc, Algérie, Tunisie), repas Shour / Ftour / Soirée, minuteur du jeûne, conseils, habitudes et menus dédiés, bilan du mois.
- **Recettes** : 20 recettes minceur (dont tajine, harira, couscous léger) avec ingrédients, étapes et valeurs nutritionnelles, ajout au journal en un clic, **menu de la semaine** ajusté à l'objectif calorique.
- **Eau** : objectif en verres (35 ml/kg).
- **Activité** : calories dépensées estimées par MET × poids × durée, ajoutées au budget du jour.
- **Poids** : pesées, courbe avec tendance sur 7 jours, progression vers l'objectif, date d'arrivée estimée.
- **Bilan sur 7 jours**, bonnes habitudes à cocher, conseil du jour, série de jours consécutifs.
- Export / import JSON, fonctionne hors ligne, installable sur l'écran d'accueil.

## Lancer en local
```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000 (accueil) et http://localhost:8000/app/ (application)
```

> Estimations indicatives : l'application ne remplace pas un avis médical.
