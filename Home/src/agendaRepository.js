import { doc, onSnapshot, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Repositorio de persistencia.
 * Mantiene la misma ruta y el mismo formato de documentos que la agenda actual.
 */
function monthDocument(db, appId, year, month) {
    const monthKey = `${year}-${month}`;
    return doc(db, "artifacts", appId, "public", "data", "months", monthKey);
}

export function subscribeToMonth(db, appId, year, month, onData, onError) {
    const reference = monthDocument(db, appId, year, month);

    return onSnapshot(
        reference,
        snapshot => onData(snapshot.exists() ? snapshot.data() : {}),
        onError
    );
}

export function saveMonth(db, appId, year, month, data) {
    const reference = monthDocument(db, appId, year, month);
    return setDoc(reference, data);
}


/**
 * Crea una fecha especial sin reemplazar el resto del documento mensual.
 * La transacción evita pisar una entrada que ya exista para esa fecha.
 */
export async function createSpecialDate(db, appId, dateKey, dateData) {
    const [year, month] = dateKey.split("-").map(Number);
    const reference = monthDocument(db, appId, year, month - 1);

    return runTransaction(db, async transaction => {
        const snapshot = await transaction.get(reference);
        const currentMonth = snapshot.exists() ? snapshot.data() : {};

        if (Object.prototype.hasOwnProperty.call(currentMonth, dateKey)) {
            throw new Error("Ya existe información guardada para esa fecha.");
        }

        transaction.set(reference, { [dateKey]: dateData }, { merge: true });
    });
}
