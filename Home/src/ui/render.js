import { AppState } from "../state.js";
import { monthNames, getSundays, getLocalISODate } from "../calendar.js";

export function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatNotes(text) {
        return escapeHtml(text);
    }

    const THEME_OPTIONS = [
        { value: 'clasico', label: 'Clásico (original)' },
        { value: 'navidad', label: 'Navidad' },
        { value: 'pascua', label: 'Semana Santa / Pascua' },
        { value: 'pentecostes', label: 'Pentecostés' },
        { value: 'aniversario', label: 'Aniversario' }
    ];
    const VALID_THEMES = new Set(THEME_OPTIONS.map(option => option.value));

    function normalizeTheme(theme) {
        return VALID_THEMES.has(theme) ? theme : 'clasico';
    }

    function formatWeekday(dateKey) {
        const value = new Date(dateKey + 'T12:00:00')
            .toLocaleDateString('es-AR', { weekday: 'long' });
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    export function renderContent() {
        const dateKey = AppState.agendaDates[AppState.activeIdx];
        if (!dateKey) return;
        ensureData(dateKey);
        const data = AppState.monthData[dateKey];
        applyPageTheme(data);
        const d = new Date(dateKey + "T12:00:00");
        const dayNum = d.getDate();
        const monthLabel = monthNames[AppState.currentMonth];
        const weekday = formatWeekday(dateKey);

        const today = new Date(); today.setHours(0,0,0,0);
        const todayISO = getLocalISODate(today);
        const selectedDate = new Date(dateKey + "T00:00:00");
        let badge = null;
        if (data.isSpecialDate === true) {
            badge = 'special';
        } else if (selectedDate < today) {
            badge = 'past';
        } else if (AppState.currentYear === today.getFullYear()) {
            let nextSundayGlobal = null;
            for (let m = 0; m < 12; m++) {
                const found = getSundays(m, AppState.currentYear).find(s => s >= todayISO);
                if (found) { nextSundayGlobal = found; break; }
            }
            if (nextSundayGlobal && dateKey === nextSundayGlobal) badge = 'next';
        }

        document.getElementById('exportBtn').classList.toggle('hidden', AppState.viewMode !== 'view');

        document.getElementById('contentArea').innerHTML =
            AppState.viewMode === 'view'
                ? renderView(data, dayNum, monthLabel, badge, dateKey, weekday)
                : AppState.editorScreen === 'advanced'
                    ? renderAdvanced(data, dateKey, dayNum, monthLabel, weekday)
                    : renderEdit(data, dayNum, monthLabel, badge, dateKey, weekday);

        document.getElementById('prevSunday').disabled = AppState.activeIdx === 0;
        document.getElementById('nextSunday').disabled = AppState.activeIdx === AppState.agendaDates.length - 1;
    }

    export function ensureData(dateKey) {
        const d = AppState.monthData[dateKey];
        if (!d || typeof d !== 'object') {
            AppState.monthData[dateKey] = { musicians: [], songs: [], notes: '', danza: { active: false, songs: [] } };
            return;
        }
        if (!Array.isArray(d.musicians)) d.musicians = [];
        if (!Array.isArray(d.songs))    d.songs = [];
        if (typeof d.notes !== 'string') d.notes = '';
        // BUG C FIX: always ensure danza exists even on partial/legacy objects from Firestore
        if (typeof d.danza !== 'object' || d.danza === null) d.danza = { active: false, songs: [] };
        if (typeof d.danza.active !== 'boolean') d.danza.active = false;
        if (!Array.isArray(d.danza.songs)) d.danza.songs = [];
        d.musicians = d.musicians.map(m => {
            if (typeof m === 'string') {
                // Parse "Kevin (guitarra)" → {name:"Kevin", roles:["guitarra"]}
                const match = m.match(/^(.+?)\s*\((.+)\)$/);
                if (match) return { name: match[1].trim(), roles: match[2].split('/').map(r => r.trim()) };
                return { name: m, roles: [] };
            }
            if (typeof m === 'object' && m.name) {
                if (!Array.isArray(m.roles)) m.roles = [];
                return m;
            }
            return null;
        }).filter(Boolean);
        d.songs = d.songs.map(s => (typeof s === 'string' ? s : ''));
    }

    // Helper: get display label for a musician object
    function musicianLabel(m) {
        if (!m || !m.name) return '';
        const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
        if (!m.roles || m.roles.length === 0) return `<span class="tag-name">${m.name}</span>`;
        return `<span class="tag-name">${m.name}</span><span class="tag-roles">${m.roles.map(cap).join(' / ')}</span>`;
    }

    function renderView(data, dayNum, monthLabel, badge, dateKey, weekday) {
        const musiciansHTML = data.musicians.map(m => `<span class="tag">${musicianLabel(m)}</span>`).join('');

        const danzaActive = data.danza && data.danza.active;
        const danzaSongs = danzaActive && data.danza.songs ? data.danza.songs : [];
        const songsHTML = data.songs.length
            ? data.songs.map((s, i) => {
                const hasDanza = danzaSongs.includes(i);
                return `<div class="song-item">
                    <span class="song-num">${i + 1}</span>
                    <span class="song-divider"></span>
                    <span class="song-name">${escapeHtml(s) || '—'}</span>
                    ${hasDanza ? `<span class="danza-icon" title="Acompañada por Worshipers"><span class="dot dot-emerald" style="width:8px;height:8px;flex-shrink:0;"></span></span>` : ''}
                </div>`;
            }).join('')
            : `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span class="empty-label">Sin canciones</span>
                <span class="empty-hint">Agregá canciones en modo edición</span>
            </div>`;
        const danzaBanner = danzaActive ? `<div class="danza-banner"><span class="dot dot-emerald" style="width:8px;height:8px;flex-shrink:0;"></span>Worshipers estará presente en esta fecha</div>` : '';

        const notesHTML = data.notes
            ? `<div class="notes-text">${formatNotes(data.notes)}</div>`
            : `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span class="empty-label">Sin notas</span>
                <span class="empty-hint">Agregá notas en modo edición</span>
            </div>`;

        const pastClass = badge === 'past' ? ' view-past' : '';
        const theme = normalizeTheme(data.visualTheme);
        const eventTitle = typeof data.specialTitle === 'string' ? data.specialTitle.trim() : '';
        return `<div class="agenda-theme theme-${theme} fade-in${pastClass}">
            <div class="view-date-hero no-export">
                <div class="view-day-num">${dayNum}</div>
                <div class="view-weekday-label">${weekday}</div>
                <div class="view-month-label">${monthLabel} ${AppState.currentYear}</div>
                ${eventTitle ? `<div class="special-event-title">${escapeHtml(eventTitle)}</div>` : ''}
                ${badge === 'special' ? '<div class="date-badge special no-export"><span class="badge-dot"></span>Fecha especial</div>' : badge === 'next' ? '<div class="date-badge next no-export"><span class="badge-dot"></span>Próximo</div>' : badge === 'past' ? '<div class="date-badge past no-export"><span class="badge-dot"></span>Pasado</div>' : ''}
                <div class="view-date-rule"></div>
            </div>
            <div class="card card-cyan">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-cyan"></div><span>Equipo Musical</span></div>
                </div>
                ${data.musicians.length ? `<div class="tags-wrap">${musiciansHTML}</div>` : `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span class="empty-label">Sin asignar</span>
                <span class="empty-hint">Seleccioná músicos en modo edición</span>
            </div>`}
            </div>
            <div class="card card-purple">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-purple"></div><span>Canciones</span></div>
                </div>
                ${songsHTML}
                ${danzaBanner}
            </div>
            ${data.notes ? `<div class="card card-amber" style="margin-bottom:0">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-amber"></div><span>Notas</span></div>
                </div>
                ${notesHTML}
            </div>` : `<div class="card card-amber no-export-if-empty" style="margin-bottom:0">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-amber"></div><span>Notas</span></div>
                </div>
                ${notesHTML}
            </div>`}
        </div>`;
    }


    const PAGE_THEMES = ['navidad', 'pascua', 'pentecostes', 'aniversario'];

    function themeParticleMarkup(theme, enabled = true) {
        if (!enabled || theme === 'clasico') return '';
        const particles = {
            navidad: ['❄', '✧', '❅', '❄', '✦', '❅', '❄'],
            pascua: ['✧', '·', '✦', '✧', '·', '✦'],
            pentecostes: ['✦', '🔥', '✧', '🔥', '✦', '🔥'],
            aniversario: ['✦', '✧', '✦', '·', '✧', '✦']
        }[theme] || [];

        return particles.map((particle, index) =>
            `<span class="theme-particle particle-${index + 1}">${particle}</span>`
        ).join('');
    }

    export function applyPageTheme(data = {}) {
        const theme = normalizeTheme(data.visualTheme);
        document.body.classList.remove(...PAGE_THEMES.map(name => `theme-${name}`));
        if (theme !== 'clasico') document.body.classList.add(`theme-${theme}`);

        const effects = document.getElementById('themeEffects');
        if (effects) {
            effects.className = `theme-effects theme-effects-${theme}`;
            effects.innerHTML = themeParticleMarkup(theme, data.visualEffects !== false);
        }
    }

    export function renderFullPagePreview(data, dateKey) {
        const date = new Date(dateKey + 'T12:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dateKey + 'T00:00:00');
        const badge = data.isSpecialDate === true
            ? 'special'
            : selectedDate < today ? 'past' : null;
        const theme = normalizeTheme(data.visualTheme);
        const monthLabel = monthNames[date.getMonth()];
        const weekday = formatWeekday(dateKey);
        const effectsEnabled = data.visualEffects !== false;

        return `<div class="page-preview-shell theme-${theme}">
            <div class="theme-effects theme-effects-${theme}" aria-hidden="true">${themeParticleMarkup(theme, effectsEnabled)}</div>
            <header class="header preview-header">
                <div class="brand">
                    <div class="brand-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                        </svg>
                    </div>
                    <div class="brand-text">
                        <h1>IEBLA</h1>
                        <p>Agenda Musical ${date.getFullYear()}</p>
                    </div>
                </div>
                <div class="header-controls">
                    <select disabled aria-label="Vista previa del año"><option>${date.getFullYear()}</option></select>
                    <select disabled aria-label="Vista previa del mes"><option>${monthLabel}</option></select>
                    <button class="btn btn-primary" type="button" disabled>Ver</button>
                </div>
            </header>
            <nav class="nav preview-nav" aria-hidden="true">
                <button class="nav-btn" type="button" disabled><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg></button>
                <div class="nav-center">
                    <div class="sync-badge"><div class="sync-dot online"></div><span>Online</span></div>
                </div>
                <button class="nav-btn" type="button" disabled><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg></button>
            </nav>
            <main class="main preview-main">
                ${renderView(data, date.getDate(), monthLabel, badge, dateKey, weekday)}
            </main>
            <footer class="footer preview-footer">
                <div class="preview-footer-logo">IEBLA</div>
                <span class="footer-date">Agenda Musical · ${date.getFullYear()}</span>
                <span class="footer-drive-btn">Drive</span>
            </footer>
        </div>`;
    }

    export function renderDatePreview(data, dateKey) {
        const date = new Date(dateKey + "T12:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = new Date(dateKey + "T00:00:00");
        const badge = data.isSpecialDate === true
            ? 'special'
            : selectedDate < today ? 'past' : null;

        return renderView(
            data,
            date.getDate(),
            monthNames[date.getMonth()],
            badge,
            dateKey,
            formatWeekday(dateKey)
        );
    }

    function renderEdit(data, dayNum, monthLabel, badge, dateKey, weekday) {
        // Musicians — flat list
        const musicianRows = AppState.musiciansConfig.map(cfg => {
            const existing = data.musicians.find(m => m.name === cfg.name);
            const isSelected = !!existing;
            const selectedRoles = existing ? existing.roles : [];
            const hasMultipleRoles = cfg.roles.length > 1;
            const roleChips = hasMultipleRoles ? cfg.roles.map(role => {
                const active = selectedRoles.includes(role) ? 'role-active' : '';
                return `<span class="role-chip ${active}" data-musician="${cfg.name}" data-role="${role}">${role}</span>`;
            }).join('') : '';
            return `<div class="musician-row ${isSelected ? 'selected' : ''}" data-musician="${cfg.name}">
                <div class="musician-main">
                    <div class="check-box">
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 6l3 3 5-5"/></svg>
                    </div>
                    <span class="musician-name">${cfg.name}</span>
                    ${hasMultipleRoles ? '' : `<span class="musician-single-role">${cfg.roles[0]}</span>`}
                </div>
                ${hasMultipleRoles && isSelected ? `<div class="role-chips">${roleChips}</div>` : ''}
                ${hasMultipleRoles && !isSelected ? `<div class="role-chips role-chips-hidden">${roleChips}</div>` : ''}
            </div>`;
        }).join('');

        const songsRows = data.songs.map((s, i) => `
            <div class="edit-item" draggable="true" data-index="${i}">
                <span class="drag-handle desktop-only">⠿</span>
                <div class="move-btns touch-only">
                    <button class="move-btn" data-move-dir="up" data-move-idx="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    <button class="move-btn" data-move-dir="down" data-move-idx="${i}" ${i === data.songs.length - 1 ? 'disabled' : ''} aria-label="Bajar">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                </div>
                <span class="edit-song-num">${i + 1}</span>
                <input type="text" class="edit-input" value="${escapeHtml(s)}" data-idx="${i}" data-field="songs" placeholder="Ej: Cuán grande es Él">
                <button class="del-btn" data-del-type="songs" data-del-idx="${i}">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>`).join('');

        return `<div class="fade-in">
            <!-- FECHA -->
            <div style="text-align:center; margin-bottom:24px;">
                <div class="edit-date-num" style="font-family:'Instrument Serif',serif; font-size:88px; font-weight:400; font-style:italic; line-height:1; background:linear-gradient(135deg,var(--accent-cyan),var(--accent-purple)); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">${dayNum}</div>
                <div style="font-size:11px; font-weight:700; letter-spacing:0.35em; text-transform:uppercase; color:var(--text-secondary); margin-top:4px;">${weekday} · ${monthLabel} ${AppState.currentYear}</div>
                ${data.specialTitle ? `<div class="special-event-title edit-special-title">${escapeHtml(data.specialTitle)}</div>` : ''}
                ${data.isSpecialDate ? '<div class="date-badge special"><span class="badge-dot"></span>Fecha especial</div>' : badge === 'next' ? '<div class="date-badge next no-export"><span class="badge-dot"></span>Próximo</div>' : badge === 'past' ? '<div class="date-badge past no-export"><span class="badge-dot"></span>Pasado</div>' : ''}
            </div>
            <!-- MÚSICOS -->
            <div class="card card-cyan" style="margin-bottom:16px">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-cyan"></div><span>Equipo Musical</span></div>
                </div>
                <div id="musiciansToggleBtn" class="musicians-toggle-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Seleccionar músicos
                </div>
                <div class="musicians-grid-wrap" id="musiciansGridWrap">
                    <div class="musicians-grid" id="musiciansGrid">${musicianRows}</div>
                </div>
            </div>

            <!-- CANCIONES -->
            <div class="card card-purple" style="margin-bottom:16px">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-purple"></div><span>Canciones</span></div>
                    <button class="add-btn" id="add-songs" ${data.songs.length >= 12 ? 'disabled title="Máximo 12 canciones"' : ''}>+</button>
                </div>
                <div class="edit-list" id="list-songs" data-type="songs">
                    ${songsRows || `<div class="songs-empty-edit">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        <span>Tocá <strong>+</strong> para agregar una canción</span>
                    </div>`}
                </div>
            </div>

            <!-- DANZA -->
            <div class="card card-emerald" style="margin-bottom:16px" id="danzaCard">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-emerald"></div><span>Worshipers</span></div>
                    <label class="danza-toggle" id="danzaToggle">
                        <input type="checkbox" id="danzaCheck" ${data.danza && data.danza.active ? 'checked' : ''}>
                        <span class="danza-toggle-track"><span class="danza-toggle-thumb"></span></span>
                        <span class="danza-toggle-label">${data.danza && data.danza.active ? 'Presente' : 'No presente'}</span>
                    </label>
                </div>
                <p class="danza-section-desc">¿El equipo de Worshipers acompañará esta fecha?</p>
                ${data.danza && data.danza.active ? `
                <div class="danza-songs-list" id="danzaSongsList">
                    ${data.songs.length ? `<p class="danza-hint">Seleccioná las canciones que acompañará:</p>
                    ${data.songs.map((s, i) => {
                        const checked = data.danza.songs && data.danza.songs.includes(i);
                        return `<label class="danza-song-row ${checked ? 'selected' : ''}" data-song-idx="${i}">
                            <div class="check-box"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M2 6l3 3 5-5"/></svg></div>
                            <span>${s || '—'}</span>
                        </label>`;
                    }).join('')}` : '<p class="danza-hint">Primero agregá canciones en la sección de arriba.</p>'}
                </div>` : ''}
            </div>

            <!-- NOTAS -->
            <div class="card card-amber" style="margin-bottom:0; padding-bottom:16px;">
                <div class="card-header" style="margin-bottom:0;">
                    <div class="card-title"><div class="dot dot-amber"></div><span>Notas</span></div>
                </div>
                <textarea class="notes-textarea" data-field="notes" data-idx="0"
                    placeholder="Escribí las anotaciones para esta fecha…">${data.notes || ''}</textarea>
            </div>

            <div class="save-row">
                <button class="btn-save" id="manualSaveBtn">Guardar cambios</button>
                <span class="save-hint" style="display:flex;align-items:center;gap:6px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.7"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>Guardado automático activo</span>
            </div>
            <div class="advanced-trigger-row">
                <button class="btn-advanced" id="advancedChangesBtn" type="button">
                    <span class="btn-advanced-icon">✦</span>
                    Cambios avanzados
                    <span class="btn-advanced-arrow">→</span>
                </button>
            </div>
        </div>`;
    }

    


    function renderAdvanced(data, dateKey, dayNum, monthLabel, weekday) {
        const currentTheme = normalizeTheme(data.visualTheme);
        const optionsHTML = THEME_OPTIONS.map(option =>
            `<option value="${option.value}" ${option.value === currentTheme ? 'selected' : ''}>${option.label}</option>`
        ).join('');
        const title = typeof data.specialTitle === 'string' ? data.specialTitle : '';
        const effectsEnabled = data.visualEffects !== false;

        const copySources = AppState.agendaDates
            .filter(key => key !== dateKey && AppState.monthData[key] && typeof AppState.monthData[key] === 'object');
        const copyOptionsHTML = copySources.map(key => {
            const sourceDate = new Date(key + 'T12:00:00');
            const sourceData = AppState.monthData[key];
            const sourceTitle = typeof sourceData.specialTitle === 'string' && sourceData.specialTitle.trim()
                ? sourceData.specialTitle.trim()
                : 'Agenda';
            const sourceTheme = normalizeTheme(sourceData.visualTheme);
            const dateLabel = `${formatWeekday(key)} ${sourceDate.getDate()} de ${monthNames[sourceDate.getMonth()]}`;
            return `<option value="${key}">${escapeHtml(dateLabel)} · ${escapeHtml(sourceTitle)} · ${escapeHtml(sourceTheme)}</option>`;
        }).join('');

        return `<div class="fade-in advanced-screen">
            <div class="advanced-heading">
                <button class="btn-back" id="backToEditBtn" type="button">← Volver a la edición</button>
                <div class="advanced-eyebrow">Herramientas especiales</div>
                <h2>Cambios avanzados</h2>
                <p>${weekday} ${dayNum} de ${monthLabel} de ${AppState.currentYear}</p>
            </div>

            <section class="card advanced-card">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-purple"></div><span>Presentación de esta fecha</span></div>
                </div>
                <p class="advanced-description">La estructura de la agenda permanece igual. Personalizá los colores y pequeños detalles de esta celebración.</p>
                <label class="advanced-field">
                    <span>Nombre o título de la celebración</span>
                    <input id="specialTitleInput" type="text" maxlength="70" value="${escapeHtml(title)}" placeholder="Ej. Navidad, Domingo de Resurrección…">
                </label>
                <label class="advanced-field">
                    <span>Tema general de la página</span>
                    <select id="visualThemeSelect">${optionsHTML}</select>
                </label>
                <label class="advanced-effects-toggle">
                    <input id="visualEffectsCheck" type="checkbox" ${effectsEnabled ? 'checked' : ''}>
                    <span class="advanced-effects-switch" aria-hidden="true"></span>
                    <span>Mostrar detalles decorativos sutiles</span>
                </label>

                <div class="advanced-theme-tools">
                    <label class="advanced-field">
                        <span>Copiar tema de otra fecha de este mes</span>
                        <select id="copyThemeFromDate" ${copySources.length ? '' : 'disabled'}>
                            <option value="">Elegí una fecha</option>
                            ${copyOptionsHTML}
                        </select>
                    </label>
                    <button class="btn-tool-secondary" id="copyThemeBtn" type="button" ${copySources.length ? '' : 'disabled'}>Copiar tema seleccionado</button>
                    <button class="btn-tool-quiet" id="resetThemeBtn" type="button">Restablecer tema clásico</button>
                </div>

                <button class="btn-save advanced-save-btn" id="saveAdvancedBtn" type="button">Guardar ajustes visuales</button>
                <button class="btn-preview" id="previewAdvancedBtn" type="button">◉ Ver vista previa de toda la página</button>
                <div class="advanced-preview-panel" id="advancedPreviewPanel" hidden>
                    <div class="advanced-preview-caption">
                        <strong>Vista previa completa</strong>
                        <span>Incluye encabezado, controles, navegación, agenda y pie de página. No se guarda hasta confirmar.</span>
                    </div>
                    <div id="advancedPreviewContent"></div>
                </div>
                <div class="advanced-feedback" id="specialDateFeedback" aria-live="polite"></div>
            </section>

            <section class="card advanced-card special-date-card">
                <div class="card-header">
                    <div class="card-title"><div class="dot dot-cyan"></div><span>Agregar fecha especial</span></div>
                </div>
                <p class="advanced-description">Agregá una fecha fuera de los domingos habituales, por ejemplo un sábado. Aparecerá en la navegación de ese mes y tendrá su propia agenda.</p>
                <label class="advanced-field">
                    <span>Fecha</span>
                    <input id="newSpecialDateInput" type="date">
                </label>
                <label class="advanced-field">
                    <span>Nombre de la fecha</span>
                    <input id="newSpecialTitleInput" type="text" maxlength="70" placeholder="Ej. Sábado de preparación, Encuentro especial…">
                </label>
                <label class="advanced-field">
                    <span>Diseño visual</span>
                    <select id="newSpecialThemeSelect">
                        <option value="clasico">Clásico (original)</option>
                        <option value="navidad">Navidad</option>
                        <option value="pascua">Semana Santa / Pascua</option>
                        <option value="pentecostes">Pentecostés</option>
                        <option value="aniversario">Aniversario</option>
                    </select>
                </label>
                <button class="btn-special-date" id="addSpecialDateBtn" type="button">＋ Agregar fecha especial</button>
                <p class="advanced-footnote">Cada fecha conserva su propio equipo, repertorio, notas y diseño.</p>
            </section>
        </div>`;
    }
