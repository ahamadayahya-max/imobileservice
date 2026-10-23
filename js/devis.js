/* ============================================================
   i-Mobile Service — Système Devis Flottant
   Panneau glissant multi-étapes, EmailJS + mailto fallback
   ============================================================ */

/* ── Envoi des devis par email (EmailJS, API REST) ──
   Appel direct à l'API : fonctionne sur toutes les pages, sans dépendre
   du SDK EmailJS qui n'est chargé que sur la boutique. */
const DEVIS_EMAILJS = {
  service:  'service_sgvqdst',
  template: 'template_01plkrv',
  cle:      'BHp_rzqQOf4Ogh91G',
};

async function envoyerEmailDevis(params) {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: DEVIS_EMAILJS.service,
      template_id: DEVIS_EMAILJS.template,
      user_id: DEVIS_EMAILJS.cle,
      template_params: params,
    }),
  });
  if (!res.ok) throw new Error('EmailJS HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120));
}

/* ── État du formulaire ── */
const devisState = { appareil: '', modele: '', pannes: [], description: '' };

/* ── Modèles par appareil (mis à jour octobre 2026, plus récents en premier) ── */
const devisModeles = {
  iphone:  ['iPhone 18 Pro Max','iPhone 18 Pro','iPhone 18','iPhone Duo (pliable)','iPhone 17 Pro Max','iPhone 17 Pro','iPhone Air','iPhone 17','iPhone 16e','iPhone 16 Pro Max','iPhone 16 Pro','iPhone 16 Plus','iPhone 16','iPhone 15 Pro Max','iPhone 15 Pro','iPhone 15 Plus','iPhone 15','iPhone 14 Pro Max','iPhone 14 Pro','iPhone 14 Plus','iPhone 14','iPhone 13 Pro Max','iPhone 13 Pro','iPhone 13 mini','iPhone 13','iPhone 12 Pro Max','iPhone 12 Pro','iPhone 12 mini','iPhone 12','iPhone 11 Pro Max','iPhone 11 Pro','iPhone 11','iPhone XS Max','iPhone XS','iPhone XR','iPhone X','iPhone SE (2022)','iPhone SE (2020)','Autre iPhone'],
  samsung: ['Galaxy S26 Ultra','Galaxy S26+','Galaxy S26','Galaxy S26 FE','Galaxy Z Fold8 Ultra','Galaxy Z Fold8','Galaxy Z Flip8','Galaxy S25 Ultra','Galaxy S25+','Galaxy S25','Galaxy S25 Edge','Galaxy S25 FE','Galaxy Z Fold7','Galaxy Z Flip7','Galaxy S24 Ultra','Galaxy S24+','Galaxy S24','Galaxy S24 FE','Galaxy S23 Ultra','Galaxy S23+','Galaxy S23 FE','Galaxy S23','Galaxy S22 Ultra','Galaxy S22+','Galaxy S22','Galaxy A57','Galaxy A56','Galaxy A55','Galaxy A54','Galaxy A37','Galaxy A36','Galaxy A35','Galaxy A34','Galaxy A26','Galaxy A25','Galaxy A17','Galaxy A16','Galaxy A15','Galaxy A14','Galaxy A07','Autre Samsung'],
  autres:  ['Google Pixel 11 Pro XL','Google Pixel 11 Pro','Google Pixel 11','Google Pixel 10 Pro XL','Google Pixel 10 Pro','Google Pixel 10','Google Pixel 9 Pro','Google Pixel 9','Google Pixel 9a','Google Pixel 8 Pro','Google Pixel 8','Google Pixel 7a','Xiaomi 17','Xiaomi 15T Pro','Xiaomi 15T','Xiaomi 14','Xiaomi 13T','Xiaomi Redmi Note 15 Pro+','Xiaomi Redmi Note 15 Pro','Xiaomi Redmi Note 14 Pro','Xiaomi Redmi Note 14','Xiaomi Redmi Note 13 Pro','Xiaomi Redmi Note 13','OnePlus 13','OnePlus 12','OnePlus Nord CE3','Huawei P60','Huawei Mate 50','Autre marque'],
  tablette:['iPad Pro 13" (M5)','iPad Pro 11" (M5)','iPad Air 13" (M3)','iPad Air 11" (M3)','iPad 11e gen (A16)','iPad mini 7','iPad Pro 12.9','iPad Pro 11','iPad Air 5','iPad mini 6','iPad 10e gen','iPad 9e gen','Samsung Galaxy Tab S11 Ultra','Samsung Galaxy Tab S11','Samsung Galaxy Tab S10 FE','Samsung Galaxy Tab S9 FE','Samsung Galaxy Tab S7 FE','Samsung Galaxy Tab A9','Samsung Galaxy Tab A8','Autre tablette'],
  pc:      ['MacBook Pro 14" (M5)','MacBook Air 15" (M4)','MacBook Air 13" (M4)','MacBook Air M3','MacBook Air M2','MacBook Air M1','MacBook Pro 16','MacBook Pro 14','MacBook Pro 13','HP','Dell','Lenovo ThinkPad','Lenovo','Asus','Acer','MSI','Microsoft Surface','Autre PC'],
  console: ['Nintendo Switch 2','PlayStation 5 Pro','PlayStation 5 Slim','PlayStation 5 (PS5)','PlayStation 4 (PS4)','Nintendo Switch OLED','Nintendo Switch','Nintendo Switch Lite','Xbox Series X','Xbox Series S','Steam Deck','Autre console']
};

