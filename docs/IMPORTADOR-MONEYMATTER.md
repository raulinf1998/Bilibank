# Importador de MoneyMatter

La app puede cargar tus datos reales desde un **export de MoneyMatter** (el ZIP
`moneymatter-export-AAAA-MM-DD.zip`). Hay dos formas de hacerlo:

1. **Semilla del servidor (automática).** El export descomprimido vive en
   `data/moneymatter/`. Si PostgreSQL todavía no tiene datos guardados, la
   aplicación arranca directamente con esos datos. El export incluido es
   `moneymatter-export-2026-09-08`.
2. **Importación manual (desde la propia app).** *Ajustes → Datos →
   Importar export de MoneyMatter*: selecciona el ZIP (o los CSV sueltos) y la
   app lo traduce, lo aplica y lo guarda en PostgreSQL.

## Qué se lee del export

| Fichero | Uso en la app |
| --- | --- |
| `accounts.csv` | Cuentas corrientes (saldo actual e inicial, archivadas) |
| `portfolios.csv` | Cuentas de inversión (carteras) |
| `holdings.csv` | Productos: unidades, coste, precio estimado |
| `investment_transactions.csv` | Operaciones (compra, venta, dividendo) y aportaciones de 24 meses |
| `categories.csv` | Categorías y subcategorías, con su color e icono |
| `transactions.csv` | Movimientos con fecha, cuenta, categoría, subcategoría e importe |
| `balances_history.csv` | Histórico de saldos (12 puntos mensuales por cuenta) |
| `tags.csv`, `budgets.csv`, `subscriptions.csv`, `vehicles.csv`, … | Se ignoran |

El resto de ficheros del ZIP se descartan, pero se aceptan sin problema.

## Reglas de conversión

- **Signos.** `expense` se guarda en negativo, `income` en positivo. Los
  traspasos (`transfer_in` / `transfer_out`) se conservan con su signo y sin
  categoría, como en la app.
- **Categorías.** Las filas con `ParentCategory` se convierten en subcategorías
  de su categoría padre. Las que no traen color usan la paleta fija de datos.
- **Iconos.** Los iconos de MoneyMatter (`food-20-filled`) se traducen al
  catálogo de la app; si no hay equivalencia, se usa la etiqueta genérica.
- **Carteras.** Si una cartera se llama igual que una cuenta bancaria
  (`MyInvestor`), la cuenta de inversión se muestra como
  `MyInvestor · inversión` para no confundirlas.
- **Cuentas de inversión.** Su saldo es el valor de sus productos más el
  efectivo de la cartera; su histórico sale de las aportaciones acumuladas.
- **Ventana temporal.** Al importar, la app ancla «hoy» al último movimiento
  del export (`setTodayReference`), de forma que los periodos (1M, 3M, 1A,
  «Todo») y las gráficas apuntan a tus fechas reales.

## Limitaciones conocidas

- **No hay precios de mercado.** El export no incluye cotizaciones, así que el
  valor de cada producto usa el último precio de compra / coste medio. La
  plusvalía aparece a cero hasta que conectes una fuente de precios.
- **Sin desglose de cartera.** `holdings.csv` no trae sectores, países ni top de
  empresas: esas vistas muestran «Sin clasificar» al 100 %.
- **Movimientos sin categoría.** Si el export deja la categoría vacía, el
  movimiento va a «Sin clasificar» (la app lo avisa en el resumen).
- **Traspasos sin emparejar.** Se muestran como dos apuntes, uno por cuenta.
- **Metadatos ignorados.** Presupuestos, suscripciones, vehículos y plantillas
  no se importan todavía.

## Añadir otro export

Sustituye los CSV de `data/moneymatter/` por los del nuevo ZIP (o impórtalo
desde Ajustes). La app no necesita reiniciarse para la importación manual; para
la semilla del servidor sí hay que recargar la página.
