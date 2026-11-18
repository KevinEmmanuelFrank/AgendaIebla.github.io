# Agenda IEBLA — versión modular

Esta carpeta contiene la segunda versión de Agenda Musical IEBLA. La página está pensada para publicarse bajo `/Home/`, mientras que el `index.html` de la raíz permanece intacto.

## Estructura

- `index.html`: estructura de la página.
- `styles.css`: estilos de la interfaz.
- `src/main.js`: inicialización y coordinación de la aplicación.
- `src/state.js`: estado y configuración de músicos.
- `src/calendar.js`: cálculo de domingos y fechas locales.
- `src/firebase.js`: inicialización de Firebase Authentication y Firestore.
- `src/agendaRepository.js`: lectura y escritura de agendas en Firestore.
- `src/ui/render.js`: representación de la agenda.

## Datos y compatibilidad

La nueva versión conserva el identificador `agenda-musical-iebla-v21` y la misma ruta de documentos de Firestore que utiliza la agenda existente:

`artifacts/agenda-musical-iebla-v21/public/data/months/{año-mes}`

Por eso lee y escribe los documentos actuales; no crea una base paralela ni transforma los datos. El selector permite consultar los años anteriores y próximos. La selección del año forma parte del estado y se utiliza tanto para leer como para guardar.

## Frontend y backend

GitHub Pages sirve los archivos estáticos del frontend. Firebase Authentication y Cloud Firestore siguen siendo el backend administrado. El acceso a los datos quedó aislado en `src/agendaRepository.js`, en lugar de mezclar llamadas a Firestore con el código de pantalla.

No se modifican las reglas ni la estructura de datos del proyecto Firebase.

## Publicación y prueba

La carpeta se sirve en la ruta `/Home/` del mismo sitio. La aplicación carga módulos ES directamente desde el navegador y no necesita un paso de compilación.

Antes de convertirla en la versión principal, comprobar inicio de sesión anónimo, lectura, guardado, edición, exportación y navegación entre años en el sitio publicado.


## Fechas especiales y temas visuales

Las fechas especiales se guardan como entradas adicionales en el documento del mes, usando la misma clave ISO `YYYY-MM-DD` y la estructura de agenda habitual. Cada entrada incluye los metadatos `isSpecialDate`, `specialTitle` y `visualTheme`; estos campos no afectan a las entradas dominicales existentes.

La navegación mensual combina los domingos habituales con las fechas especiales. Cada fecha mantiene su propio equipo, repertorio, notas y tema visual. Los temas iniciales son Clásico, Navidad, Semana Santa/Pascua, Pentecostés y Aniversario.
