import { AppState } from "./state.js";
import { monthNames, getSundays as buildSundays, getLocalISODate } from "./calendar.js";
import { initializeFirebase, signInAnonymously } from "./firebase.js";
import { subscribeToMonth, saveMonth, createSpecialDate } from "./agendaRepository.js";
import { renderContent, escapeHtml } from "./ui/render.js";

let db;
const getYear = () => AppState.currentYear;
const getSundays = (month, year = getYear()) => buildSundays(month, year);

function render() {
    renderContent();
    if (AppState.viewMode === 'edit') {
        if (AppState.editorScreen === 'advanced') bindAdvancedEvents();
        else bindEditEvents();
    }
}

function populateYearSelect() {
    const select = document.getElementById('yearSelect');
    if (!select) return;

    const current = new Date().getFullYear();
    const firstYear = Math.min(2020, current - 10);
    const lastYear = current + 5;

    select.innerHTML = '';
    for (let year = firstYear; year <= lastYear; year++) {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        select.appendChild(option);
    }
    select.value = String(AppState.currentYear);
}


function refreshAgendaDates(preferredDateKey = null) {
    const previousDateKey = AppState.agendaDates[AppState.activeIdx];
    const monthPrefix = `${AppState.currentYear}-${String(AppState.currentMonth + 1).padStart(2, '0')}-`;
    const specialDates = Object.entries(AppState.monthData || {})
        .filter(([dateKey, data]) =>
            dateKey.startsWith(monthPrefix) &&
            /^\d{4}-\d{2}-\d{2}$/.test(dateKey) &&
            data && data.isSpecialDate === true
        )
        .map(([dateKey]) => dateKey);

    AppState.agendaDates = [...new Set([
        ...getSundays(AppState.currentMonth, AppState.currentYear),
        ...specialDates
    ])].sort();

    const targetDateKey = preferredDateKey || previousDateKey;
    const targetIndex = targetDateKey ? AppState.agendaDates.indexOf(targetDateKey) : -1;
    if (targetIndex >= 0) {
        AppState.activeIdx = targetIndex;
    } else {
        AppState.activeIdx = Math.min(
            AppState.activeIdx,
            Math.max(0, AppState.agendaDates.length - 1)
        );
    }
}

let connectTimeout;
    function setSyncStatus(state, text) {
        const dot = document.getElementById('syncDot');
        const txt = document.getElementById('syncText');
        const badge = document.getElementById('syncStatus');
        dot.className = 'sync-dot ' + (state || '');
        txt.textContent = text;
        // Manage badge classes
        badge.classList.remove('saved', 'offline');
        if (state === 'offline') badge.classList.add('offline');
        // Clear any pending connection timeout on success/error
        if (state === 'online' || state === 'error' || state === 'offline') {
            clearTimeout(connectTimeout);
        }
    }

    function startConnectTimeout() {
        clearTimeout(connectTimeout);
        connectTimeout = setTimeout(() => {
            const dot = document.getElementById('syncDot');
            // Only fire if still in a pending state
            if (dot && (dot.classList.contains('saving') || !dot.classList.contains('online'))) {
                setSyncStatus('offline', 'Sin conexión');
                // Allow retry on click
                document.getElementById('syncStatus').onclick = () => {
                    document.getElementById('syncStatus').onclick = null;
                    setSyncStatus('saving', 'Reconectando…');
                    startConnectTimeout();
                    setupRealtimeListener();
                };
            }
        }, 9000);
    }

    async function init() {
    let stage = 'Inicializar Firebase';

    try {
        const services = initializeFirebase();
        db = services.db;

        stage = 'Iniciar sesión anónima en Firebase';
        startConnectTimeout();
        const credential = await signInAnonymously(services.auth);
        AppState.user = credential.user;

        stage = 'Preparar calendario';
        setupInitialState();
        populateYearSelect();

        stage = 'Preparar controles de la agenda';
        setupEventListeners();

        stage = 'Conectar con Firestore';
        setupRealtimeListener();
        updateTodayLabel();
    } catch (error) {
        console.error(`Agenda IEBLA — error en etapa: ${stage}`, error);

        const code = error?.code || 'sin código';
        const message = error?.message || String(error);
        const content = document.getElementById('contentArea');

        content.innerHTML = `
            <div class="loading-state" style="color:#f87171;text-align:left;line-height:1.6">
                <strong>No se pudo iniciar la agenda.</strong>
                <p style="margin-top:10px;color:#cbd5e1">Etapa: ${escapeHtml(stage)}</p>
                <p style="margin-top:6px;color:#cbd5e1">Código: ${escapeHtml(code)}</p>
                <p style="margin-top:6px;color:#cbd5e1;overflow-wrap:anywhere">${escapeHtml(message)}</p>
                <button id="retryAgendaBtn" class="btn btn-primary" style="margin-top:18px">Reintentar</button>
            </div>
        `;

        document.getElementById('retryAgendaBtn')?.addEventListener('click', () => {
            window.location.reload();
        });
        setSyncStatus('error', 'Error de conexión');
    }
}

