# Qué contiene esta referencia y qué no debes copiar a producción

## Estado del trabajo

Este paquete es una exportación del laboratorio de diseño, no una Pull Request ni un parche sobre GitHub. La exportación no ejecuta `git`, no modifica tu repositorio y no conecta con tu SQLite de producción.

`referencia-ui/` conserva las pantallas del laboratorio para que puedas trasladar sus componentes al repo real. No es una aplicación Vite autónoma lista para ejecutar ni incluye el backend original de Money_v2.

`ejemplos-tailwind3/` contiene ejemplos parciales de configuración, clases y Card para iniciar la adaptación a Tailwind 3. No reproduce por sí solo todos los shells, KPIs, tablas, popups, mapas y gráficos. Fusiónalos con tus archivos; no reemplaces los de tu repo sin revisar.

`seleccion/tokens.css` incluye los tokens de la mezcla elegida para claro y oscuro. `seleccion/paleta.json` y `seleccion/configuracion.json` permiten reconstruir esa elección. La selección incluye solo la paleta activa, no todas las paletas personalizadas de la base de datos del laboratorio.

## Qué puedes reutilizar como base de interfaz

- Catálogo de iconos, colores de datos fijos y utilidades de formato.
- Componentes SVG de gráficos y hover/touch.
- Mapas SVG generados y registro ISO de países/regiones.
- Selector de fecha con portal, posicionamiento y scroll, adaptando las referencias tipadas si usas React 18.
- Selectores de periodos, una vez que dejen de usar los límites fijos de la demo.
- Shells, tarjetas, KPIs, paletas, selector de estructura y formularios como ejemplos de presentación.

## Qué requiere conexión y adaptación

- `state.tsx` usa arrays de muestra en React. Sustituye las operaciones locales por los métodos de `src/lib/api.ts` de Money_v2.
- `series.ts`, `expandSeries` y las series de `views-main.tsx` están anclados a datos de muestra y a una fecha fija. No los utilices como histórico financiero real.
- El botón «Actualizar precios» de la demo modifica precios al azar. En producción debe llamar al actualizador de tu backend y mostrar sus resultados/errores.
- Ganancias, FIFO, coste de ventas, XIRR y divisas deben seguir calculándose en tu servidor. Algunas métricas del laboratorio son constantes o aproximaciones visuales.
- Países, sectores y top empresas son datos de demostración. Carga tus desgloses reales y conserva una etiqueta de datos faltantes cuando corresponda.
- Los gráficos personalizados de la demo están en memoria. En el proyecto real, usa la API de widgets para persistirlos.
- Los componentes de paletas llaman a las API del laboratorio. En Express, usa tus ajustes/servicios existentes y valida el JSON.
- La hoja `src/app/globals.css` es una referencia de Tailwind 4; la cabecera y ciertas utilidades deben adaptarse a Tailwind 3.
- Los componentes de `src/components/lab/` son las herramientas de comparación/exportación, no módulos imprescindibles de tu aplicación financiera.

## Compatibilidad

- React: laboratorio 19, Money_v2 18. Revisa especialmente los tipos de refs, aunque los componentes de presentación usan hooks comunes a ambas versiones.
- Tailwind: laboratorio 4, Money_v2 3. No copies el paquete entero ni cambies tu versión de Tailwind para resolver un estilo concreto sin planificarlo.
- Lucide: el laboratorio usa iconos de una versión más reciente. Comprueba los nombres o actualiza de forma controlada.
- Mapa: incluye los trazados ya generados. Solo necesitas world-atlas, topojson-client y d3-geo si decides regenerarlos con el script, no para pintar el SVG ya generado.
- Rutas Next.js, layout, configuración de base de datos y credenciales NO forman parte de la referencia para Vite.

## Privacidad

El servidor construye este ZIP con una lista fija de fuentes permitidas. No recorre el proyecto entero, no exporta `.env`, no consulta movimientos financieros, no incluye bases de datos, backups ni claves API. `mock.ts` contiene datos sintéticos y está claramente etiquetado.

## Licencias y procedencia

El código fuente de este paquete utiliza dependencias externas (React, lucide-react, world-atlas, topojson-client, d3-geo, etc.). Conserva sus licencias y avisos al incorporarlas al proyecto. El mapa se genera a partir de Natural Earth distribuido por world-atlas; el script documenta su origen.

Lee `LEEME.md` antes de iniciar la integración.
