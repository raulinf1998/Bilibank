# Integrar el rediseño en Money_v2 sin perder datos

## Antes de empezar: qué estás trasladando

El laboratorio de esta conversación NO es una rama ni un clon de `raulreg98/Money_v2`. Es una aplicación independiente para probar interfaz, con Next.js, PostgreSQL y datos de demostración.

Tu aplicación real utiliza React 18 + Vite + TypeScript + Tailwind 3 + Recharts y un backend Express 5 + SQLite/sql.js. La recomendación es **conservar ese stack y su lógica financiera**, e integrar la interfaz por fases. Migrar a Next.js/PostgreSQL sería otro proyecto, no un requisito del rediseño.

**No basta con pegar tres archivos de estilos para incorporar todas las funciones.** Los tokens son reutilizables, pero las pantallas deben conectarse a tu API y tus modelos. El paquete adjunto es una referencia de implementación, NO un parche automático ni un despliegue preparado para tu instalación.

Ruta de la aplicación dentro del repositorio: `Money-main/Money-main/`.

Documentación contrastada con los archivos públicos del repositorio durante la preparación de este paquete. Si GitHub ha cambiado desde entonces, vuelve a revisar los tipos y endpoints antes de integrar.

---

## 1. Copia de seguridad y rama de trabajo

1. Crea una copia desde la pantalla de copias de seguridad de tu app real y descárgala fuera del contenedor.
2. Conserva también una copia de `/data/app.db` y del volumen Docker. Verifica que la copia puede restaurarse en una instalación de pruebas.
3. No trabajes con la base de datos de producción: usa una copia separada y configura `DB_PATH` para apuntar a ella.
4. Clona el repo o actualiza tu copia local y crea una rama, por ejemplo `redesign/ui-laboratorio`.
5. Entra en `Money-main/Money-main/`. No sustituyas el repositorio completo por el contenido del ZIP.
6. Respeta `AGENTS.md`: migraciones estrictamente aditivas, formato es-ES, claro/oscuro, mobile-first, y comprobaciones de build y tests.

No añadas al commit archivos `.env`, `.env.local`, bases de datos, datos de prueba derivados de tu información real, copias de seguridad, `node_modules` ni salidas de compilación.

## 2. Descarga la referencia del laboratorio

En la pestaña **Código para tu repo → Descargar paquete de integración**, guarda el ZIP. Conserva también capturas de las pantallas que quieres mantener, en escritorio y móvil.

Contenido del paquete:

- `LEEME.md`: esta guía.
- `seleccion/`: configuración visual elegida, paleta completa y variables CSS para ambos modos.
- `referencia-ui/`: las pantallas y componentes reales del laboratorio con sus utilidades y estilos, tal como están en el momento de exportar.
- `REFERENCIA-Y-LIMITACIONES.md`: qué es demostración y qué requiere adaptación.
- `INVENTARIO.json`: archivos y hashes SHA-256 para identificar exactamente la versión exportada.

La selección visual no incluye datos financieros reales ni claves. Los datos presentes en `referencia-ui/src/lib/mock.ts` son exclusivamente la muestra sintética del laboratorio. No los importes en tu base de datos.

## 3. Lleva primero el sistema visual

Empieza en una carpeta nueva, por ejemplo `src/redesign/`, para que el diseño anterior siga disponible hasta completar la integración.

1. Incorpora `colors.ts`, el catálogo de iconos y los tokens/definiciones de temas. Mantén separados los colores persistentes de cuentas, categorías y productos de los colores de interfaz.
2. Añade la paleta seleccionada y los componentes básicos (paneles, botones, KPIs, chips). Aplica el tema por variables CSS a la raíz de la app.
3. Integra el selector de estructura en `SettingsPage` y reorganiza `AppLayout` sin reemplazar su navegación por estado/hash.
4. Adapta las utilidades de Tailwind: el laboratorio usa Tailwind 4; tu repo, Tailwind 3. Conserva las directivas `@tailwind` del repo. No pegues `@import "tailwindcss"` ni reemplaces tus configuraciones por las de Next.js.
5. Revisa las clases de opacidad y gradiente que difieren entre versiones. Usa CSS estándar para los estilos que no reconozca Tailwind 3.
6. El laboratorio tiene una versión de lucide-react más nueva. Comprueba que los iconos utilizados existen en la instalada en tu repo; si actualizas la dependencia, hazlo en esta rama y verifica compatibilidad.
7. Revisa las referencias tipadas de React al pasar de React 19 (laboratorio) a React 18 (repo). No copies el package.json del laboratorio para resolver esas diferencias.
8. Carga las fuentes seleccionadas desde tu `index.html` o recursos locales; `src/app/layout.tsx` es específico de Next.js y no va dentro de Vite.