function setupInitialState() {
    const today = new Date();
    const todayISO = getLocalISODate(today);
    let month = today.getMonth();
    let year = today.getFullYear();
    let attempts = 0;

    while (attempts < 12) {
        const sundays = getSundays(month, year);
        const index = sundays.findIndex(date => date >= todayISO);

        if (index !== -1) {
            AppState.currentYear = year;
            AppState.currentMonth = month;
            AppState.agendaDates = sundays;
            AppState.activeIdx = index;
            break;
        }

        month++;
        if (month > 11) {
            month = 0;
            year++;
        }
        attempts++;
    }

    if (attempts >= 12) {
        AppState.currentYear = today.getFullYear();
        AppState.currentMonth = today.getMonth();
        AppState.agendaDates = getSundays(AppState.currentMonth, AppState.currentYear);
        AppState.activeIdx = 0;
    }

    document.getElementById('monthSelect').value = String(AppState.currentMonth);
    document.getElementById('yearSelect').value = String(AppState.currentYear);
}

function setupEventListeners() {
    const flushPendingSave = () => {
        if (!saveTimeout || !AppState.user) return;
        clearTimeout(saveTimeout);
        saveTimeout = null;
        void save();
    };

    window.addEventListener('beforeunload', flushPendingSave);
    window.addEventListener('pagehide', flushPendingSave);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushPendingSave();
    });

    document.getElementById('prevSunday').addEventListener('click', () => {
        if (AppState.activeIdx > 0) {
            AppState.activeIdx--;
            render();
        }
    });
    document.getElementById('nextSunday').addEventListener('click', () => {
        if (AppState.activeIdx < AppState.agendaDates.length - 1) {
            AppState.activeIdx++;
            render();
        }
    });
    document.getElementById('toggleModeBtn').addEventListener('click', toggleMode);
    document.getElementById('monthSelect').addEventListener('change', changeMonth);
    document.getElementById('yearSelect').addEventListener('change', changeYear);
    document.getElementById('exportBtn').addEventListener('click', exportImage);
    bindDeleteHandler();
}

function setupRealtimeListener() {
    if (AppState.unsubscribe) AppState.unsubscribe();
    if (!AppState.user || !db) return;

    setSyncStatus('saving', 'Sincronizando…');
    startConnectTimeout();

    AppState.unsubscribe = subscribeToMonth(
        db,
        AppState.appId,
        AppState.currentYear,
        AppState.currentMonth,
        monthData => {
            if (AppState.skipNextSnapshot > 0) {
                AppState.skipNextSnapshot--;
                setSyncStatus('online', 'Online');
                return;
            }

            AppState.monthData = monthData || {};
            refreshAgendaDates(AppState.pendingDateKey);
            AppState.pendingDateKey = null;
            render();
            setSyncStatus('online', 'Online');
        },
        error => {
            console.error("Error al leer la agenda en Firestore:", error);
            const code = error?.code || 'sin código';
            const message = error?.message || String(error);
            document.getElementById('contentArea').innerHTML = `
                <div class="loading-state" style="color:#f87171;text-align:left;line-height:1.6">
                    <strong>La conexión se inició, pero no se pudo leer la agenda.</strong>
                    <p style="margin-top:10px;color:#cbd5e1">Código: ${escapeHtml(code)}</p>
                    <p style="margin-top:6px;color:#cbd5e1;overflow-wrap:anywhere">${escapeHtml(message)}</p>
                    <button id="retryAgendaBtn" class="btn btn-primary" style="margin-top:18px">Reintentar</button>
                </div>
            `;
            document.getElementById('retryAgendaBtn')?.addEventListener('click', () => window.location.reload());
            setSyncStatus('error', 'Error de lectura');
        }
    );
}

