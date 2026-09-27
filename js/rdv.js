/* ============================================================
   i-Mobile Service — Prise de rendez-vous
   Stepper 3 étapes, calendrier JS pur, créneaux horaires
   ============================================================ */

/* ---------- État global du formulaire ---------------------- */
const rdvState = {
  step: 1,
  device: null,
  brand: null,
  issues: [],
  description: '',
  date: null,
  time: null,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  message: '',
};

/* Calendrier */
let calendarDate = new Date();
calendarDate.setDate(1);

/* ---------- Horaires selon le jour de la semaine ----------- */
function getSlotsForDay(dayOfWeek) {
  /* 0 = dimanche, 1 = lundi, 6 = samedi */
  if (dayOfWeek === 0 || dayOfWeek === 1) return []; /* Fermé dimanche + lundi */
  if (dayOfWeek === 5) {
    /* Vendredi : 10h00–12h00 + 15h00–19h00 */
    return [
      ...generateSlots('10:00', '12:00'),
      ...generateSlots('15:00', '19:00'),
    ];
  }
  if (dayOfWeek === 6) {
    /* Samedi : 10h00–12h00 + 14h00–18h00 */
    return [
      ...generateSlots('10:00', '12:00'),
      ...generateSlots('14:00', '18:00'),
    ];
  }
  /* Mardi–Jeudi : 10h00–12h00 + 14h00–19h00 */
  return [
    ...generateSlots('10:00', '12:00'),
    ...generateSlots('14:00', '19:00'),
  ];
}

function generateSlots(start, end) {
  const slots = [];
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  let h = startH, m = startM;
  while (h < endH || (h === endH && m <= endM)) {
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    m += 30;
    if (m >= 60) { m -= 60; h++; }
  }
  return slots;
}

/* Simuler ~30% de créneaux "complets" de façon déterministe */
function isSlotFull(dateStr, time) {
  /* Utiliser un hash simple pour que les mêmes créneaux restent "complets" */
  const key = dateStr + time;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xFFFF;
  }
  return hash % 10 < 3; /* ~30% */
}

/* ---------- Stepper --------------------------------------- */
function goToStep(step) {
  if (step < 1 || step > 3) return;
  rdvState.step = step;

  const stepItems = document.querySelectorAll('.step-item');
  const stepLines = document.querySelectorAll('.step-line');

  stepItems.forEach((item, idx) => {
    const n = idx + 1;
    item.classList.remove('active', 'done');
    if (n < step) item.classList.add('done');
    else if (n === step) item.classList.add('active');
  });

  stepLines.forEach((line, idx) => {
    line.classList.remove('done', 'active');
    if (idx + 1 < step) line.classList.add('done');
    else if (idx + 1 === step) line.classList.add('active');
  });

  /* Afficher le bon panneau */
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  const active = document.getElementById(`step-${step}`);
  if (active) active.classList.add('active');

  /* Scroll en haut du formulaire */
  const form = document.getElementById('rdv-form-wrapper');
  if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Étape 1 : type d'appareil --------------------- */
document.querySelectorAll('.device-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.device-type-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    rdvState.device = btn.dataset.device;

    /* Afficher la sélection de marque uniquement pour smartphones */
    const brandSelector = document.getElementById('brand-selector');
    if (brandSelector) {
      if (rdvState.device === 'smartphone') {
        brandSelector.classList.add('visible');
      } else {
        brandSelector.classList.remove('visible');
        rdvState.brand = null;
        document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('selected'));
      }
    }
  });
});

document.querySelectorAll('.brand-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.brand-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    rdvState.brand = btn.dataset.brand;
  });
});

/* Checkboxes problèmes */
document.querySelectorAll('.issue-checkbox input').forEach(input => {
  input.addEventListener('change', () => {
    rdvState.issues = Array.from(
      document.querySelectorAll('.issue-checkbox input:checked')
    ).map(i => i.value);
  });
});

/* Valider étape 1 */
document.getElementById('step1-next')?.addEventListener('click', () => {
  if (!rdvState.device) {
    showToast('Veuillez sélectionner un type d\'appareil', 'error');
    return;
  }
  const desc = document.getElementById('issue-desc');
  if (desc) rdvState.description = desc.value.trim();
  goToStep(2);
});