Primer punto de control: el nuevo tema debe poder activarse sin cambiar datos, saldos, cálculos ni endpoints. Los formularios antiguos deben seguir funcionando.

## 4. Adapta los datos, no los reemplaces

En el laboratorio, `PreviewDataProvider` contiene arrays y operaciones locales. En tu proyecto, las pantallas deben usar `src/lib/api.ts`, `src/types/index.ts` y los repositorios existentes.

Correspondencias contrastadas con los tipos públicos actuales:

| Laboratorio | Money_v2 | Regla de adaptación |
|---|---|---|
| Cuenta `kind` | Cuenta `type` | Normaliza los valores existentes antes de mapear corriente/inversión. No sobrescribas categorías históricas a ciegas. |
| Cuenta `balance` | `cash_balance`, `invested_value`, `total_balance`, `initial_balance` | Usa los totales calculados por el backend; `initial_balance` no es el saldo actual. |
| Cuenta/producto/categoría `colorIdx` | Campo `color` | Usa el color guardado, preferiblemente hexadecimal. No lo recalcules cuando cambia la paleta. |
| Subcategorías anidadas | Categorías con `parent_id` | Agrupa por `parent_id` solo para pintar la UI. Al guardar, conserva los IDs existentes. |
| Movimiento `concept`/`note` | Transacción `note` | Respeta el contrato original; no crees un campo nuevo por duplicado sin necesidad. |
| `amount` con signo | `Transaction.type` + `amount` | Verifica cómo guarda signos el servidor. No cambies el signo otra vez si ya lo normaliza. |
| Traspaso con dos movimientos | `to_account_id`, `linked_transfer_id` y lógica del servidor | Usa la transferencia existente de la API; no dupliques sus dos patas desde el cliente. |
| Producto `nickname` | `Product.alias` | Usa el apodo ya existente y muestra el nombre largo como detalle. |
| Producto `category` | `Product.category` | Ofrece Cripto, Materias primas, Fondo monetario, Fondo indexado y Acciones sin cambiar el tipo técnico del producto. |
| Producto `countries` | `country_breakdown` | Conserva el formato JSON que usa la API; valida los porcentajes. |
| Producto `sectors` | `sector_breakdown` | Usa datos reales, no los porcentajes de la demo. |
| Producto `top` | `top_holdings` | Usa las posiciones reales; si faltan, muestra «Sin desglose». |
| Operación local | `Movement` | No confundas una transacción bancaria con una compra/venta de producto. |
| Preferencias/Paletas PostgreSQL | `settings` y servicios existentes | Guarda JSON de apariencia con `api.setSetting`; no hace falta trasladar Drizzle ni PostgreSQL. |
| Creador de gráficas local | `ChartWidget` + API de widgets | Reutiliza los gráficos persistentes del proyecto en lugar de guardar solo arrays en memoria. |

Tu repo ya expone métodos como `updateTransaction`, `updateMovement`, `updateAllPrices`, `getInvestmentSeries`, `getAccountSummary`, `getCategoryTransactions`, `getWidgets`, `createWidget`, `getGraficaDatos` y `setSetting`. Reutilízalos.

Los nombres de los parámetros deben confirmarse en `server/index.ts` y en los repositorios antes de escribir el adaptador. Esta guía no modifica esos endpoints.

## 5. Integra pantalla por pantalla

