// Usage : depuis la racine du dépôt, lancer « python3 -m http.server 8765 », puis
//   node tools/releve-textes.js <dossier> collect   → <dossier>/seen.json (textes affichés)
//   node tools/releve-textes.js <dossier> coverage  → <dossier>/missing.json (textes absents du catalogue)
// Nécessite Playwright (npm i playwright).
// Parcourt toutes les vues de Léger (mode démo) et relève les textes affichés.
// Mode « collecte » : écrit la liste brute ; mode « couverture » (?lang=xx) : liste les textes non couverts par le catalogue.
const { chromium, devices } = require('playwright'); const fs = require('fs');
const [S, mode] = process.argv.slice(2);
const H = {'access-control-allow-origin': '*'};
(async () => {
  const b = await chromium.launch({args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']});
  const seen = new Set(); const missing = new Map();
  const ctx = await b.newContext({...devices['iPhone 13'], serviceWorkers: 'block', timezoneId: 'Europe/Paris'});
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.stack.split('\n').slice(0, 4).join(' ')));
  await pg.route('**/supabase.js', r => r.fulfill({contentType: 'application/javascript', body: ''}));
  await pg.route('https://fonts.**', r => r.abort());
  await pg.route('https://world.openfoodfacts.org/**', r => r.request().url().includes('search.pl')
    ? r.fulfill({contentType: 'application/json', headers: H, body: JSON.stringify({products: [{code: '1', product_name_fr: 'Skyr nature', brands: 'Marque', serving_quantity: 150, nutriments: {'energy-kcal_100g': 62, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2}}]})})
    : r.fulfill({status: 404, headers: H, body: '{"status":0}'}));
  const url = 'http://localhost:8765/app/' + (mode === 'coverage' ? '?lang=xx' : '');
  const grab = async () => {
    const items = await pg.evaluate(() => {
      const out = [];
      const vis = el => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return (r.width || r.height) && st.visibility !== 'hidden' && st.display !== 'none'; };
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {acceptNode: n => n.nodeType === 1 && (n.hasAttribute('data-no-i18n') || /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
      let n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) { const t = n.nodeValue.trim(); if (t && /\p{L}{2}/u.test(t) && n.parentElement && vis(n.parentElement) && !n.parentElement.closest('dialog:not([open])')) out.push(t); }
        else for (const a of ['placeholder', 'title', 'aria-label', 'alt']) if (n.hasAttribute(a) && /\p{L}{2}/u.test(n.getAttribute(a))) out.push(n.getAttribute(a).trim());
      }
      return out;
    });
    for (const t of items) { if (mode === 'coverage') { if (!t.includes('⟦')) missing.set(t, (missing.get(t) || 0) + 1); } else seen.add(t); }
  };
  const click = async sel => { try { await pg.click(sel, {timeout: 2000}); await pg.waitForTimeout(150); } catch(_) {} };
  const close = async () => { await pg.evaluate(() => document.querySelectorAll('dialog[open]').forEach(d => d.close())); await pg.waitForTimeout(100); };
  await pg.clock.install({time: new Date('2027-02-15T15:00:00+01:00')}); // pendant le Ramadan : cartes et menus dédiés
  for (const when of ['2027-02-15T15:00:00+01:00', '2027-03-05T10:00:00+01:00', '2026-11-20T21:00:00+01:00']) {
    await pg.clock.setFixedTime(new Date(when));
    await pg.goto(url); await pg.waitForTimeout(500); await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(400);
    await grab(); await click('#toStep2'); await grab();
    await pg.fill('#s-age', '34'); await pg.fill('#s-height', '168'); await pg.fill('#s-weight', '82'); await pg.fill('#s-goal', '45'); await click('#toStep2'); await grab();
    await pg.fill('#s-goal', '70'); await click('#toStep2'); await grab(); await click('#backStep1');
    await click('#demoBtn'); await pg.waitForTimeout(400); await grab();
    // Journal + dialogues
    await click('[data-add-meal="breakfast"]'); await grab();
    for (const q of ['pomme', 'tajine', 'xyz', 'skyr']) { await pg.fill('#foodSearch', q); await pg.waitForTimeout(200); await grab(); }
    await click('#offBtn'); await pg.waitForTimeout(300); await grab();
    await click('#foodResults li[data-i="0"]'); await grab(); await click('#qtyBack');
    await click('summary'); await grab();
    await click('#scanBtn'); await pg.waitForTimeout(800); await grab(); await pg.fill('#eanIn', '12345678'); await click('#eanForm button'); await pg.waitForTimeout(300); await grab(); await click('#scanBack');
    await click('#textBtn'); await grab(); await click('[data-lang="ar-MA"]'); await grab(); await pg.fill('#mealText', '2 msemen et un truc'); await click('#textForm button[type=submit]'); await pg.waitForTimeout(300); await grab(); await click('#aiBack');
    await click('#sharedBtn'); await grab(); await close();
    await click('#fab'); await grab(); await close();
    await click('#addActBtn'); await grab(); await close();
    await click('#waterPlus'); await grab();
    await click('#coachBtn'); await grab(); await click('#coachSuggest [data-sug="0"]'); await pg.clock.runFor(1500); await pg.waitForTimeout(200); await grab(); await close();
    await click('#fab'); await click('[data-q="fete"]'); await grab(); await click('[data-extra="1000"]'); await pg.selectOption('#feteDays', '2'); await grab(); await close();
    // Jeûne
    await click('#tabs [data-v=fast]'); await pg.waitForTimeout(200); await grab(); await click('#fastToggle'); await grab(); await click('#askNo'); await close();
    // Recettes
    await click('#tabs [data-v=recipes]'); await grab();
    for (const f of ['breakfast', 'main', 'snack', 'ramadan']) { await click(`[data-f="${f}"]`); await grab(); }
    await click('[data-f="all"]');
    const nRec = await pg.$$eval('.rcard', l => l.length);
    for (let i = 0; i < nRec; i++) { await click(`.rcard >> nth=${i}`); await grab(); await close(); }
    await click('#lightOpen'); await grab(); await pg.fill('#lightText', 'Tajine de ma mère avec beaucoup d\'huile et des olives'); await click('#lightForm button[type=submit]'); await pg.clock.runFor(2000); await pg.waitForTimeout(200); await grab(); await close();
    // Progrès + Mon corps
    await click('#tabs [data-v=weight]'); await pg.waitForTimeout(200); await grab();
    for (const k of ['sans-soda', 'eau']) { await click(`[data-start-chal="${k}"]`); await grab(); }
    await click('[data-seg="body"]'); await grab();
    for (const z of ['ventre', 'bras', 'fessiers', 'cuisses', 'dos', 'pecs', 'corps']) for (const g of ['affiner', 'muscler']) {
      await click(`[data-zone="${z}"]`); await click(`[data-bgoal="${g}"]`); await grab();
      await click('#sessStart');
      for (let i = 0; i < 40; i++) { await grab(); const t = await pg.textContent('#wkMain').catch(() => ''); if (/Enregistrer/.test(t)) break; await click('#wkMain'); }
      await grab(); await close();
    }
    await click('#photoAdd'); await pg.waitForTimeout(800); await grab(); await close();
    // Profil
    await click('#avatarBtn'); await grab();
    await pg.selectOption('#ram-mode', 'off'); await grab(); await pg.selectOption('#ram-mode', 'auto');
    await click('#resetBtn'); await grab(); await click('#askNo');
  }
  // Page légale et accueil
  await pg.goto('http://localhost:8765/app/legal.html' + (mode === 'coverage' ? '?lang=xx' : '')); await grab();
  await b.close();
  if (mode === 'coverage') {
    const list = [...missing.entries()].sort((a, b) => b[1] - a[1]);
    fs.writeFileSync(S + '/missing.json', JSON.stringify(list, null, 1));
    console.log('textes affichés non couverts :', list.length); console.log(list.slice(0, 40).map(x => x[0]).join('\n'));
  } else {
    fs.writeFileSync(S + '/seen.json', JSON.stringify([...seen], null, 1));
    console.log('textes relevés :', seen.size, '| erreurs JS :', errs.length, errs.join(' | '));
  }
})().catch(e => console.log('ARRÊT', e.message));