/* ---------- Étape 2 : Calendrier -------------------------- */
function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin',
                      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  const monthLabel = document.getElementById('calendar-month');
  if (monthLabel) monthLabel.textContent = `${monthNames[month]} ${year}`;

  /* Premier jour du mois et nombre de jours */
  const firstDay = new Date(year, month, 1).getDay();
  /* En France, la semaine commence le lundi (1) */
  const startOffset = (firstDay === 0) ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  /* Jours du mois précédent pour remplir la grille */
  const prevMonthDays = new Date(year, month, 0).getDate();

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  grid.innerHTML = '';

  /* Jours du mois précédent */
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = document.createElement('div');
    day.className = 'cal-day other-month';
    day.textContent = prevMonthDays - i;
    grid.appendChild(day);
  }

  /* Jours du mois courant */
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const isToday = date.getTime() === today.getTime();
    const isPast  = date < today;
    const isSunday = date.getDay() === 0;
    const isMonday = date.getDay() === 1;
    const isClosed = isSunday || isMonday;
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isSelected = rdvState.date === dateStr;

    const day = document.createElement('div');
    day.className = [
      'cal-day',
      isToday ? 'today' : '',
      isPast || isClosed ? 'disabled' : '',
      isSunday ? 'sunday' : '',
      isSelected ? 'selected' : '',
    ].filter(Boolean).join(' ');
    day.textContent = d;
    if (isClosed && !isPast) day.title = 'Fermé';

    if (!isPast && !isClosed) {
      day.addEventListener('click', () => {
        rdvState.date = dateStr;
        rdvState.time = null;
        renderCalendar();
        renderSlots(dateStr, date.getDay());
      });
    }

    grid.appendChild(day);
  }

  /* Compléter la dernière ligne */
  const total = startOffset + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= remaining; i++) {
    const day = document.createElement('div');
    day.className = 'cal-day other-month';
    day.textContent = i;
    grid.appendChild(day);
  }
}

function renderSlots(dateStr, dayOfWeek) {
  const section = document.getElementById('slots-section');
  if (!section) return;

  const allSlots = getSlotsForDay(dayOfWeek);
  if (allSlots.length === 0) {
    section.classList.remove('visible');
    return;
  }

  section.classList.add('visible');

  const label = document.getElementById('slots-date-label');
  if (label) {
    const [y, m, d] = dateStr.split('-');
    const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const months = ['janvier','février','mars','avril','mai','juin',
                    'juillet','août','septembre','octobre','novembre','décembre'];
    const date = new Date(parseInt(y), parseInt(m)-1, parseInt(d));
    label.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v7.5"/>
      </svg>
      Créneaux disponibles — ${days[date.getDay()]} ${parseInt(d)} ${months[date.getMonth()]} ${y}
    `;
  }

  /* Séparer matin / après-midi */
  const morning = allSlots.filter(t => parseInt(t.split(':')[0]) < 13);
  const afternoon = allSlots.filter(t => parseInt(t.split(':')[0]) >= 13);

  const periods = [
    { label: '🌅 Matin', slots: morning },
    { label: '☀️ Après-midi', slots: afternoon },
  ];

  const container = document.getElementById('slots-container');
  if (!container) return;
  container.innerHTML = '';

  periods.forEach(period => {
    if (!period.slots.length) return;
    const periodDiv = document.createElement('div');
    periodDiv.className = 'slots-period';
    const title = document.createElement('div');
    title.className = 'slots-period-title';
    title.textContent = period.label;
    periodDiv.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'slots-grid';

    period.slots.forEach(time => {
      const full = isSlotFull(dateStr, time);
      const btn = document.createElement('button');
      btn.className = `slot-btn${full ? ' full' : ''}${rdvState.time === time && !full ? ' selected' : ''}`;
      btn.textContent = time;
      btn.disabled = full;
      btn.title = full ? 'Créneau complet' : '';
      if (!full) {
        btn.addEventListener('click', () => {
          rdvState.time = time;
          /* Re-render pour mettre à jour la sélection */
          renderSlots(dateStr, dayOfWeek);
        });
      }
      grid.appendChild(btn);
    });

    periodDiv.appendChild(grid);
    container.appendChild(periodDiv);
  });
}

/* Navigation calendrier */
document.getElementById('cal-prev')?.addEventListener('click', () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});
document.getElementById('cal-next')?.addEventListener('click', () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

/* Validation étape 2 */
document.getElementById('step2-next')?.addEventListener('click', () => {
  if (!rdvState.date) { showToast('Veuillez choisir une date', 'error'); return; }
  if (!rdvState.time) { showToast('Veuillez choisir un créneau horaire', 'error'); return; }
  updateRecap();
  goToStep(3);
});
document.getElementById('step2-prev')?.addEventListener('click', () => goToStep(1));

/* ---------- Étape 3 : Coordonnées + récapitulatif ---------- */
function updateRecap() {
  const deviceLabels = {
    smartphone: '📱 Smartphone',
    tablette:   '📲 Tablette',
    pc:         '💻 PC / Ordinateur',
    console:    '🎮 Console',
    autre:      '🔧 Autre',
  };
  const recap = document.getElementById('rdv-recap');
  if (!recap) return;

  const [y, m, d] = (rdvState.date || '---').split('-');
  const months = ['janv.','févr.','mars','avr.','mai','juin',
                  'juil.','août','sept.','oct.','nov.','déc.'];
  const dateLabel = rdvState.date
    ? `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
    : '—';

  recap.innerHTML = `
    <div class="rdv-recap-title">📋 Récapitulatif de votre demande</div>
    <div class="rdv-recap-grid">
      <div class="rdv-recap-row"><span class="rdv-recap-key">Appareil</span><span class="rdv-recap-val">${deviceLabels[rdvState.device] || '—'}${rdvState.brand ? ' — ' + rdvState.brand : ''}</span></div>
      <div class="rdv-recap-row"><span class="rdv-recap-key">Date</span><span class="rdv-recap-val">${dateLabel}</span></div>
      <div class="rdv-recap-row"><span class="rdv-recap-key">Heure</span><span class="rdv-recap-val">${rdvState.time || '—'}</span></div>
      ${rdvState.issues.length ? `<div class="rdv-recap-row"><span class="rdv-recap-key">Problème(s)</span><span class="rdv-recap-val">${rdvState.issues.join(', ')}</span></div>` : ''}
      ${rdvState.description ? `<div class="rdv-recap-row"><span class="rdv-recap-key">Description</span><span class="rdv-recap-val">${rdvState.description.substring(0, 80)}${rdvState.description.length > 80 ? '…' : ''}</span></div>` : ''}
    </div>
  `;
}

document.getElementById('step3-prev')?.addEventListener('click', () => goToStep(2));

/* Soumission du formulaire RDV */
document.getElementById('rdv-submit-btn')?.addEventListener('click', () => {
  const fields = ['rdv-firstname', 'rdv-lastname', 'rdv-email', 'rdv-phone'];
  let isValid = true;

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const err = el.parentElement.querySelector('.form-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      err && err.classList.add('visible');
      isValid = false;
    } else {
      el.classList.remove('error');
      err && err.classList.remove('visible');
    }
  });

  /* Validation email */
  const emailEl = document.getElementById('rdv-email');
  if (emailEl && emailEl.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
    emailEl.classList.add('error');
    const err = emailEl.parentElement.querySelector('.form-error');
    if (err) { err.textContent = 'Email invalide'; err.classList.add('visible'); }
    isValid = false;
  }

  /* RGPD obligatoire */
  const rgpd = document.getElementById('rgpd-consent');
  if (rgpd && !rgpd.checked) {
    showToast('Veuillez accepter la politique de confidentialité', 'error');
    isValid = false;
  }

  if (!isValid) { showToast('Veuillez corriger les champs en rouge', 'error'); return; }

  /* Sauvegarder les données */
  rdvState.firstName = document.getElementById('rdv-firstname')?.value.trim();
  rdvState.lastName  = document.getElementById('rdv-lastname')?.value.trim();
  rdvState.email     = document.getElementById('rdv-email')?.value.trim();
  rdvState.phone     = document.getElementById('rdv-phone')?.value.trim();
  rdvState.message   = document.getElementById('rdv-message')?.value.trim();

  showConfirmation();
});

