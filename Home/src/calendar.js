/**
 * Funciones puras para la navegación del calendario.
 * Las fechas se serializan usando el calendario local del dispositivo.
 */
export const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export function getLocalISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function getSundays(month, year) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
        throw new TypeError("El año o mes de la agenda no es válido.");
    }

    const date = new Date(year, month, 1);
    const sundays = [];

    while (date.getMonth() === month) {
        if (date.getDay() === 0) sundays.push(getLocalISODate(date));
        date.setDate(date.getDate() + 1);
    }

    return sundays;
}
