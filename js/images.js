/* ============================================================
   i-Mobile Service — Mapping images produits
   Priorité : Mobilax (apiv2.mobilax.fr) → Unsplash fallback
   ============================================================ */

/* Base URL Mobilax API */
const MOBILAX = 'https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/';
const MX = (id) => `${MOBILAX}${id}?size=bg`;

/* Base URL Unsplash */
const US = (photoId) => `https://images.unsplash.com/photo-${photoId}?w=400&q=80&auto=format&fit=crop`;

/* ---------------------------------------------------------------
   MAP : id produit → { src, fallback, alt }
   src      = URL principale (Mobilax ou Unsplash)
   fallback = URL de secours si src échoue (toujours Unsplash)
   alt      = texte alternatif pour l'accessibilité
   --------------------------------------------------------------- */
const IMAGES = {

  /* ---- iPhone ------------------------------------------------- */
  1:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 11 64Go Noir reconditionné' },
  2:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 11 128Go Blanc reconditionné' },
  3:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 12 64Go Noir reconditionné' },
  4:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 12 128Go Bleu reconditionné' },
  5:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 13 128Go Minuit reconditionné' },
  6:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 13 256Go Rose reconditionné' },
  7:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 14 128Go Noir reconditionné' },
  8:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 14 Plus 128Go Bleu reconditionné' },
  9:  { src: US('1510557880182-3d4d3cba35a5'), alt: 'iPhone 15 128Go Noir reconditionné' },

  /* ---- Samsung Galaxy ----------------------------------------- */
  10: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy A34 128Go reconditionné' },
  11: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy A54 128Go reconditionné' },
  12: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy A55 128Go reconditionné' },
  13: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy S22 128Go reconditionné' },
  14: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy S23 128Go reconditionné' },
  15: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy S23 FE 128Go reconditionné' },
  16: { src: US('1610945415295-d9bbf067e59c'), alt: 'Samsung Galaxy S24 128Go reconditionné' },

  /* ---- Autres marques ----------------------------------------- */
  17: { src: US('1598327105666-5b89351aff97'), alt: 'Xiaomi Redmi Note 13 128Go' },
  18: { src: US('1598327105666-5b89351aff97'), alt: 'Xiaomi Redmi Note 13 Pro 256Go' },
  19: { src: US('1598327105666-5b89351aff97'), alt: 'Google Pixel 7a 128Go reconditionné' },
  20: { src: US('1585060544812-6b45742d762f'), alt: 'OnePlus Nord CE3 Lite 128Go' },

  /* ---- PC Portables ------------------------------------------- */
  21: { src: US('1496181133206-80ce9b88a853'), alt: 'Lenovo ThinkPad L14 i5 reconditionné' },
  22: { src: US('1496181133206-80ce9b88a853'), alt: 'Dell Latitude 5420 i5 reconditionné' },
  23: { src: US('1496181133206-80ce9b88a853'), alt: 'HP EliteBook 840 G8 reconditionné' },
  24: { src: US('1517336714731-489689fd1ca8'), alt: 'MacBook Air M1 reconditionné' },
  25: { src: US('1517336714731-489689fd1ca8'), alt: 'MacBook Air M2 reconditionné' },

  /* ---- Tablettes ---------------------------------------------- */
  26: { src: US('1544244015-0df4b3ffc6b0'), alt: 'iPad 9e génération 64Go WiFi reconditionné' },
  27: { src: US('1544244015-0df4b3ffc6b0'), alt: 'iPad 10e génération 64Go WiFi reconditionné' },
  28: { src: US('1544244015-0df4b3ffc6b0'), alt: 'iPad Air 5 64Go WiFi reconditionné' },
  29: { src: US('1544244015-0df4b3ffc6b0'), alt: 'iPad mini 6 64Go WiFi reconditionné' },
  30: { src: US('1589739900266-43b2843f4c12'), alt: 'Samsung Galaxy Tab A8 64Go reconditionné' },
  31: { src: US('1589739900266-43b2843f4c12'), alt: 'Samsung Galaxy Tab S7 FE 64Go reconditionné' },
  32: { src: US('1589739900266-43b2843f4c12'), alt: 'Samsung Galaxy Tab S9 FE 128Go reconditionné' },

  /* ---- Protection écran --------------------------------------- */
  33: { src: US('1601784551446-20c9e07cdbdb'), alt: 'Verre trempé standard 9H pour smartphone' },
  34: { src: US('1601784551446-20c9e07cdbdb'), alt: 'Verre trempé premium anti-empreintes' },
  35: { src: US('1583394293214-0a4a53b2e862'), alt: 'Film hydrogel souple toutes marques' },
  36: { src: US('1601784551446-20c9e07cdbdb'), alt: 'Verre trempé Privacy anti-espion' },
  37: { src: US('1601784551446-20c9e07cdbdb'), alt: 'Verre trempé bords incurvés Samsung' },
  38: { src: US('1601784551446-20c9e07cdbdb'), alt: 'Verre trempé mat anti-reflet' },
  39: { src: US('1585771724684-38269d6639fd'), alt: 'Kit nettoyage écran smartphone' },

  /* ---- Coques & Housses --------------------------------------- */
  40: { src: US('1592899677977-9c10ca588bbd'), alt: 'Coque transparente ultra fine smartphone' },
  41: { src: US('1609692814858-f7cd2f0afa4f'), alt: 'Coque silicone liquide 10 couleurs' },
  42: { src: US('1607522370275-f6fd4e191b87'), alt: 'Coque portefeuille porte-carte smartphone' },
  43: { src: US('1560472355-536de3962603'), alt: 'Coque antichoc militaire renforcée' },
  44: { src: US('1601972599720-36938d4ecd31'), alt: 'Coque cuir vegan premium smartphone' },
  45: { src: MX('38895'),                    alt: 'Coque MagSafe aluminium brossé', fallback: US('1592899677977-9c10ca588bbd') },
  46: { src: US('1592899677977-9c10ca588bbd'), alt: 'Coque personnalisable avec photo' },
  47: { src: US('1585771724684-38269d6639fd'), alt: 'Étui folio magnétique iPad' },
  48: { src: US('1553062407-98eeb64c6a62'), alt: 'Housse PC portable 13 pouces néoprène' },
  49: { src: US('1553062407-98eeb64c6a62'), alt: 'Housse PC portable 15 pouces néoprène' },
  50: { src: US('1553062407-98eeb64c6a62'), alt: 'Sac à dos PC 15.6 pouces imperméable' },

  /* ---- Chargeurs & Alimentation ------------------------------ */
  51: { src: US('1588872657578-7efd1f1555ed'), alt: 'Chargeur 20W USB-C charge rapide' },
  52: { src: US('1588872657578-7efd1f1555ed'), alt: 'Chargeur 45W USB-C ultra-rapide' },
  53: { src: US('1609091839311-d5365f9ff1c5'), alt: 'Chargeur GaN 65W double port' },
  54: { src: US('1609091839311-d5365f9ff1c5'), alt: 'Chargeur GaN 100W 3 ports' },
  55: { src: US('1586495777744-4e6232bf5a27'), alt: 'Chargeur sans fil Qi 15W induction' },
  56: { src: US('1611532736597-de2d4265fba3'), alt: 'Chargeur MagSafe 15W iPhone' },
  57: { src: US('1617788138017-80ad40651399'), alt: 'Chargeur voiture USB-C 30W' },
  58: { src: US('1617788138017-80ad40651399'), alt: 'Chargeur voiture double port 65W' },
  59: { src: US('1609659827885-0b79f3d4e9ce'), alt: 'Power bank 10 000mAh USB-C' },
  60: { src: US('1609659827885-0b79f3d4e9ce'), alt: 'Power bank 20 000mAh 65W' },
  61: { src: US('1615526675159-e248c3021d3f'), alt: 'Station de charge 4-en-1 MagSafe' },

  /* ---- Câbles & Adaptateurs ---------------------------------- */
  62: { src: US('1558618666-fcd25c85cd64'), alt: 'Câble USB-C vers USB-C 1m 60W tressé' },
  63: { src: US('1558618666-fcd25c85cd64'), alt: 'Câble USB-C vers USB-C 2m 240W tressé' },
  64: { src: US('1583863788434-e58a36330cf0'), alt: 'Câble USB-C vers Lightning 1m MFi' },
  65: { src: US('1583863788434-e58a36330cf0'), alt: 'Câble USB-C vers Lightning 2m MFi' },
  66: { src: US('1611532736597-de2d4265fba3'), alt: 'Câble MagSafe 1m MacBook' },
  67: { src: US('1601524909162-ae8725290836'), alt: 'Câble multifonction 3-en-1' },
  68: { src: US('1625948515390-96e8e2bdb470'), alt: 'Adaptateur USB-C vers HDMI 4K' },
  69: { src: MX('71771'),                    alt: 'Adaptateur USB-C vers Jack 3.5mm', fallback: US('1590658268037-6bf12165a8df') },
  70: { src: US('1625948515390-96e8e2bdb470'), alt: 'Hub USB-C 7-en-1 MacBook iPad' },

  /* ---- Audio -------------------------------------------------- */
  71: { src: US('1590658268037-6bf12165a8df'), alt: 'Écouteurs filaires USB-C micro intégré' },
  72: { src: US('1606220588913-b3aacb4d2f46'), alt: 'Écouteurs TWS Bluetooth sans fil' },
  73: { src: US('1484704849700-f032a568e944'), alt: 'Écouteurs TWS Pro réduction bruit active' },
  74: { src: US('1608043152269-423dbba4e7e1'), alt: 'Haut-parleur Bluetooth compact étanche' },
  75: { src: US('1545454675-3531b543be5d'), alt: 'Haut-parleur Bluetooth 360° 20W' },
  76: { src: US('1478737270239-2f02b77fc618'), alt: 'Micro cravate USB-C créateurs' },

  /* ---- Accessoires -------------------------------------------- */
  77: { src: US('1617788138017-80ad40651399'), alt: 'Support magnétique voiture tableau de bord' },
  78: { src: US('1617788138017-80ad40651399'), alt: 'Support voiture grille aération' },
  79: { src: MX('36659'),                    alt: 'Anneau PopSocket support téléphone', fallback: US('1609692814858-f7cd2f0afa4f') },
  80: { src: MX('14292'),                    alt: 'Lecteur carte SIM MicroSD', fallback: US('1601524909162-ae8725290836') },
  81: { src: MX('20070'),                    alt: 'Lampe selfie ring LED clip', fallback: US('1611162617474-5b21e879e113') },
  82: { src: US('1593118247619-e2d6f056869e'), alt: 'Manette Bluetooth gaming téléphone' },
  83: { src: US('1434493789847-2f02dc6ca35d'), alt: 'Bracelet Apple Watch silicone' },
  84: { src: US('1434493789847-2f02dc6ca35d'), alt: 'Bracelet Apple Watch cuir véritable' },
  85: { src: US('1434493789847-2f02dc6ca35d'), alt: 'Bracelet Samsung Galaxy Watch silicone' },
  86: { src: US('1589642380614-4a8c2776e9f3'), alt: 'Stylet universel iPad tablette' },
  87: { src: US('1593118247619-e2d6f056869e'), alt: 'Lunettes VR réalité virtuelle' },
};

/* Exposer globalement */
window.IMAGES = IMAGES;
