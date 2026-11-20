/**
 * Estado compartido de Agenda IEBLA.
 * El identificador y el esquema de Firestore se mantienen compatibles con la versión original.
 */
export const AppState = {
        dragHintShown: false,
        viewMode: 'view',
        editorScreen: 'edit',
        calendarDisplay: 'agenda',
        pendingDateKey: null,
        currentYear: new Date().getFullYear(),
        currentMonth: new Date().getMonth(),
        activeIdx: 0,
        monthData: {},
        agendaDates: [],
        unsubscribe: null,
        isSaving: false,
        skipNextSnapshot: 0,  // counter: skip N incoming snapshots
        appId: typeof __app_id !== 'undefined' ? __app_id : 'agenda-musical-iebla-v21',
        user: null,
        musiciansConfig: [
            { name: "Kevin",    roles: ["dirección", "voz apoyo", "guitarra", "bajo", "teclado", "batería", "sonido", "proyección (mañana)", "proyección (noche)"] },
            { name: "Norma",    roles: ["dirección", "voz apoyo"] },
            { name: "Nataly",   roles: ["dirección", "voz apoyo"] },
            { name: "Gabriel",  roles: ["batería"] },
            { name: "Anderson", roles: ["batería", "proyección (mañana)", "proyección (noche)"] },
            { name: "David",    roles: ["bajo"] },
            { name: "Lore",     roles: ["teclado", "bajo", "G. Eléctrica"] },
            { name: "Magali",   roles: ["teclado"] },
            { name: "Thiago",   roles: ["teclado"] },
            { name: "Pame",     roles: ["proyección (mañana)", "proyección (noche)", "batería"] },
            { name: "Nico",     roles: ["proyección (mañana)", "proyección (noche)"] },
            { name: "Sonia",    roles: ["proyección (mañana)", "proyección (noche)"] },
            { name: "Mar",      roles: ["proyección (mañana)", "proyección (noche)"] },
            { name: "Vicky",    roles: ["proyección (mañana)", "proyección (noche)"] },
            { name: "Emma",     roles: ["guitarra", "bajo"] },
            { name: "Pedro",    roles: ["sonido"] },
            { name: "Cristian", roles: ["sonido"] },
            { name: "Nestor",   roles: ["sonido"] },
            { name: "Ari",      roles: ["voz apoyo"] },
            { name: "Fernando", roles: ["voz apoyo", "dirección"] },
            { name: "Meli",     roles: ["voz apoyo", "dirección"] },
            { name: "Dulci",    roles: ["proyección", "voz de apoyo", "teclado"] },
            { name: "Iara",     roles: ["voz apoyo"] }
        ]
    };
