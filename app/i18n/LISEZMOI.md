# Traduire Léger dans une nouvelle langue

Le français est écrit directement dans l'application. Chaque autre langue est un **catalogue** :
un fichier JSON qui associe chaque texte français à sa traduction. Aucun code à modifier pour traduire.

## Ajouter une langue (exemple : l'arabe)
1. Copiez `catalogue.json` en `ar.json` (même dossier).
2. Remplissez chaque valeur vide par la traduction :
   ```json
   "Ajouter un aliment": "إضافة طعام",
   "{n} aliments reconnus": "تم التعرف على {n} أطعمة",
   ```
   - Gardez les variables telles quelles : `{n}`, `{n2}` (nombres), `{date}`, `{name}`…
   - Une valeur laissée vide reste affichée en français : on peut publier une traduction partielle.
   - Les noms d'aliments, recettes et exercices sont dans le catalogue : traduisez-les aussi.
3. Dans `app/i18n.js`, passez la langue à `ready: true` dans `LANGS`. Elle apparaît alors dans Profil › Langue.
4. Testez avant de publier : ouvrez `app/?lang=ar` (sans l'activer pour tout le monde).

## Ce qui est déjà automatique
- **Sens de lecture** : l'arabe s'affiche de droite à gauche (`dir: 'rtl'`).
- **Nombres, dates, heures** : formatés selon la langue (1 530 / 1,530 / ١٬٥٣٠, lundi / Monday / الاثنين).
- **IA** (coach, analyse des repas, recettes allégées) : elle répond dans la langue de l'utilisateur.
- **Messages partagés** (WhatsApp, image avant/après) : passent par le catalogue.

## Mettre à jour le catalogue après des changements dans l'application
Le catalogue est généré en parcourant automatiquement toutes les vues de l'application, puis :
```bash
node tools/releve-textes.js /tmp/textes collect
python3 tools/catalogue.py /tmp/textes/seen.json
```
Les traductions déjà faites sont conservées ; les nouveaux textes arrivent avec une valeur vide.

## Vérifier qu'aucun texte n'est oublié
Ouvrez `app/?lang=xx` : chaque texte connu du catalogue s'affiche entre ⟦ ⟧.
Un texte affiché sans crochets n'est pas dans le catalogue (les dates n'en ont pas besoin).

## À part : les pages légales
Les CGV, la politique de confidentialité et les mentions légales ne se traduisent pas mot à mot :
elles dépendent du droit de chaque pays. Prévoyez une page par pays (par exemple `legal-ma.html`), relue par un juriste.