| Pieza del laboratorio | Destino recomendado en Money_v2 | Qué conservar del original |
|---|---|---|
| Shells de `AppPreview.tsx` | `src/components/AppLayout.tsx` | Navegación por estado/hash y selección de cuenta/producto. |
| `primitives.tsx` + temas | `Card.tsx` y componentes nuevos de `src/redesign/` | Firma de componentes que siguen usando páginas existentes. |
| `datefield.tsx` | Selector compartido de fecha | Portal, posicionamiento y scroll; sustituye la fecha fija de demo por la actual. |
| `periodbar.tsx` | `PeriodSelector` y controles compartidos | Transforma el rango a los parámetros del backend, no recortes datos históricos sin consultar. |
| Panel de `views-main.tsx` | `src/pages/DashboardPage.tsx` | Resúmenes calculados por la API. |
| Listado/detalle de cuentas | `src/pages/AccountsPage.tsx` | Saldos, caja, inversión y transferencias existentes. |
| Listado/detalle de productos | `src/pages/PortfolioPage.tsx` | FIFO, XIRR, comisiones, divisas y precios del backend. |
| Categorías de `views-extra.tsx` | `src/pages/CategoriesPage.tsx` | Jerarquía `parent_id` y reasignación segura. |
| Pestaña de gráficas/creador | `src/pages/ChartsPage.tsx` | Persistencia de `ChartWidget` y configuración existente. |
| Apariencia/estructuras/paletas | `src/pages/SettingsPage.tsx` | Resto de ajustes y copias de seguridad de tu app. |
| `charts.tsx`, `hover.tsx` | Componentes reutilizables o versiones equivalentes en Recharts | Valores reales provenientes del servidor. |
| `worldmap.tsx` y `worldmap-data.ts` | Componentes/lib del frontend | IDs ISO y correspondencia entre lista, leyenda y mapa. |

Orden recomendado:

1. Panel general con tema y KPIs.
2. Cuentas y sus detalles, distinguiendo caja disponible, coste y valor de cartera.
3. Nueva transacción, edición y filtros. Conecta cada guardado a la API y recarga los datos al terminar.
4. Categorías/subcategorías con selector visual de iconos y color independiente/heredado.
5. Inversiones: apodos, categorías, filtros por cuenta, operaciones editables y las vistas de evolución.
6. Mapa, sectores, top 10 y tabla de aportaciones con datos reales.
7. Ajustes, estructuras, paletas personalizadas y creador de gráficas persistentes.

Conserva un modo de volver al diseño anterior mientras completas cada pantalla. Haz commits pequeños y comprobables.

## 6. No lleves a producción la lógica de demostración

Sustituye explícitamente estas piezas del laboratorio:

- `src/lib/mock.ts`: datos inventados; NO se importan a SQLite.
- La fecha fija de `series.ts` y `forms.tsx`: usa fecha actual y cobertura de datos real; la demo está anclada a febrero de 2026.
- `expandSeries`, históricos interpolados, aportaciones sintéticas y KPIs fijos: utiliza las series del servidor.
- `refreshPrices`: aquí simula cambios aleatorios; en tu repo enlázalo a `api.updateAllPrices()` (POST `/prices/update-all`). Muestra fallos por proveedor/producto; no anuncies éxito si ha fallado.
- Coste medio y modificaciones locales de operaciones: conserva los cálculos FIFO, XIRR y divisas del backend. No recalcules el patrimonio de producción con las fórmulas simplificadas de la demo.
- Top empresas, países y sectores de muestra: son aproximaciones visuales, no información de mercado validada.
- La rentabilidad media de una lista y la TIR no son lo mismo. Define si quieres media aritmética, retorno ponderado por coste o XIRR y mantén el criterio del servidor.
- Las API Next.js de `/api/preferences`, `/api/palettes` y la BD del laboratorio: no se copian a Express; traslada su contrato a los ajustes del proyecto.
- Las gráficas personalizadas del laboratorio se guardan en estado local: para conservarlas tras recargar, enlázalas a los widgets persistentes de tu repo.

