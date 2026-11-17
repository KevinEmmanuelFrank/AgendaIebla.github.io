import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
