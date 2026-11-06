/* Простейшее одностраничное приложение: без сборки, без зависимостей. */

const api = {
  async call(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data && data.detail ? data.detail : 'Ошибка сервера';
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }
    return data;
  },
  get(url) { return this.call('GET', url); },
  post(url, body) { return this.call('POST', url, body); },
  patch(url, body) { return this.call('PATCH', url, body); },
  del(url) { return this.call('DELETE', url); },
  async upload(file) {
    const fd = new FormData();
    fd.append('file', file, file.name || 'image');
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.detail) || 'Не удалось загрузить файл');
    return data.url;
  },
};

const state = {
  tab: 'references',
  projects: [],
  projectId: null,
  references: [],
  mechanics: [],
  assetTypes: [],
  refFilter: 'all',
};

const el = (sel) => document.querySelector(sel);
const viewEl = el('#view');
const sheetEl = el('#sheet');
const backdropEl = el('#sheet-backdrop');

const CATEGORY_LABELS = {
  decor: 'Для декорации',
  model: 'Для моделей',
  mechanic: 'Для механики',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;',
  }[c]));

function toast(msg, isError = false) {
  const t = el('#toast');
  t.textContent = msg;
  t.classList.toggle('is-error', isError);
  t.hidden = false;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- загрузка данных ---------- */

async function loadProjects() {
  state.projects = await api.get('/api/projects');
  const sel = el('#project-select');
  sel.innerHTML = state.projects
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join('');
  if (state.projectId === null || !state.projects.some((p) => p.id === state.projectId)) {
    state.projectId = state.projects[0] ? state.projects[0].id : null;
  }
  if (state.projectId !== null) sel.value = String(state.projectId);
}

async function loadProjectData() {
  if (state.projectId === null) {
    state.mechanics = [];
    state.assetTypes = [];
    state.references = [];
    return;
  }
  const [refs, mechs, types] = await Promise.all([
    api.get(`/api/projects/${state.projectId}/references`),
    api.get(`/api/projects/${state.projectId}/mechanics`),
    api.get(`/api/projects/${state.projectId}/asset-types`),
  ]);
  state.references = refs;
  state.mechanics = mechs;
  state.assetTypes = types;
}

async function refresh(keepTab = true) {
  await loadProjects();
  await loadProjectData();
  if (!keepTab) state.tab = 'references';
  render();
}

/* ---------- отрисовка ---------- */

function render() {
  document.querySelectorAll('.tab').forEach((b) => {
    const active = b.dataset.tab === state.tab;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active);
  });
  el('#fab').style.display = state.tab === 'references' && state.projectId === null ? 'none' : 'flex';

  if (state.tab === 'references') renderReferences();
  if (state.tab === 'projects') renderProjects();
  if (state.tab === 'mechanics') renderMechanics();
  if (state.tab === 'asset-types') renderAssetTypes();
}

function renderReferences() {
  if (state.projectId === null) {
    viewEl.innerHTML = '<div class="empty">Создайте первый проект на вкладке «Проекты».</div>';
    return;
  }
  const rows = state.references.filter((r) =>
    state.refFilter === 'all' ? true : r.category === state.refFilter
  );
  const chips = `
    <div class="chips">
      ${['all', 'decor', 'model', 'mechanic'].map((c) => `
        <button class="chip ${state.refFilter === c ? 'is-active' : ''}" data-filter="${c}">
          ${c === 'all' ? 'Все' : CATEGORY_LABELS[c]}
        </button>`).join('')}
    </div>`;
  const cards = rows.map((r) => {
    const assetType = state.assetTypes.find((a) => a.id === r.asset_type_id);
    const mechanic = state.mechanics.find((m) => m.id === r.mechanic_id);
    const thumb = r.image_url
      ? `<div class="ref-thumb"><img src="${esc(r.image_url)}" alt="" loading="lazy"></div>`
      : '';
    return `
    <article class="card" data-testid="card-reference-${r.id}">
      ${thumb}
      <div class="card-top">
        <h3 class="card-title">${esc(r.title)}</h3>
        <div class="card-actions">
          <button class="icon-btn" data-edit-ref="${r.id}" aria-label="Редактировать">✎</button>
          <button class="icon-btn" data-del-ref="${r.id}" aria-label="Удалить">✕</button>
        </div>
      </div>
      ${r.description ? `<p class="card-desc">${esc(r.description)}</p>` : ''}
      <div class="card-meta">
        <span class="badge cat-${r.category}">${CATEGORY_LABELS[r.category]}</span>
        ${assetType ? `<span class="badge">${esc(assetType.name)}</span>` : ''}
        ${mechanic ? `<span class="badge">${esc(mechanic.name)}</span>` : ''}
      </div>
    </article>`;
  }).join('');
  viewEl.innerHTML = chips + (rows.length ? cards : '<div class="empty">Референсов пока нет. Нажмите «+».</div>');
}