Eliminar los campos «Entidad» o «IBAN» del formulario no exige eliminar columnas ni datos históricos. Al convertir una cuenta entre corriente e inversión, valida que no pierda productos vinculados; reasigna primero cuando proceda.

## 7. Persistencia y migraciones seguras

Muchos campos ya existen (alias, color, desgloses y parent_id). **No añadas columnas duplicadas** antes de revisar `server/db/migrations.ts` y los tipos actuales.

Para apariencia suele bastar con claves nuevas en `settings` (por ejemplo, configuración visual y paletas JSON). Si necesitas un dato adicional, añade una migración pequeña e idempotente siguiendo el mecanismo existente de SQLite; nunca borres tablas ni recrees la BD para que encaje con el prototipo.

La subcategoría debe heredar el color de su padre si no tiene un color propio. No guardes una copia del color del padre cuando lo que quieres es herencia dinámica.

Antes y después de una migración compara recuentos, saldos por cuenta, valor por producto, operaciones y relaciones padre/hijo sobre una copia de datos. Solo entonces considera aplicarla a producción.

## 8. Comprueba, sube una PR y despliega

En la carpeta real `Money-main/Money-main/`:

- Instala las dependencias del repo con su lockfile y comprueba la versión de Node requerida.
- Ojo: el ZIP de GitHub no incluye los archivos que empiezan por punto (`.env`, `.dockerignore`). Usa `git clone`, la descarga de la aplicación, o ejecuta `install.sh` tras descomprimir.
- Ejecuta `npm run typecheck`, `npm run lint`, `npm run build` y `npm test` (son las comprobaciones de tu repo, no las de Next.js).
- Verifica que existan los fixtures de tests que espera la configuración. No uses la BD de producción para hacerlos pasar.
- Haz pruebas manuales en móvil y escritorio, claro/oscuro, y con cantidades y nombres largos.
- Revisa el diff: no debe incluir `.env`, `app.db`, backups, la carpeta de datos ni cambios destructivos de esquema.
- Haz commit y push de la rama, abre una Pull Request y prueba esa rama en una instalación de staging.
- Tras revisarla y fusionarla, crea otra copia de seguridad y reconstruye tu despliegue Docker con el proceso que ya documenta el repo.
- Conserva el volumen y el backup; **no uses `docker compose down -v`** para actualizar.
- Mantén un punto de vuelta al código previo; con migraciones aditivas se puede volver a la UI anterior sin perder campos.

### Lista de aceptación con dinero real (sobre una copia)

- [ ] El patrimonio y la caja coinciden antes/después con los resúmenes del backend.
- [ ] Cambiar de paleta no cambia colores persistentes de cuentas, categorías o productos.
- [ ] La suma de filtros por cuenta/cuenteo coincide con el total sin filtrar.
- [ ] Crear y editar gasto/ingreso se conserva tras recargar y no aplica el signo dos veces.
- [ ] Editar un traspaso actualiza ambas patas sin crear duplicados.
- [ ] Compra/venta/dividendo y comisiones coinciden con FIFO, XIRR y divisas del servidor.
- [ ] Actualizar precios llama al servicio real, respeta claves/proveedores y permite revisar errores.
- [ ] Las fechas/meses/rangos afectan a toda la pantalla y no están anclados a la fecha de la demo.
- [ ] El calendario se ve y se desplaza en un móvil estrecho, sin cerrar el formulario por accidente.
- [ ] Los iconos, colores y edición de subcategorías se conservan tras recargar.
- [ ] Los países/regiones del mapa coinciden con la lista; «Global» no pinta países arbitrarios.
- [ ] Gráficas, paletas y preferencias guardadas reaparecen al recargar.
- [ ] No hay texto desbordado, cifras superpuestas ni números de tarjeta simulados.

---

## Resumen

**No copies toda la app del laboratorio encima de GitHub.** Guarda el paquete y las capturas, crea una rama con backup, traslada primero los componentes y luego conecta cada pantalla a tu API. El resultado final debe seguir siendo tu Money_v2 con su base de datos y cálculos, pero con la interfaz elegida.
