// Couche de traduction de Léger.
// Le français est la langue source : il est écrit directement dans l'application.
// Chaque autre langue est un catalogue « texte français → traduction » (i18n/<code>.json).
// Une fois la langue chargée, tout texte affiché qui figure dans le catalogue est traduit,
// y compris les textes créés à la volée (cartes, messages, résultats), grâce à un MutationObserver.
// Les clés peuvent contenir des variables : "{n} aliments reconnus" → "{n} foods recognised".
(function(){
  const LANGS = {
    fr: {name: 'Français', locale: 'fr-FR', dir: 'ltr', ready: true},
    ar: {name: 'العربية', locale: 'ar-MA', dir: 'rtl', ready: false},
    en: {name: 'English', locale: 'en-GB', dir: 'ltr', ready: false}
  };
  let stored = null; try { stored = localStorage.getItem('leger.lang'); } catch(_) {}
  const asked = new URLSearchParams(location.search).get('lang'); // ?lang=ar pour tester une langue en préparation, ?lang=xx pour vérifier le catalogue
  let lang = asked || stored || 'fr';
  if (!LANGS[lang] && lang !== 'xx') lang = 'fr';
  const conf = LANGS[lang] || LANGS.fr;
  const I = window.I18N = {LANGS, lang, dict: {}, patterns: [], locale: conf.locale, dir: conf.dir};
  window.LOCALE = I.locale;
  document.documentElement.lang = lang === 'xx' ? 'fr' : lang;
  document.documentElement.dir = I.dir;

  const NUM = '([\\d\\s\\u00a0\\u202f.,:−+-]+)';
  function compile(){
    I.patterns = Object.keys(I.dict).filter(k => /\{\w+\}/.test(k)).map(k => {
      const names = [];
      const src = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n) => { names.push(n); return n.startsWith('n') ? NUM : '(.+?)'; });
      return {re: new RegExp('^' + src + '$'), names, out: I.dict[k] || k};
    });
  }
  // Traduction d'une chaîne pour le code (messages partagés, images, titres)
  window.t = (s, vars) => {
    let r = I.dict[s] || s;
    if (I.lang === 'xx' && I.dict[s] !== undefined) r = '⟦' + r + '⟧';
    return vars ? r.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : r;
  };
  // Traduction d'un texte affiché (les espaces autour sont conservés)
  function tr(text){
    const core = text.trim();
    if (!core || !/\p{L}/u.test(core) || core.startsWith('⟦')) return null;
    let out = I.dict[core];
    if (out === undefined) for (const p of I.patterns) {
      const m = core.match(p.re);
      if (m) { out = p.out.replace(/\{(\w+)\}/g, (_, k) => (m[p.names.indexOf(k) + 1] ?? '').trim()); break; }
    }
    if (out === undefined) return null;
    if (I.lang === 'xx') out = '⟦' + (out || core) + '⟧';
    return out ? text.replace(core, out) : null;
  }
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/;
  function translateNode(root){
    if (!root) return;
    if (root.nodeType === 3) { const r = tr(root.nodeValue); if (r !== null && r !== root.nodeValue) root.nodeValue = r; return; }
    if (root.nodeType !== 1 || root.closest('[data-no-i18n]')) return;
    if (root.tagName === 'INPUT') { attrs(root); return; }
    if (SKIP.test(root.tagName)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: n => n.nodeType === 1 && (n.hasAttribute('data-no-i18n') || /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let n = root;
    do {
      if (n.nodeType === 3) { const r = tr(n.nodeValue); if (r !== null && r !== n.nodeValue) n.nodeValue = r; }
      else attrs(n);
    } while ((n = w.nextNode()));
  }
  function attrs(el){
    for (const a of ATTRS) if (el.hasAttribute(a)) { const v = el.getAttribute(a), r = tr(v); if (r !== null && r !== v) el.setAttribute(a, r); }
  }
  let obs = null;
  const observe = () => obs.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS});
  I.apply = () => {
    if (I.lang === 'fr') return;
    translateNode(document.body); document.title = t(document.title);
    obs ||= new MutationObserver(muts => {
      obs.disconnect();
      for (const m of muts) {
        if (m.type === 'characterData') translateNode(m.target);
        else if (m.type === 'attributes') attrs(m.target);
        else m.addedNodes.forEach(translateNode);
      }
      observe();
    });
    observe();
  };
  I.setLang = code => { try { localStorage.setItem('leger.lang', code); } catch(_) {} location.reload(); };
  // Chargement du catalogue (aucun pour le français ; « xx » utilise le catalogue source pour repérer les textes manquants)
  I.ready = lang === 'fr' ? Promise.resolve()
    : fetch(`i18n/${lang === 'xx' ? 'catalogue' : lang}.json`).then(r => r.ok ? r.json() : {}).then(d => { I.dict = d; compile(); }).catch(() => {});
})();