const devisAppareilLabels = {
  iphone:'📱 iPhone', samsung:'📱 Samsung', autres:'📱 Autres marques',
  tablette:'📟 Tablette', pc:'💻 PC / Mac', console:'🎮 Console'
};

const devisPanneLabels = {
  ecran:'Écran cassé', batterie:'Batterie', camera:'Caméra',
  charge:'Problème de charge', eau:'Dégât des eaux',
  allumage:"Ne s'allume plus", bouton:'Bouton défectueux', autre:'Autre'
};

/* ── Injection du HTML dans le body ── */
function injecterDevisHTML() {
  const html = `
<div id="devis-float" onclick="ouvrirDevis()" role="button" tabindex="0" aria-label="Ouvrir le formulaire de devis">
  🔧 Devis gratuit<span class="devis-badge">Gratuit</span>
</div>

<div id="devis-overlay" onclick="fermerDevis()"></div>

<div id="devis-panel" class="devis-panel" role="dialog" aria-modal="true" aria-label="Formulaire de devis gratuit">

  <div class="devis-header">
    <span>🔧 Demande de devis gratuit</span>
    <button onclick="fermerDevis()" aria-label="Fermer">✕</button>
  </div>

  <div class="devis-steps">
    <div class="step active" id="nav-step1">1. Appareil</div>
    <div class="step" id="nav-step2">2. Panne</div>
    <div class="step" id="nav-step3">3. Contact</div>
  </div>

  <!-- ÉTAPE 1 -->
  <div id="step1" class="step-content active">
    <p>Quel est votre appareil ?</p>
    <div class="device-grid">
      <div class="device-btn" onclick="selectDevice('iphone',this)">📱 iPhone</div>
      <div class="device-btn" onclick="selectDevice('samsung',this)">📱 Samsung</div>
      <div class="device-btn" onclick="selectDevice('autres',this)">📱 Autres marques</div>
      <div class="device-btn" onclick="selectDevice('tablette',this)">📟 Tablette</div>
      <div class="device-btn" onclick="selectDevice('pc',this)">💻 PC / Mac</div>
      <div class="device-btn" onclick="selectDevice('console',this)">🎮 Console</div>
    </div>
    <div id="model-select" style="display:none">
      <p style="font-size:.87rem;color:#666;margin-bottom:4px;">Quel modèle ?</p>
      <select id="devis-modele" class="devis-select">
        <option value="">-- Choisir le modèle --</option>
      </select>
    </div>
    <button class="btn-next" style="width:100%;margin-top:10px;" onclick="nextStep(2)">Suivant →</button>
  </div>

  <!-- ÉTAPE 2 -->
  <div id="step2" class="step-content">
    <p>Quel est le problème ?</p>
    <div class="panne-list">
      <label class="panne-item"><input type="checkbox" value="ecran"> 🖥️ Écran cassé / fissuré</label>
      <label class="panne-item"><input type="checkbox" value="batterie"> 🔋 Batterie / autonomie</label>
      <label class="panne-item"><input type="checkbox" value="camera"> 📷 Caméra défectueuse</label>
      <label class="panne-item"><input type="checkbox" value="charge"> ⚡ Problème de charge</label>
      <label class="panne-item"><input type="checkbox" value="eau"> 💧 Dégât des eaux</label>
      <label class="panne-item"><input type="checkbox" value="allumage"> ⚫ Ne s'allume plus</label>
      <label class="panne-item"><input type="checkbox" value="bouton"> 🔘 Bouton défectueux</label>
      <label class="panne-item"><input type="checkbox" value="autre"> 🔧 Autre problème</label>
    </div>
    <textarea id="devis-description" placeholder="Décrivez votre problème en quelques mots..." rows="3" class="devis-textarea"></textarea>
    <div class="devis-nav">
      <button onclick="nextStep(1)">← Retour</button>
      <button class="btn-next" onclick="nextStep(3)">Suivant →</button>
    </div>
  </div>

  <!-- ÉTAPE 3 -->
  <div id="step3" class="step-content">
    <p>Vos coordonnées</p>
    <input type="text"  id="devis-prenom"    placeholder="Prénom *"    class="devis-input">
    <input type="text"  id="devis-nom"       placeholder="Nom *"       class="devis-input">
    <input type="email" id="devis-email"     placeholder="Email *"     class="devis-input">
    <input type="tel"   id="devis-telephone" placeholder="Téléphone *" class="devis-input">
    <div class="devis-recap">
      <div class="recap-title">📋 Récapitulatif</div>
      <div id="recap-content"></div>
    </div>
    <label class="rgpd-check">
      <input type="checkbox" id="devis-rgpd">
      J'accepte que mes données soient utilisées pour traiter ma demande de devis.
    </label>
    <div class="devis-nav">
      <button onclick="nextStep(2)">← Retour</button>
      <button class="btn-submit" onclick="envoyerDevis()">✅ Envoyer ma demande</button>
    </div>
  </div>

  <!-- CONFIRMATION -->
  <div id="step-confirm" class="step-content">
    <div class="devis-confirm">
      <div class="confirm-icon">✅</div>
      <h3>Demande envoyée !</h3>
      <p>Nous vous contactons dans les <strong>2h</strong> pour confirmer le devis.</p>
      <p>Ou venez directement au :<br><strong>221 Route de Seysses, Toulouse</strong></p>
      <button onclick="fermerDevis()" class="btn-next" style="margin-top:1.5rem;width:100%;">Continuer ma navigation</button>
    </div>
  </div>

</div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

/* ── Ouvrir / Fermer ── */
function ouvrirDevis() {
  document.getElementById('devis-panel')?.classList.add('open');
  document.getElementById('devis-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.ouvrirDevis = ouvrirDevis;

function fermerDevis() {
  document.getElementById('devis-panel')?.classList.remove('open');
  document.getElementById('devis-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}
window.fermerDevis = fermerDevis;

/* ── Sélectionner un appareil ── */
function selectDevice(type, el) {
  devisState.appareil = type;
  devisState.modele   = '';

  /* Mise en évidence du bouton choisi */
  document.querySelectorAll('#step1 .device-btn').forEach(b => b.classList.remove('selected'));
  if (el) el.classList.add('selected');

  /* Remplir le select modèles */
  const sel = document.getElementById('devis-modele');
  sel.innerHTML = '<option value="">-- Choisir le modèle --</option>';
  (devisModeles[type] || []).forEach(m => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = m;
    sel.appendChild(opt);
  });
  sel.onchange = () => { devisState.modele = sel.value; };

  document.getElementById('model-select').style.display = 'block';
}
window.selectDevice = selectDevice;

/* ── Navigation entre étapes ── */
function nextStep(num) {
  /* Validations */
  if (num === 2 && !devisState.appareil) {
    if (typeof showToast === 'function') showToast('⚠️ Choisissez votre appareil', 'error');
    return;
  }
  if (num === 2) devisState.modele = document.getElementById('devis-modele')?.value || '';

  if (num === 3) {
    const cochees = Array.from(document.querySelectorAll('#step2 input[type="checkbox"]:checked'));
    if (!cochees.length) {
      if (typeof showToast === 'function') showToast('⚠️ Cochez au moins un problème', 'error');
      return;
    }
    devisState.pannes      = cochees.map(c => c.value);
    devisState.description = document.getElementById('devis-description')?.value || '';

    /* Remplir le récapitulatif */
    const pannesTexte = devisState.pannes.map(p => devisPanneLabels[p] || p).join(', ');
    document.getElementById('recap-content').innerHTML = `
      <div class="recap-row">📱 <strong>Appareil :</strong> ${devisAppareilLabels[devisState.appareil] || devisState.appareil}</div>
      ${devisState.modele ? `<div class="recap-row">🔍 <strong>Modèle :</strong> ${devisState.modele}</div>` : ''}
      <div class="recap-row">🔧 <strong>Panne(s) :</strong> ${pannesTexte}</div>
      ${devisState.description ? `<div class="recap-row">💬 <strong>Détail :</strong> ${devisState.description}</div>` : ''}`;
  }

  /* Afficher l'étape cible */
  document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + num)?.classList.add('active');

  /* Mettre à jour le stepper */
  document.querySelectorAll('.devis-steps .step').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === num);
    s.classList.toggle('done',   i + 1 < num);
  });

  /* Revenir en haut du panneau */
  document.getElementById('devis-panel').scrollTop = 0;
}
window.nextStep = nextStep;

/* ── Envoyer le devis ── */
async function envoyerDevis() {
  const prenom = document.getElementById('devis-prenom')?.value.trim()    || '';
  const nom    = document.getElementById('devis-nom')?.value.trim()       || '';
  const email  = document.getElementById('devis-email')?.value.trim()     || '';
  const tel    = document.getElementById('devis-telephone')?.value.trim() || '';
  const rgpd   = document.getElementById('devis-rgpd')?.checked;

  if (!prenom || !nom || !email || !tel) {
    if (typeof showToast === 'function') showToast('⚠️ Merci de remplir tous les champs', 'error');
    return;
  }
  if (!rgpd) {
    if (typeof showToast === 'function') showToast('⚠️ Veuillez accepter les conditions', 'error');
    return;
  }

  const numDevis    = 'DEV-' + Date.now().toString().slice(-5);
  const dateStr     = new Date().toLocaleDateString('fr-FR');
  const pannesTexte = devisState.pannes.map(p => devisPanneLabels[p] || p).join(', ');

  /* Sauvegarder en localStorage */
  const devisData = {
    numero: numDevis, date: dateStr,
    appareil: devisAppareilLabels[devisState.appareil] || devisState.appareil,
    modele: devisState.modele, pannes: pannesTexte,
    description: devisState.description,
    client: { prenom, nom, email, tel }
  };
  const stock = JSON.parse(localStorage.getItem('ims_devis') || '[]');
  stock.unshift(devisData);
  localStorage.setItem('ims_devis', JSON.stringify(stock));

  /* Enregistrement côté serveur : le devis apparaît dans l'admin même si l'email se perd */
  fetch('/api/dossiers?type=devis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(devisData),
    keepalive: true,
  }).catch(err => console.warn('[devis] enregistrement serveur impossible :', err.message));

  /* Envoi direct à la boutique ; le bouton est bloqué pendant l'envoi */
  const boutonEnvoi = document.querySelector('[onclick*="envoyerDevis"]');
  if (boutonEnvoi) { boutonEnvoi.disabled = true; boutonEnvoi.dataset.texte = boutonEnvoi.textContent; boutonEnvoi.textContent = 'Envoi en cours…'; }

  let envoye = false;
  try {
    await envoyerEmailDevis({
      to_email: 'ims.tlse@gmail.com',
      order_number: numDevis, order_date: dateStr,
      customer_name: prenom + ' ' + nom,
      customer_email: email, customer_phone: tel,
      order_items: `DEMANDE DE DEVIS\nAppareil : ${devisData.appareil}\nModèle : ${devisState.modele}\nPannes : ${pannesTexte}\nDescription : ${devisState.description || '—'}`,
      delivery_mode: 'Devis réparation',
      subtotal: 'Sur devis', shipping: '—', total: 'Sur devis',
      reply_to: email
    });
    envoye = true;
  } catch (err) {
    /* Détail technique seulement : jamais les coordonnées du client */
    console.warn('[devis] envoi email impossible :', err.message);
  } finally {
    if (boutonEnvoi) { boutonEnvoi.disabled = false; boutonEnvoi.textContent = boutonEnvoi.dataset.texte || boutonEnvoi.textContent; }
  }

  /* Secours uniquement si l'envoi automatique a échoué : le client envoie lui-même */
  const sujet = encodeURIComponent(`Devis ${numDevis} — ${devisState.modele || devisData.appareil}`);
  const corps = encodeURIComponent(
    `N° : ${numDevis}\nDate : ${dateStr}\n` +
    `Appareil : ${devisData.appareil}\nModèle : ${devisState.modele}\n` +
    `Pannes : ${pannesTexte}\nDescription : ${devisState.description}\n\n` +
    `Client : ${prenom} ${nom}\nEmail : ${email}\nTél : ${tel}`
  );
  if (!envoye) window.open(`mailto:ims.tlse@gmail.com?subject=${sujet}&body=${corps}`, '_blank');

  /* Afficher la confirmation */
  document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
  document.getElementById('step-confirm')?.classList.add('active');
  document.querySelectorAll('.devis-steps .step').forEach(s => {
    s.classList.remove('active'); s.classList.add('done');
  });
  document.getElementById('devis-panel').scrollTop = 0;
}
window.envoyerDevis = envoyerDevis;

/* ── Init au chargement ── */
document.addEventListener('DOMContentLoaded', injecterDevisHTML);