function renderProjects() {
  const cards = state.projects.map((p) => `
    <article class="card" data-testid="card-project-${p.id}">
      <div class="card-top">
        <div>
          <h3 class="card-title">${esc(p.name)}</h3>
          ${p.description ? `<p class="card-desc">${esc(p.description)}</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-edit-project="${p.id}" aria-label="Редактировать">✎</button>
          <button class="icon-btn" data-del-project="${p.id}" aria-label="Удалить">✕</button>
        </div>
      </div>
      <div class="card-meta">
        <span class="badge">Референсов: ${p.references_count}</span>
        <span class="badge">Механик: ${p.mechanics_count}</span>
        <span class="badge">Типов ассетов: ${p.asset_types_count}</span>
      </div>
    </article>`).join('');
  viewEl.innerHTML = `
    <p class="section-title">Проекты</p>
    ${cards || '<div class="empty">Проектов пока нет. Нажмите «+».</div>'}`;
}

function renderMechanics() {
  const cards = state.mechanics.map((m) => `
    <article class="card" data-testid="card-mechanic-${m.id}">
      <div class="card-top">
        <div>
          <h3 class="card-title">${esc(m.name)}</h3>
          ${m.description ? `<p class="card-desc">${esc(m.description)}</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-edit-mech="${m.id}" aria-label="Редактировать">✎</button>
          <button class="icon-btn" data-del-mech="${m.id}" aria-label="Удалить">✕</button>
        </div>
      </div>
    </article>`).join('');
  viewEl.innerHTML = `
    <p class="section-title">Механики проекта</p>
    ${cards || '<div class="empty">Механик пока нет. Нажмите «+».</div>'}`;
}

function renderAssetTypes() {
  const cards = state.assetTypes.map((a) => `
    <article class="card" data-testid="card-asset-type-${a.id}">
      <div class="card-top">
        <div>
          <h3 class="card-title">${esc(a.name)}</h3>
          ${a.description ? `<p class="card-desc">${esc(a.description)}</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-edit-type="${a.id}" aria-label="Редактировать">✎</button>
          <button class="icon-btn" data-del-type="${a.id}" aria-label="Удалить">✕</button>
        </div>
      </div>
    </article>`).join('');
  viewEl.innerHTML = `
    <p class="section-title">Типы ассетов проекта</p>
    ${cards || '<div class="empty">Типов ассетов пока нет. Нажмите «+».</div>'}`;
}

/* ---------- модальные формы ---------- */

function openSheet(html) {
  sheetEl.innerHTML = `<div class="sheet-handle"></div>` + html;
  sheetEl.hidden = false;
  backdropEl.hidden = false;
}

function closeSheet() {
  sheetEl.hidden = true;
  backdropEl.hidden = true;
}

function field(label, inner) {
  return `<div class="field"><label>${label}</label>${inner}</div>`;
}

async function confirmDelete(message) {
  // Нативный confirm может блокироваться в некоторых окружениях,
  // поэтому простой inline-вариант через sheet.
  return new Promise((resolve) => {
    openSheet(`
      <h2>${esc(message)}</h2>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-confirm="no">Отмена</button>
        <button class="btn btn-primary" data-confirm="yes">Удалить</button>
      </div>`);
    sheetEl.addEventListener('click', function onChoice(e) {
      const b = e.target.closest('[data-confirm]');
      if (!b) return;
      sheetEl.removeEventListener('click', onChoice);
      closeSheet();
      resolve(b.dataset.confirm === 'yes');
    });
  });
}

function projectForm(p = null) {
  openSheet(`
    <h2>${p ? 'Редактирование проекта' : 'Новый проект'}</h2>
    ${field('Название', `<input id="f-name" data-testid="input-name" value="${esc(p?.name ?? '')}" placeholder="Например: Богатырь">`)}
    ${field('Описание', `<textarea id="f-desc" data-testid="input-description" placeholder="Коротко о проекте">${esc(p?.description ?? '')}</textarea>`)}
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-close>Отмена</button>
      <button class="btn btn-primary" id="f-save" data-testid="button-save">Сохранить</button>
    </div>`);
  el('#f-save').addEventListener('click', async () => {
    const body = {
      name: el('#f-name').value.trim(),
      description: el('#f-desc').value.trim(),
    };
    if (!body.name) return toast('Укажите название', true);
    try {
      if (p) await api.patch(`/api/projects/${p.id}`, body);
      else {
        const created = await api.post('/api/projects', body);
        state.projectId = created.id;
      }
      closeSheet();
      await refresh();
      toast('Проект сохранён');
    } catch (e) { toast(e.message, true); }
  });
}

function mechanicForm(m = null) {
  openSheet(`
    <h2>${m ? 'Редактирование механики' : 'Новая механика'}</h2>
    ${field('Название', `<input id="f-name" data-testid="input-name" value="${esc(m?.name ?? '')}" placeholder="Например: Двойной прыжок">`)}
    ${field('Описание', `<textarea id="f-desc" data-testid="input-description" placeholder="Как работает механика">${esc(m?.description ?? '')}</textarea>`)}
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-close>Отмена</button>
      <button class="btn btn-primary" id="f-save" data-testid="button-save">Сохранить</button>
    </div>`);
  el('#f-save').addEventListener('click', async () => {
    const body = {
      name: el('#f-name').value.trim(),
      description: el('#f-desc').value.trim(),
    };
    if (!body.name) return toast('Укажите название', true);
    try {
      if (m) await api.patch(`/api/mechanics/${m.id}`, body);
      else await api.post(`/api/projects/${state.projectId}/mechanics`, body);
      closeSheet();
      await refresh();
      toast('Механика сохранена');
    } catch (e) { toast(e.message, true); }
  });
}

function assetTypeForm(a = null) {
  openSheet(`
    <h2>${a ? 'Редактирование типа ассета' : 'Новый тип ассета'}</h2>
    ${field('Название', `<input id="f-name" data-testid="input-name" value="${esc(a?.name ?? '')}" placeholder="Например: Персонаж, Оружие, Окружение">`)}
    ${field('Описание', `<textarea id="f-desc" data-testid="input-description" placeholder="Что входит в этот тип">${esc(a?.description ?? '')}</textarea>`)}
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-close>Отмена</button>
      <button class="btn btn-primary" id="f-save" data-testid="button-save">Сохранить</button>
    </div>`);
  el('#f-save').addEventListener('click', async () => {
    const body = {
      name: el('#f-name').value.trim(),
      description: el('#f-desc').value.trim(),
    };
    if (!body.name) return toast('Укажите название', true);
    try {
      if (a) await api.patch(`/api/asset-types/${a.id}`, body);
      else await api.post(`/api/projects/${state.projectId}/asset-types`, body);
      closeSheet();
      await refresh();
      toast('Тип ассета сохранён');
    } catch (e) { toast(e.message, true); }
  });
}

function referenceForm(r = null) {
  const assetOptions = state.assetTypes
    .map((a) => `<option value="${a.id}" ${r && r.asset_type_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`)
    .join('');
  const mechOptions = state.mechanics
    .map((m) => `<option value="${m.id}" ${r && r.mechanic_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`)
    .join('');
  const cat = r ? r.category : 'decor';
  openSheet(`
    <h2>${r ? 'Редактирование референса' : 'Новый референс'}</h2>
    ${field('Название', `<input id="f-title" data-testid="input-title" value="${esc(r?.title ?? '')}" placeholder="Что на референсе">`)}
    ${field('Для чего', `
      <div class="seg" id="f-cat">
        ${Object.entries(CATEGORY_LABELS).map(([k, v]) => `
          <button type="button" data-cat="${k}" class="${cat === k ? 'is-active' : ''}">${v}</button>`).join('')}
      </div>`)}
    ${field('Тип ассета (какой именно)', `<select id="f-asset"><option value="">— не выбран —</option>${assetOptions}</select>`)}
    ${field('Механика (для категории «Для механики»)', `<select id="f-mech"><option value="">— не выбрана —</option>${mechOptions}</select>`)}
    ${field('Изображение', `
      <input type="file" id="f-file" accept="image/jpeg,image/png,image/webp" hidden>
      <div class="img-pick">
        <button type="button" class="btn btn-ghost" id="f-pick" data-testid="button-pick-file">С устройства</button>
        <button type="button" class="btn btn-ghost" id="f-edit-img" data-testid="button-edit-img">В редактор</button>
      </div>
      <input id="f-img" data-testid="input-image-url" value="${esc(r?.image_url ?? '')}" placeholder="Ссылка на изображение или загрузите с устройства">`)}
    <div class="ref-thumb" id="f-preview" hidden></div>
    ${field('Описание', `<textarea id="f-desc" data-testid="input-description" placeholder="Детали, что важно учесть">${esc(r?.description ?? '')}</textarea>`)}
    <div class="sheet-actions">
      <button class="btn btn-ghost" data-close>Отмена</button>
      <button class="btn btn-primary" id="f-save" data-testid="button-save">Сохранить</button>
    </div>`);

  sheetEl.querySelectorAll('#f-cat [data-cat]').forEach((b) => {
    b.addEventListener('click', () => {
      sheetEl.querySelectorAll('#f-cat [data-cat]').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
    });
  });

  const previewEl = el('#f-preview');
  const updatePreview = () => {
    const url = el('#f-img').value.trim();
    if (url) {
      previewEl.innerHTML = `<img src="${esc(url)}" alt="">`;
      previewEl.hidden = false;
    } else {
      previewEl.innerHTML = '';
      previewEl.hidden = true;
    }
  };
  el('#f-img').addEventListener('change', updatePreview);
  updatePreview();

  el('#f-pick').addEventListener('click', () => el('#f-file').click());
  el('#f-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    editor.open(file, (url) => {
      el('#f-img').value = url;
      updatePreview();
      toast('Изображение обновлено');
    });
  });

  el('#f-edit-img').addEventListener('click', () => {
    const url = el('#f-img').value.trim();
    if (!url) return toast('Сначала загрузите изображение или укажите ссылку', true);
    editor.open(url, (newUrl) => {
      el('#f-img').value = newUrl;
      updatePreview();
      toast('Изображение обновлено');
    });
  });

  el('#f-save').addEventListener('click', async () => {
    const catBtn = sheetEl.querySelector('#f-cat .is-active');
    const body = {
      title: el('#f-title').value.trim(),
      category: catBtn ? catBtn.dataset.cat : 'decor',
      asset_type_id: el('#f-asset').value ? Number(el('#f-asset').value) : null,
      mechanic_id: el('#f-mech').value ? Number(el('#f-mech').value) : null,
      image_url: el('#f-img').value.trim(),
      description: el('#f-desc').value.trim(),
    };
    if (!body.title) return toast('Укажите название', true);
    try {
      if (r) await api.patch(`/api/references/${r.id}`, body);
      else await api.post(`/api/projects/${state.projectId}/references`, body);
      closeSheet();
      await refresh();
      toast('Референс сохранён');
    } catch (e) { toast(e.message, true); }
  });
}

/* ---------- редактор изображения ---------- */

const editor = (() => {
  const MAX_DIM = 1600;      // максимальная сторона изображения
  const MAX_UNDO = 10;

  const root = el('#editor');
  const canvas = el('#ed-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const stage = el('#ed-stage');
  const cropRectEl = el('#ed-crop-rect');
  const cropActionsEl = el('#ed-crop-actions');
  const colorsEl = el('#ed-colors');
  const toolsEl = el('#ed-tools');

  let original = null;       // dataURL исходного изображения
  let undoStack = [];
  let mode = 'none';         // none | pen | crop
  let penColor = '#ff5d6e';
  let drawing = false;
  let last = null;
  let cropAnchor = null;     // точка старта выделения (координаты канваса)
  let cropSel = null;        // текущее выделение {x,y,w,h}
  let saving = false;

  function setMode(next) {
    mode = next;
    toolsEl.querySelectorAll('.tool').forEach((b) => {
      b.classList.toggle('is-active', b.dataset.tool === mode);
    });
    colorsEl.hidden = mode !== 'pen';
    cropActionsEl.hidden = mode !== 'crop';
    if (mode !== 'crop') {
      cropSel = null;
      cropAnchor = null;
      cropRectEl.hidden = true;
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
      img.src = src;
    });
  }

  async function open(source, onSave) {
    try {
      let src;
      let revoke = null;
      if (typeof source === 'string') {
        src = source;
      } else {
        revoke = URL.createObjectURL(source);
        src = revoke;
      }
      let img;
      try {
        img = await loadImage(src);
      } finally {
        if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 5000);
      }
      const k = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      original = canvas.toDataURL('image/png');
      undoStack = [];
      saving = false;
      setMode('none');
      root.hidden = false;
      root._onSave = onSave;
    } catch (e) {
      toast(e.message, true);
    }
  }

  function close() {
    root.hidden = true;
    root._onSave = null;
  }

  function toCanvasCoords(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  }

  function pushUndo() {
    try {
      undoStack.push(canvas.toDataURL('image/png'));
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    } catch { /* tainted canvas — undo недоступен */ }
  }

  function restore(dataUrl) {
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }

  function rotate90() {
    pushUndo();
    const w = canvas.width;
    const h = canvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = h;
    tmp.height = w;
    const t = tmp.getContext('2d');
    t.translate(h / 2, w / 2);
    t.rotate(Math.PI / 2);
    t.drawImage(canvas, -w / 2, -h / 2);
    canvas.width = h;
    canvas.height = w;
    ctx.drawImage(tmp, 0, 0);
  }

  function undo() {
    if (!undoStack.length) return toast('Нечего отменять');
    restore(undoStack.pop());
  }

  function reset() {
    if (original) restore(original);
    undoStack = [];
  }

  /* --- рисование --- */

  function strokeWidth() {
    return Math.max(4, Math.round(canvas.width / 200));
  }

  function drawSegment(a, b) {
    ctx.strokeStyle = penColor;
    ctx.lineWidth = strokeWidth();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /* --- обрезка --- */

  function showCropRect() {
    const r = canvas.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const left = r.left - s.left + (cropSel.x / canvas.width) * r.width;
    const top = r.top - s.top + (cropSel.y / canvas.height) * r.height;
    cropRectEl.hidden = false;
    cropRectEl.style.left = `${left}px`;
    cropRectEl.style.top = `${top}px`;
    cropRectEl.style.width = `${(cropSel.w / canvas.width) * r.width}px`;
    cropRectEl.style.height = `${(cropSel.h / canvas.height) * r.height}px`;
  }

  function applyCrop() {
    if (!cropSel || cropSel.w < 8 || cropSel.h < 8) return toast('Выделите область обрезки', true);
    pushUndo();
    const { x, y, w, h } = cropSel;
    const tmp = document.createElement('canvas');
    tmp.width = Math.round(w);
    tmp.height = Math.round(h);
    tmp.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, tmp.width, tmp.height);
    canvas.width = tmp.width;
    canvas.height = tmp.height;
    ctx.drawImage(tmp, 0, 0);
    setMode('none');
  }

  /* --- события канваса --- */

  canvas.addEventListener('pointerdown', (e) => {
    if (mode === 'none') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = toCanvasCoords(e);
    if (mode === 'pen') {
      pushUndo();
      drawing = true;
      last = p;
      ctx.fillStyle = penColor;
      const d = strokeWidth() / 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, d, 0, Math.PI * 2);
      ctx.fill();
    } else if (mode === 'crop') {
      cropAnchor = p;
      cropSel = { x: p.x, y: p.y, w: 0, h: 0 };
      showCropRect();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (mode === 'none' || !e.buttons) return;
    const p = toCanvasCoords(e);
    if (mode === 'pen' && drawing) {
      drawSegment(last, p);
      last = p;
    } else if (mode === 'crop' && cropAnchor) {
      const x0 = Math.max(0, Math.min(cropAnchor.x, p.x));
      const y0 = Math.max(0, Math.min(cropAnchor.y, p.y));
      const x1 = Math.min(canvas.width, Math.max(cropAnchor.x, p.x));
      const y1 = Math.min(canvas.height, Math.max(cropAnchor.y, p.y));
      cropSel = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      showCropRect();
    }
  });

  const endPointer = () => {
    drawing = false;
    last = null;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  /* --- кнопки редактора --- */

  toolsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.tool');
    if (!b) return;
    const tool = b.dataset.tool;
    if (tool === 'rotate') return rotate90();
    if (tool === 'undo') return undo();
    if (tool === 'reset') return reset();
    if (tool === 'pen') return setMode(mode === 'pen' ? 'none' : 'pen');
    if (tool === 'crop') return setMode(mode === 'crop' ? 'none' : 'crop');
  });

  colorsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.color');
    if (!b) return;
    penColor = b.dataset.color;
    colorsEl.querySelectorAll('.color').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
  });

  el('#ed-crop-apply').addEventListener('click', applyCrop);
  el('#ed-crop-cancel').addEventListener('click', () => setMode('none'));
  el('#ed-cancel').addEventListener('click', close);

  el('#ed-save').addEventListener('click', async () => {
    if (saving) return;
    saving = true;
    try {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Не удалось сохранить изображение'))),
          'image/jpeg',
          0.92
        );
      });
      toast('Загрузка…');
      const url = await api.upload(blob);
      const onSave = root._onSave;
      close();
      if (onSave) onSave(url);
    } catch (e) {
      toast(e.message, true);
    } finally {
      saving = false;
    }
  });

  return { open, close };
})();

/* ---------- события ---------- */

el('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  state.tab = b.dataset.tab;
  render();
});

el('#project-select').addEventListener('change', async (e) => {
  state.projectId = Number(e.target.value);
  await loadProjectData();
  render();
});

el('#fab').addEventListener('click', () => {
  if (state.tab === 'references') return referenceForm();
  if (state.tab === 'projects') return projectForm();
  if (state.tab === 'mechanics') return mechanicForm();
  if (state.tab === 'asset-types') return assetTypeForm();
});

backdropEl.addEventListener('click', closeSheet);

sheetEl.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeSheet();
});

viewEl.addEventListener('click', async (e) => {
  const chip = e.target.closest('[data-filter]');
  if (chip) {
    state.refFilter = chip.dataset.filter;
    render();
    return;
  }

  const find = (prefix) => {
    const b = e.target.closest(`[data-${prefix}]`);
    if (!b) return null;
    return Number(b.getAttribute(`data-${prefix}`));
  };

  const editRef = find('edit-ref');
  const delRef = find('del-ref');
  const editProject = find('edit-project');
  const delProject = find('del-project');
  const editMech = find('edit-mech');
  const delMech = find('del-mech');
  const editType = find('edit-type');
  const delType = find('del-type');

  if (editRef !== null) return referenceForm(state.references.find((r) => r.id === editRef));
  if (editProject !== null) return projectForm(state.projects.find((p) => p.id === editProject));
  if (editMech !== null) return mechanicForm(state.mechanics.find((m) => m.id === editMech));
  if (editType !== null) return assetTypeForm(state.assetTypes.find((a) => a.id === editType));

  if (delRef !== null) {
    const r = state.references.find((x) => x.id === delRef);
    if (await confirmDelete(`Удалить референс «${r.title}»?`)) {
      await api.del(`/api/references/${delRef}`);
      await refresh();
      toast('Референс удалён');
    }
    return;
  }
  if (delProject !== null) {
    const p = state.projects.find((x) => x.id === delProject);
    if (await confirmDelete(`Удалить проект «${p.name}»? Механики, типы ассетов и референсы будут удалены вместе с ним.`)) {
      await api.del(`/api/projects/${delProject}`);
      state.projectId = null;
      await refresh();
      toast('Проект удалён');
    }
    return;
  }
  if (delMech !== null) {
    const m = state.mechanics.find((x) => x.id === delMech);
    if (await confirmDelete(`Удалить механику «${m.name}»?`)) {
      await api.del(`/api/mechanics/${delMech}`);
      await refresh();
      toast('Механика удалена');
    }
    return;
  }
  if (delType !== null) {
    const a = state.assetTypes.find((x) => x.id === delType);
    if (await confirmDelete(`Удалить тип ассета «${a.name}»?`)) {
      await api.del(`/api/asset-types/${delType}`);
      await refresh();
      toast('Тип ассета удалён');
    }
  }
});

/* ---------- запуск ---------- */

refresh().catch((e) => toast('Не удалось загрузить данные: ' + e.message, true));
