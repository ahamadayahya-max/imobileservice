# i-Mobile Service — Site Web

> Tout l'univers du mobile réuni dans une seule boutique.  
> Réparation & accessoires — 221 Route de Seysses, 31100 Toulouse

---

## 🚀 Installation & lancement

Ce site est **100% statique** — aucun serveur ni build requis.

```bash
# 1. Ouvrir directement dans votre navigateur
# Double-cliquez sur index.html  OU

# 2. Via un serveur local (recommandé pour Stripe)
npx serve .
# → http://localhost:3000

# 3. Via l'extension VS Code "Live Server"
# Clic droit sur index.html → "Open with Live Server"
```

> ⚠️ Pour que Stripe fonctionne, le site doit être servi via HTTP(S), pas en `file://`.

---

## 💳 Configurer Stripe (paiement en ligne)

### Étape 1 — Obtenir votre clé publique

1. Connectez-vous sur [dashboard.stripe.com](https://dashboard.stripe.com/apikeys)
2. Copiez votre **clé publique** (`pk_live_...` en prod, `pk_test_...` en test)

### Étape 2 — Insérer la clé dans le code

Ouvrez `js/stripe.js` et remplacez :

```js
const STRIPE_PUBLIC_KEY = 'pk_test_VOTRE_CLE_ICI';
// → remplacer par :
const STRIPE_PUBLIC_KEY = 'pk_test_51AbCdEf...';
```

### Étape 3 — Créer les produits dans Stripe Dashboard

1. Dashboard → **Products** → **Add product**
2. Créez un produit pour chaque article de la boutique
3. Copiez les **Price IDs** (format `price_1AbCdEf...`)
4. Dans `js/stripe.js`, mettez à jour la fonction `buildLineItems()` avec le mapping :

```js
const priceIds = {
  'verre-trempe-9h-pro':       'price_1AbCdEfGhIjKlMnO',
  'chargeur-45w-usbc':         'price_1PqRsTuVwXyZaBcD',
  'ecouteurs-tws-pro':         'price_1XyZaBcDeFgHiJkL',
  // ... un ID par produit
};
```

### Étape 4 — Configurer les URLs de retour

Dans `js/stripe.js`, les URLs sont déjà configurées :
- Succès → `success.html`
- Annulation → `cancel.html`

Adaptez si vous déployez sur un sous-domaine.

---

## 📧 Configurer EmailJS (emails de confirmation RDV) — Optionnel

Pour envoyer de vrais emails de confirmation après un RDV :

1. Créez un compte sur [emailjs.com](https://www.emailjs.com/)
2. Créez un **Service** (Gmail, Outlook…) et un **Template**
3. Ajoutez dans `rdv.html` avant `</body>` :

```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
<script>
  emailjs.init('VOTRE_PUBLIC_KEY');
</script>
```

4. Dans `js/rdv.js`, remplacez la section `showConfirmation()` par :

```js
emailjs.send('SERVICE_ID', 'TEMPLATE_ID', {
  to_email: rdvState.email,
  to_name:  rdvState.firstName + ' ' + rdvState.lastName,
  rdv_number: rdvNumber,
  rdv_date:   dateLabel,
  rdv_time:   rdvState.time,
  device:     rdvState.device,
});
```

---

## 📁 Structure des fichiers

```
imobileservice/
├── index.html          ← Page d'accueil (hero, services, témoignages)
├── boutique.html       ← Boutique avec panier et paiement Stripe
├── reparation.html     ← Tarifs par appareil (iPhone, Samsung, PC, consoles…)
├── rdv.html            ← Prise de RDV 3 étapes (calendrier JS pur)
├── contact.html        ← Formulaire + carte Google Maps
├── success.html        ← Page retour Stripe — paiement réussi
├── cancel.html         ← Page retour Stripe — paiement annulé
│
├── css/
│   ├── style.css       ← Styles globaux (navbar, footer, hero, toasts…)
│   ├── boutique.css    ← Styles spécifiques boutique + panier + modal
│   └── rdv.css         ← Styles stepper, calendrier, créneaux
│
├── js/
│   ├── main.js         ← Navbar, toasts, animations scroll, badge panier
│   ├── cart.js         ← Panier localStorage, drawer, modal commande
│   ├── rdv.js          ← Logique RDV : stepper, calendrier, créneaux
│   └── stripe.js       ← Intégration Stripe Checkout
│
└── assets/
    └── logo.jpg        ← ⚠️ À PLACER MANUELLEMENT
```

---

## 🎨 Personnalisation

### Modifier les couleurs

Dans `css/style.css`, section `:root` :

```css
--color-cyan: #00bcd4;      /* Accent principal */
--color-bordeaux: #8b1a1a;  /* Accent secondaire */
--color-bg: #f8f9fc;        /* Fond de page */
```

### Modifier les produits

Dans `boutique.html`, chaque carte produit a ces attributs `data-*` :

```html
<button class="add-to-cart-btn"
  data-id="identifiant-unique"
  data-name="Nom du produit"
  data-price="19.90"
  data-emoji="⚡">
```

### Modifier les créneaux horaires

Dans `js/rdv.js`, fonction `getSlotsForDay(dayOfWeek)` :

```js
// Modifier les horaires lundi-vendredi (9h-19h exemple) :
return [
  ...generateSlots('09:00', '12:30'),
  ...generateSlots('14:00', '19:00'), // ← changer ici
];
```

### Modifier les tarifs de réparation

Tout est dans `reparation.html` — cherchez les balises `<td class="price-cell">`.

---

## 🌐 Déploiement

### Netlify (gratuit, recommandé)

```bash
# Via drag & drop :
# 1. Allez sur app.netlify.com
# 2. Faites glisser le dossier imobileservice/
# 3. URL générée automatiquement

# Via CLI :
npm install -g netlify-cli
netlify deploy --dir=. --prod
```

### Vercel

```bash
npm install -g vercel
vercel --prod
```

### OVH / hébergement classique

1. Connectez-vous via FTP (FileZilla)
2. Uploadez tout le contenu du dossier `imobileservice/` à la racine `public_html/`

---

## ⚙️ Variables à configurer

| Fichier | Variable | Description |
|---|---|---|
| `js/stripe.js` | `STRIPE_PUBLIC_KEY` | Clé publique Stripe |
| `js/stripe.js` | `buildLineItems()` | Mapping produit → Price ID Stripe |
| `rdv.html` | EmailJS SDK | Si envoi d'emails de confirmation |

---

## 📋 Checklist avant mise en ligne

- [ ] Logo placé dans `assets/logo.jpg`
- [ ] Clé Stripe configurée dans `js/stripe.js`
- [ ] Price IDs Stripe créés et mappés
- [ ] Testé sur mobile (Chrome DevTools → responsive)
- [ ] Formulaire de contact testé
- [ ] Panier testé (ajout, suppression, calcul total)
- [ ] RDV testé (3 étapes + confirmation)
- [ ] Google Maps vérifié (iframe embed)
- [ ] Liens Facebook et Snapchat vérifiés

---

## 📞 Contact boutique

- **Adresse** : 221 Route de Seysses, 31100 Toulouse
- **Tél** : 05 31 21 71 38
- **Email** : ims.tlse@gmail.com
- **Facebook** : [facebook.com/imservice31](https://www.facebook.com/imservice31/)
- **Snapchat** : [snapchat.com/add/i-mobileservice](https://www.snapchat.com/add/i-mobileservice)

---

© 2018-2025 i-Mobile Service
