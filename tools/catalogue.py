"""Construit app/i18n/catalogue.json : la liste des textes français de Léger à traduire.

Sources : les textes affichés relevés en parcourant l'application (fichier passé en argument,
produit par un parcours automatique) et les textes écrits dans le code (aliments, recettes,
exercices, conseils…). Les nombres deviennent {n}, {n2}… et les dates {date}.
Usage : python3 tools/catalogue.py <dossier>/seen.json  (fichier produit par tools/releve-textes.js)
"""
import json, re, sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / 'app'
DAYS = r'(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|lun\.?|mar\.?|mer\.?|jeu\.?|ven\.?|sam\.?|dim\.?)'
MONTHS = r'(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janv\.|févr\.|avr\.|juil\.|sept\.|oct\.|nov\.|déc\.)'
DATE = re.compile(rf'(?:{DAYS}\s+)?\d{{1,2}}\s+{MONTHS}(?:\s+\d{{4}})?|{MONTHS}\s+\d{{4}}', re.I)
NUM = re.compile(r'\d[\d\s  .,:]*\d|\d')

def templatize(s):
    s = DATE.sub('{date}', s)
    count = 0
    def num(_):
        nonlocal count
        count += 1
        return '{n}' if count == 1 else '{n%d}' % count
    return NUM.sub(num, s)

def useful(s):
    s = s.strip()
    if not re.search(r'[A-Za-zÀ-ÿ]{2}', s): return False
    core = re.sub(r'\{\w+\}', '', s)
    if not re.search(r'[A-Za-zÀ-ÿ]{2}', core): return False   # uniquement des nombres ou des dates
    if re.fullmatch(r'[A-Za-zÀ-ÿ]', core.strip()): return False
    return True

def js_literals(src):
    out = set()
    for q in ("'", '"'):
        for m in re.finditer(q + r'((?:[^' + q + r'\\\n]|\\.)*)' + q, src):
            s = m.group(1).replace("\\'", "'").replace('\\"', '"').replace('\\n', ' ')
            if '<' in s or '${' in s or '=>' in s or 'var(' in s: continue
            if re.match(r'^[#.\[]|^[a-z0-9_-]+$|^[a-z]+:|^https?:|^\w+\.\w+$', s): continue
            if not re.search(r'[A-Za-zÀ-ÿ]{3}', s): continue
            if not (' ' in s or re.match(r'^[A-ZÀ-Ý]', s) or re.search(r'[à-ÿ]', s)): continue
            if re.search(r'[؀-ۿ]', s): continue                     # darija en lettres arabes : mots reconnus, pas à traduire
            out.add(s.strip())
    return out

def main(seen_file):
    seen = json.loads(Path(seen_file).read_text())
    html = (APP / 'index.html').read_text()
    script = html.split('<script>')[-1].split('</script>')[0]
    texts = {templatize(t) for t in seen} | js_literals(script)
    cat = sorted({t for t in texts if useful(t)}, key=str.lower)
    old = {}
    p = APP / 'i18n' / 'catalogue.json'
    if p.exists(): old = json.loads(p.read_text())
    p.write_text(json.dumps({k: old.get(k, '') for k in cat}, ensure_ascii=False, indent=1) + '\n')
    print(f'{len(cat)} textes dans {p.relative_to(APP.parent)}')

if __name__ == '__main__':
    main(sys.argv[1])