/* ---------- Confirmation ---------------------------------- */
function showConfirmation() {
  /* Masquer le formulaire */
  const wrapper = document.getElementById('rdv-form-wrapper');
  if (wrapper) wrapper.style.display = 'none';

  /* Générer un numéro de RDV aléatoire */
  const rdvNumber = 'IMS-' + String(Math.floor(10000 + Math.random() * 90000));

  const [y, m, d] = (rdvState.date || '').split('-');
  const months = ['janvier','février','mars','avril','mai','juin',
                  'juillet','août','septembre','octobre','novembre','décembre'];
  const dateLabel = rdvState.date
    ? `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`
    : '';

  /* Remplir la carte de confirmation */
  const card = document.getElementById('confirmation-card');
  if (card) {
    document.getElementById('conf-rdv-number').textContent = rdvNumber;
    document.getElementById('conf-date').textContent = `${dateLabel} à ${rdvState.time}`;
    document.getElementById('conf-name').textContent = `${rdvState.firstName} ${rdvState.lastName}`;
    document.getElementById('conf-device').textContent = rdvState.device || '—';
    card.classList.add('visible');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* Optionnel : ouvrir un mailto avec le récapitulatif */
  const subject = encodeURIComponent(`Confirmation RDV ${rdvNumber} — i-Mobile Service`);
  const body = encodeURIComponent(
    `Bonjour,\n\nVotre rendez-vous a été confirmé :\n\n` +
    `N° RDV : ${rdvNumber}\n` +
    `Date : ${dateLabel} à ${rdvState.time}\n` +
    `Appareil : ${rdvState.device}\n\n` +
    `i-Mobile Service — 221 Route de Seysses, 31100 Toulouse\n` +
    `Tél : 05 31 21 71 38`
  );
  const mailtoLink = document.getElementById('conf-mailto');
  if (mailtoLink) {
    mailtoLink.href = `mailto:${rdvState.email}?subject=${subject}&body=${body}`;
  }
}

/* ---------- Pré-remplir le type depuis l'URL -------------- */
document.addEventListener('DOMContentLoaded', () => {
  renderCalendar();
  goToStep(1);

  /* Pré-sélection depuis la page réparations */
  if (window._rdvDevice) {
    const targetBtn = document.querySelector(`.device-type-btn[data-device="${window._rdvDevice}"]`);
    if (targetBtn) targetBtn.click();
  }
});