// BUG 7 FIX: sanitize HTML to prevent XSS from user-entered song/note content
    function bindEditEvents() {
        // Toggle músicos
        const toggleBtn = document.getElementById('musiciansToggleBtn');
        const gridWrap  = document.getElementById('musiciansGridWrap');
        if (toggleBtn && gridWrap) {
            toggleBtn.addEventListener('click', () => {
                const isOpen = gridWrap.classList.toggle('open');
                toggleBtn.innerHTML = isOpen
                    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><path d="M18 15l-6-6-6 6"/></svg>Ocultar músicos`
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Seleccionar músicos`;
            });
        }

        // Musicians — click on row to toggle, click on role chip to toggle role
        document.getElementById('musiciansGrid').addEventListener('click', (e) => {
            const dateKey = AppState.agendaDates[AppState.activeIdx];
            const musicians = AppState.monthData[dateKey].musicians;

            // Role chip click
            const chip = e.target.closest('.role-chip');
            if (chip) {
                e.stopPropagation();
                const name = chip.dataset.musician;
                const role = chip.dataset.role;
                const m = musicians.find(x => x.name === name);
                if (!m) return;
                const idx = m.roles.indexOf(role);
                if (idx === -1) {
                    m.roles.push(role);
                } else {
                    // BUG 5 FIX: never allow removing the last role
                    if (m.roles.length > 1) m.roles.splice(idx, 1);
                    else return; // silently ignore — must keep at least one role
                }
                chip.classList.toggle('role-active', m.roles.includes(role));
                debouncedSave();
                return;
            }

            // Row click — toggle musician on/off
            const row = e.target.closest('.musician-row');
            if (!row) return;
            const name = row.dataset.musician;
            const cfg = AppState.musiciansConfig.find(c => c.name === name);
            const existingIdx = musicians.findIndex(x => x.name === name);

            if (existingIdx !== -1) {
                // Deselect
                musicians.splice(existingIdx, 1);
                row.classList.remove('selected');
                const chips = row.querySelector('.role-chips');
                if (chips) chips.classList.add('role-chips-hidden');
            } else {
                // Select — auto-assign first role always as default
                const defaultRoles = [cfg.roles[0]];
                musicians.push({ name, roles: defaultRoles });
                row.classList.add('selected');
                const chips = row.querySelector('.role-chips');
                if (chips) {
                    chips.classList.remove('role-chips-hidden');
                    // Mark first chip as active by default
                    chips.querySelectorAll('.role-chip').forEach((c, i) => {
                        c.classList.toggle('role-active', i === 0);
                    });
                }
            }
            debouncedSave();
        });

        // Add song
        document.getElementById('add-songs').addEventListener('click', () => addItem('songs'));

        // Danza toggle — update DOM directly to avoid losing focus/state
        const danzaCheck = document.getElementById('danzaCheck');
        if (danzaCheck) {
            danzaCheck.addEventListener('change', () => {
                const dateKey = AppState.agendaDates[AppState.activeIdx];
                const isActive = danzaCheck.checked;
                AppState.monthData[dateKey].danza.active = isActive;
                if (!isActive) AppState.monthData[dateKey].danza.songs = [];

                // Update label
                const label = danzaCheck.closest('.danza-toggle').querySelector('.danza-toggle-label');
                if (label) label.textContent = isActive ? 'Presente' : 'No presente';

                // Show/hide song list
                let songsList = document.getElementById('danzaSongsList');
                if (isActive && !songsList) {
                    const data = AppState.monthData[dateKey];
                    const container = document.getElementById('danzaCard').querySelector('.card-header').parentElement;
                    const div = document.createElement('div');
                    div.className = 'danza-songs-list';
                    div.id = 'danzaSongsList';
                    div.innerHTML = data.songs.length
                        ? `<p class="danza-hint">Seleccioná las canciones que acompañará:</p>` +
                          data.songs.map((s, i) => `<label class="danza-song-row" data-song-idx="${i}">
                            <div class="check-box"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 6l3 3 5-5"/></svg></div>
                            <span>${s || '—'}</span>
                          </label>`).join('')
                        : `<p class="danza-hint">Primero agregá canciones en la sección de arriba.</p>`;
                    container.appendChild(div);
                    bindDanzaSongEvents(div, dateKey);
                } else if (!isActive && songsList) {
                    songsList.remove();
                }
                debouncedSave();
            });
        }

        // Danza song selection (existing list on render)
        const danzaList = document.getElementById('danzaSongsList');
        if (danzaList) bindDanzaSongEvents(danzaList, AppState.agendaDates[AppState.activeIdx]);
    }

    function bindDanzaSongEvents(container, dateKey) {
        container.addEventListener('click', (e) => {
            const row = e.target.closest('.danza-song-row');
            if (!row) return;
            const idx = parseInt(row.dataset.songIdx);
            const danza = AppState.monthData[dateKey].danza;
            const pos = danza.songs.indexOf(idx);
            if (pos === -1) danza.songs.push(idx);
            else danza.songs.splice(pos, 1);
            const isSelected = danza.songs.includes(idx);
            row.classList.toggle('selected', isSelected);
            const cb = row.querySelector('.check-box');
            cb.querySelector('svg').style.color = isSelected ? '#0a0a0f' : 'transparent';
            cb.style.background = isSelected ? 'var(--accent-emerald)' : '';
            cb.style.borderColor = isSelected ? 'var(--accent-emerald)' : '';
            debouncedSave();
        });
    }

    // ── Delete handler — registered ONCE per edit render ──────────────────────
    function bindDeleteHandler() {
        const XIcon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="pointer-events:none"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>';
        const CheckIcon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="pointer-events:none"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';

        document.body.addEventListener('click', (e) => {
            // Move up/down buttons (touch)
            const moveBtn = e.target.closest('[data-move-dir]');
            if (moveBtn && !moveBtn.disabled) {
                const idx = parseInt(moveBtn.dataset.moveIdx);
                const dir = moveBtn.dataset.moveDir;
                const toIdx = dir === 'up' ? idx - 1 : idx + 1;
                // Reuse doMove equivalent inline (doMove is scoped inside bindDeleteHandler's closure)
                const dateKey = AppState.agendaDates[AppState.activeIdx];
                const arr = AppState.monthData[dateKey].songs;
                if (toIdx < 0 || toIdx >= arr.length) return;
                const [moved] = arr.splice(idx, 1);
                arr.splice(toIdx, 0, moved);
                // Remap danza indices
                const danza = AppState.monthData[dateKey].danza;
                if (danza && Array.isArray(danza.songs) && danza.songs.length) {
                    danza.songs = danza.songs.map(i => {
                        if (i === idx) return toIdx;
                        if (idx < toIdx && i > idx && i <= toIdx) return i - 1;
                        if (idx > toIdx && i >= toIdx && i < idx) return i + 1;
                        return i;
                    });
                }
                render();
                debouncedSave();
                return;
            }

            const delBtn = e.target.closest('[data-del-type]');
            if (delBtn) {
                e.stopPropagation();
                if (delBtn.dataset.confirming === '1') {
                    // Segundo clic: ejecutar
                    clearTimeout(parseInt(delBtn.dataset.confirmTimer || 0));
                    removeItem(delBtn.dataset.delType, parseInt(delBtn.dataset.delIdx));
                } else {
                    // Primer clic: pedir confirmación
                    // Resetear cualquier otro botón confirmando
                    document.querySelectorAll('[data-confirming="1"]').forEach(b => {
                        if (b !== delBtn) {
                            b.dataset.confirming = '0';
                            b.classList.remove('del-confirm');
                            b.innerHTML = XIcon;
                        }
                    });
                    delBtn.dataset.confirming = '1';
                    delBtn.classList.add('del-confirm');
                    delBtn.innerHTML = CheckIcon;
                    const t = setTimeout(() => {
                        if (delBtn.dataset.confirming === '1') {
                            delBtn.dataset.confirming = '0';
                            delBtn.classList.remove('del-confirm');
                            delBtn.innerHTML = XIcon;
                        }
                    }, 2500);
                    delBtn.dataset.confirmTimer = t;
                }
                return;
            }
            if (e.target.id === 'manualSaveBtn') {
                const btn = document.getElementById('manualSaveBtn');
                btn.disabled = true;
                btn.textContent = 'Guardando…';
                save().then(() => {
                    btn.textContent = '¡Guardado!';
                    btn.style.background = 'linear-gradient(135deg, #4ade80, #059669)';
                    setTimeout(() => {
                        btn.textContent = 'Guardar cambios';
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 2000);
                }).catch(() => {
                    btn.textContent = 'Error al guardar';
                    btn.style.background = 'linear-gradient(135deg, #f87171, #dc2626)';
                    setTimeout(() => {
                        btn.textContent = 'Guardar cambios';
                        btn.style.background = '';
                        btn.disabled = false;
                    }, 2000);
                });
            }
        });

        document.getElementById('contentArea').addEventListener('input', (e) => {
            const field = e.target.dataset.field;
            if (!field || field === 'musicians') return;
            const dateKey = AppState.agendaDates[AppState.activeIdx];
            if (field === 'notes') {
                AppState.monthData[dateKey].notes = e.target.value;
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
            } else {
                const idx = parseInt(e.target.dataset.idx);
                AppState.monthData[dateKey][field][idx] = e.target.value;
            }
            debouncedSave();
        });

        // Drag and drop songs
        const list = document.getElementById('list-songs');
        if (!list) return;
        // ── Drag & drop: mouse + touch ──
        let dragFrom = null;
        let touchClone = null;
        let touchOffsetX = 0, touchOffsetY = 0;

        function getItemAtY(y) {
            return Array.from(list.querySelectorAll('[draggable]')).find(el => {
                const r = el.getBoundingClientRect();
                return y >= r.top && y <= r.bottom;
            });
        }

        function doMove(fromIdx, toIdx) {
            if (fromIdx === toIdx || toIdx === null || toIdx === undefined) return;
            const dateKey = AppState.agendaDates[AppState.activeIdx];
            const arr = AppState.monthData[dateKey].songs;
            const [moved] = arr.splice(fromIdx, 1);
            arr.splice(toIdx, 0, moved);
            // Remap danza indices after reorder
            const danza = AppState.monthData[dateKey].danza;
            if (danza && Array.isArray(danza.songs) && danza.songs.length) {
                danza.songs = danza.songs.map(i => {
                    if (i === fromIdx) return toIdx;
                    if (fromIdx < toIdx && i > fromIdx && i <= toIdx) return i - 1;
                    if (fromIdx > toIdx && i >= toIdx && i < fromIdx) return i + 1;
                    return i;
                });
            }
            render();
            debouncedSave();
        }

        function clearDragStyles() {
            document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        }

        // Mouse events
        list.addEventListener('dragstart', (e) => {
            const item = e.target.closest('[draggable]');
            if (item) { dragFrom = parseInt(item.dataset.index); item.classList.add('dragging'); }
        });
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const item = e.target.closest('[draggable]');
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            if (item) item.classList.add('drag-over');
        });
        list.addEventListener('dragleave', (e) => {
            const item = e.target.closest('[draggable]');
            if (item) item.classList.remove('drag-over');
        });
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const item = e.target.closest('[draggable]');
            if (item && dragFrom !== null) doMove(dragFrom, parseInt(item.dataset.index));
        });
        list.addEventListener('dragend', () => { clearDragStyles(); dragFrom = null; });

        // Touch events
        list.addEventListener('touchstart', (e) => {
            const handle = e.target.closest('.drag-handle');
            if (!handle) return;
            const item = handle.closest('[draggable]');
            if (!item) return;
            dragFrom = parseInt(item.dataset.index);
            item.classList.add('dragging');
            const touch = e.touches[0];
            const rect = item.getBoundingClientRect();
            touchOffsetX = touch.clientX - rect.left;
            touchOffsetY = touch.clientY - rect.top;
            // Create floating clone
            touchClone = item.cloneNode(true);
            touchClone.style.cssText = `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;width:${rect.width}px;left:${rect.left}px;top:${rect.top}px;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);`;
            document.body.appendChild(touchClone);
            e.preventDefault();
        }, { passive: false });

        list.addEventListener('touchmove', (e) => {
            if (dragFrom === null || !touchClone) return;
            const touch = e.touches[0];
            touchClone.style.left = (touch.clientX - touchOffsetX) + 'px';
            touchClone.style.top  = (touch.clientY - touchOffsetY) + 'px';
            // Highlight target
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            const target = getItemAtY(touch.clientY);
            if (target && parseInt(target.dataset.index) !== dragFrom) target.classList.add('drag-over');
            e.preventDefault();
        }, { passive: false });

        list.addEventListener('touchend', (e) => {
            if (dragFrom === null) return;
            if (touchClone) { touchClone.remove(); touchClone = null; }
            const touch = e.changedTouches[0];
            const target = getItemAtY(touch.clientY);
            if (target) doMove(dragFrom, parseInt(target.dataset.index));
            clearDragStyles();
            dragFrom = null;
        });
    }

    const SONG_LIMIT = 12;
    function addItem(type) {
        const dateKey = AppState.agendaDates[AppState.activeIdx];
        if (type === 'songs' && AppState.monthData[dateKey].songs.length >= SONG_LIMIT) return;
        AppState.monthData[dateKey][type].push('');
        render();
        // Animate and focus last input
        const inputs = document.querySelectorAll(`[data-field="${type}"]`);
        if (inputs.length) {
            const lastInput = inputs[inputs.length - 1];
            const lastItem = lastInput.closest('.edit-item');
            if (lastItem) lastItem.classList.add('song-new');
            lastInput.focus();
        }
        // BUG 8 FIX: refresh danza song list when a song is added and danza is active
        if (type === 'songs') {
            const danza = AppState.monthData[dateKey].danza;
            const songsList = document.getElementById('danzaSongsList');
            if (danza && danza.active && songsList) {
                const songs = AppState.monthData[dateKey].songs;
                songsList.innerHTML = songs.length
                    ? `<p class="danza-hint">Seleccioná las canciones que acompañará:</p>` +
                      songs.map((s, i) => {
                          const isChecked = danza.songs.includes(i);
                          return `<label class="danza-song-row${isChecked ? ' selected' : ''}" data-song-idx="${i}">
                            <div class="check-box" style="${isChecked ? 'background:var(--accent-emerald);border-color:var(--accent-emerald)' : ''}">
                              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5" style="color:${isChecked ? '#0a0a0f' : 'transparent'}"><path d="M2 6l3 3 5-5"/></svg>
                            </div>
                            <span>${escapeHtml(s) || '—'}</span>
                          </label>`;
                      }).join('')
                    : `<p class="danza-hint">Primero agregá canciones en la sección de arriba.</p>`;
            }
        }
        debouncedSave();
    }

    function removeItem(type, index) {
        const dateKey = AppState.agendaDates[AppState.activeIdx];
        AppState.monthData[dateKey][type].splice(index, 1);
        // BUG 1 FIX: si se eliminó una canción, remap los índices de danza
        if (type === 'songs') {
            const danza = AppState.monthData[dateKey].danza;
            if (danza && Array.isArray(danza.songs)) {
                danza.songs = danza.songs
                    .filter(i => i !== index)          // quitar el eliminado
                    .map(i => i > index ? i - 1 : i);  // decrementar los posteriores
            }
        }
        render();
        debouncedSave();
    }

    let saveTimeout;
    function debouncedSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(save, 1500);
    }

    async function save() {
        if (AppState.isSaving || !AppState.user || !db) return Promise.resolve();

        AppState.isSaving = true;
        AppState.skipNextSnapshot++;
        setSyncStatus('saving', 'Guardando…');

        try {
            await saveMonth(
                db,
                AppState.appId,
                AppState.currentYear,
                AppState.currentMonth,
                AppState.monthData
            );
            setSyncStatus('saved', '¡Guardado!');
            document.getElementById('syncStatus').classList.add('saved');
            setTimeout(() => {
                setSyncStatus('online', 'Online');
                document.getElementById('syncStatus').classList.remove('saved');
            }, 2000);
        } catch (error) {
            console.error("Error al guardar la agenda:", error);
            AppState.skipNextSnapshot = Math.max(0, AppState.skipNextSnapshot - 1);
            setSyncStatus('error', 'Error al guardar');
        } finally {
            AppState.isSaving = false;
        }
    }

    const ICON_PENCIL = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>';
    const ICON_EYE    = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';

    function setToggleBtn(mode) {
        document.getElementById('toggleIcon').innerHTML = mode === 'view' ? ICON_PENCIL : ICON_EYE;
        document.getElementById('toggleLabel').textContent = mode === 'view' ? 'Editar' : 'Ver';
    }

    function toggleMode() {
        AppState.viewMode = AppState.viewMode === 'view' ? 'edit' : 'view';
        setToggleBtn(AppState.viewMode);
        render();
        // Show drag hint on first ever entry to edit mode
        if (AppState.viewMode === 'edit' && !AppState.dragHintShown) {
            AppState.dragHintShown = true;
            setTimeout(() => {
                document.querySelectorAll('.drag-handle').forEach((el, i) => {
                    setTimeout(() => {
                        el.classList.add('hint');
                        el.addEventListener('animationend', () => el.classList.remove('hint'), { once: true });
                    }, i * 120);
                });
            }, 350);
        }
    }

    function changeMonth() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
            void save();
        }

        AppState.currentMonth = Number(document.getElementById('monthSelect').value);
        AppState.agendaDates = getSundays(AppState.currentMonth, AppState.currentYear);
        AppState.activeIdx = 0;
        AppState.monthData = {};

        if (AppState.viewMode === 'edit') {
            AppState.viewMode = 'view';
            setToggleBtn('view');
        }
        setupRealtimeListener();
    }

    function changeYear() {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
            void save();
        }

        AppState.currentYear = Number(document.getElementById('yearSelect').value);
        AppState.agendaDates = getSundays(AppState.currentMonth, AppState.currentYear);
        AppState.activeIdx = 0;
        AppState.monthData = {};

        if (AppState.viewMode === 'edit') {
            AppState.viewMode = 'view';
            setToggleBtn('view');
        }

        updateTodayLabel();
        setupRealtimeListener();
    }

    function updateTodayLabel() {
        const hoy = new Date();
        document.getElementById('headerYear').textContent = `Agenda Musical ${getYear()}`;
        document.getElementById('todayLabel').textContent = "Hoy: " + hoy.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    async function exportImage() {
        // BUG 6 FIX: force view mode before export, restore after
        const wasEditing = AppState.viewMode === 'edit';
        if (wasEditing) {
            AppState.viewMode = 'view';
            setToggleBtn('view');
            render();
            // Small delay so DOM updates before capture
            await new Promise(r => setTimeout(r, 80));
        }
        const header = document.querySelector('.header');
        const nav = document.querySelector('.nav');
        const footer = document.querySelector('.footer');
        const els = [header, nav, footer];
        const hide = () => { els.forEach(el => el.style.display = 'none'); document.querySelectorAll('.no-export').forEach(el => el.style.display = 'none'); document.querySelectorAll('.no-export-if-empty').forEach(el => el.style.display = 'none'); };
        const show = () => { els.forEach(el => el.style.display = ''); document.querySelectorAll('.no-export').forEach(el => el.style.display = ''); document.querySelectorAll('.no-export-if-empty').forEach(el => el.style.display = ''); };

        // Datos de la fecha actual
        const dateKey = AppState.agendaDates[AppState.activeIdx];
        const d = new Date(dateKey + 'T12:00:00');
        const dayNum = d.getDate();
        const monthLabel = monthNames[AppState.currentMonth];

        // Logo del footer
        const logoImg = document.querySelector('.footer img');
        const logoSrc = logoImg ? logoImg.src : '';

        // Build a beautiful export header with big date hero
        const exportHeader = document.createElement('div');
        exportHeader.id = 'exportHeader';
        exportHeader.style.cssText = 'font-family:DM Sans,sans-serif;';
        exportHeader.innerHTML = `
            <!-- Top bar: brand + logo -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 28px;background:#1a2035;border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex;align-items:center;gap:12px;">
                    <div style="width:38px;height:38px;background:linear-gradient(135deg,#22d3ee,#a78bfa);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    </div>
                    <div>
                        <div style="font-family:'Instrument Serif',serif;font-size:18px;font-style:italic;color:#f8fafc;line-height:1;">Agenda Musical</div>
                        <div style="font-size:10px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#22d3ee;margin-top:3px;">IEBLA ${getYear()}</div>
                    </div>
                </div>
                ${logoSrc ? `<div style="background:rgba(255,255,255,0.92);border-radius:10px;padding:5px 10px;"><img src="${logoSrc}" style="height:26px;width:auto;display:block;"></div>` : ''}
            </div>
            <!-- Hero: fecha grande centrada -->
            <div style="text-align:center;padding:36px 28px 28px;background:linear-gradient(180deg,#141928 0%,#0e1220 100%);border-bottom:1px solid rgba(255,255,255,0.08);">
                <div style="font-family:'Instrument Serif',serif;font-size:110px;font-weight:400;font-style:italic;line-height:1.1;padding-top:8px;background:linear-gradient(135deg,#22d3ee,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">${dayNum}</div>
                <div style="font-size:13px;font-weight:700;letter-spacing:0.35em;text-transform:uppercase;color:#cbd5e1;margin-top:8px;">${monthLabel} ${getYear()}</div>
                <div style="display:inline-block;margin-top:12px;padding:5px 16px;border-radius:20px;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.3);font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#22d3ee;">Domingo</div>
            </div>
        `;

        // Feedback visual: spinner en el botón
        const exportBtn = document.getElementById('exportBtn');
        const camIcon = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
        const spinIcon = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>';
        exportBtn.innerHTML = spinIcon;
        exportBtn.disabled = true;

        try {
            if (!window.html2canvas) {
                await new Promise((res, rej) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                    s.onload = res; s.onerror = rej;
                    document.head.appendChild(s);
                });
            }
            hide();
            const content = document.getElementById('contentArea');
            content.prepend(exportHeader);
            // Measure real content height after prepend (fixes mobile clipping)
            const realHeight = content.offsetHeight;
            const realWidth = content.offsetWidth;
            const canvas = await window.html2canvas(content, {
                scale: 2, useCORS: true,
                backgroundColor: '#0e1220',
                width: realWidth,
                height: realHeight
            });
            exportHeader.remove();
            const link = document.createElement('a');
            link.download = `IEBLA-${dayNum}-${monthNames[AppState.currentMonth].substring(0,3)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (error) {
            console.error(error);
            alert('Error generando imagen. Verificá tu conexión e intentá de nuevo.');
        } finally {
            if (document.getElementById('exportHeader')) exportHeader.remove();
            show();
            exportBtn.innerHTML = camIcon;
            exportBtn.disabled = false;
        }
    }

    init();

