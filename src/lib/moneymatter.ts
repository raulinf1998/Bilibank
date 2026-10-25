/* Importador de exportaciones de MoneyMatter (ZIP con CSV).

   El export de MoneyMatter contiene, entre otros:
     accounts.csv               cuentas bancarias (Type = system)
     portfolios.csv             carteras de inversión
     holdings.csv               posiciones actuales
     investment_transactions.csv compras/ventas de productos
     categories.csv             categorías y subcategorías (ParentCategory)
     transactions.csv           movimientos (income, expense, transfer_in, transfer_out)
     balances_history.csv       saldo diario por cuenta
     tags.csv, budgets.csv, ... datos auxiliares

   `buildSnapshot` convierte ese material al modelo de la aplicación
   (Account / Category / Tx / Holding) sin dependencias de React, para poder
   usarse tanto en el navegador (importación manual) como en el servidor
   (semilla inicial desde data/moneymatter/). */

import type { Account, Category, Holding, HoldingCategory, Operation, Subcategory, Tx } from "./mock";

/* ------------------------------ CSV ------------------------------ */

/** Parser CSV mínimo con soporte de comillas, comas y saltos dentro de campo. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function csvRows(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      head.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
      return obj;
    });
}

/** Minúsculas sin acentos, para comparar nombres castellanos. */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const num = (v: string | undefined): number => {
  if (!v) return 0;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n: number) => Math.round(n * 100) / 100;
const monthOf = (iso: string) => iso.slice(0, 7);

/** Busca un fichero del export por nombre, ignorando carpetas y mayúsculas. */
export function findFile(files: Record<string, string>, name: string): string | null {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(files)) {
    const base = key.split("/").pop()?.toLowerCase() ?? key.toLowerCase();
    if (base === wanted) return value;
  }
  return null;
}

/* ------------------------------ iconos ------------------------------ */

const ICON_WORDS_ES: Record<string, string> = {
  /* Castellano: los iconos de las categorías personalizadas suelen venir vacíos */
  alimentacion: "cutlery", bebidas: "wine", atencion: "medico", medica: "medico", doctor: "steth", dentista: "plus",
  camara: "camera", capricho: "gift", casa: "home", vivienda: "home", hogar: "home", hipoteca: "home", alquiler: "key",
  clases: "school", colegio: "school", educacion: "school", formacion: "grad", desarrollo: "brain", universidad: "university",
  compras: "bag", comunicacion: "wifi", informatica: "computer", telefonia: "phone", telefono: "phone",
  deporte: "gym", gimnasio: "gym", bienestar: "sparkles", belleza: "sparkles",
  energia: "zap", luz: "bulb", agua: "drop", gas: "flame", suministros: "zap", servicios: "plug",
  estacionamiento: "parking", aparcamiento: "parking", peaje: "car", combustible: "fuel", mantenimiento: "tools",
  transporte: "train", vehiculo: "car", coche: "car", moto: "motorbike", bici: "bike", viajes: "plane",
  farmacia: "pill", drogueria: "pill", salud: "medico", hospital: "medico", medico: "steth", seguro: "shield",
  gastos: "receipt", financieros: "receipt", financiero: "receipt", comisiones: "receipt", cargos: "receipt",
  impuestos: "calc", tasas: "calc", intereses: "percent", dividendos: "piggy", inversion: "chart", inversiones: "chart",
  ahorros: "piggy", ingresos: "wallet", salario: "wallet", nomina: "wallet", reembolsos: "receipt", cheques: "receipt",
  cuotas: "ribbon", subvenciones: "ribbon", regalos: "gift", regalo: "gift", caridad: "handheart", alegrias: "gift",
  restaurante: "utensils", restaurantes: "utensils", comida: "cutlery", supermercado: "cart", panaderia: "croissant",
  bar: "coffee", cafeteria: "coffee", ocio: "party", fiesta: "party", cultura: "ticket", eventos: "ticket",
  libros: "book", audio: "headphones", suscripciones: "play", musica: "music", cine: "film", juegos: "game",
  ropa: "shirt", electronica: "laptop", accesorios: "cable", hogar_jardin: "sprout", jardin: "sprout", plantas: "sprout",
  mascotas: "paw", bebe: "baby", hijos: "baby", otros: "tag", otro: "tag", sin: "tag", clasificar: "tag",
  colecciones: "bookmark", aficiones: "puzzle", boda: "heartsimple", seguro_medico: "shield", asesoria: "users",
  hipotecas: "home", comunidad: "building", parking2: "parking", transporte_publico: "train",
};

const ICON_WORDS_EN: Record<string, string> = {
  wallet: "wallet", credit: "card", card: "card", cash: "cash", coins: "coins", money: "cash", bank: "bank", vault: "vault",
  home: "home", house: "home", key: "key", building: "building", sofa: "sofa", plant: "sprout", grass: "sprout", garden: "sprout",
  energia: "zap", energy: "zap", flash: "zap", electric: "bulb", light: "bulb", water: "drop", drop: "drop",
  wifi: "wifi", internet: "wifi", phone: "phone", mobile: "phone", tv: "tv", fire: "flame", flame: "flame",
  food: "cutlery", restaurant: "utensils", drink: "wine", wine: "wine", coffee: "coffee", beer: "beer", pizza: "pizza",
  cart: "cart", shopping: "bag", bag: "bag", store: "store", market: "basket",
  car: "car", vehicle: "car", fuel: "fuel", gas: "fuel", pump: "fuel", parking: "parking", train: "train", bus: "bus",
  bike: "bike", bicycle: "bike", plane: "plane", travel: "plane", luggage: "luggage", hotel: "hotel", ship: "ship",
  film: "film", cinema: "film", play: "play", music: "music", game: "game", ticket: "ticket", party: "party",
  sport: "gym", gym: "gym", fitness: "gym", book: "book", news: "news", camera: "camera", palette: "palette", brush: "brush",
  heart: "heartsimple", health: "medico", medical: "medico", doctor: "steth", hospital: "medico", pill: "pill",
  pharmacy: "pill", glasses: "glasses", dentist: "plus", syringe: "syringe", thermometer: "thermo",
  shirt: "shirt", clothes: "shirt", scissors: "scissors", watch: "watch", laptop: "laptop", computer: "computer",
  code: "code", package: "package", cloud: "cloud", clock: "clock", leaf: "leaf", tree: "tree", flower: "flower",
  dog: "dog", cat: "cat", paw: "paw", baby: "baby", users: "users", personsupport: "users", support: "handheart",
  gift: "gift", charity: "handheart", hand: "hand", tax: "calc", calculator: "calc", percent: "percent",
  interest: "percent", investment: "chart", chart: "chart", stocks: "chart", crypto: "bitcoin", bitcoin: "bitcoin",
  gold: "gem", gem: "gem", shield: "shield", insurance: "shield", tools: "tools", wrench: "tools",
  construction: "hammer", hammer: "hammer", trash: "trash", education: "school", school: "school",
  university: "university", graduation: "grad", hat: "grad", work: "work", briefcase: "work", receipt: "receipt",
  file: "file", document: "file", certificate: "ribbon", ribbon: "ribbon", bookmark: "bookmark",
  puzzle: "puzzle", puzzlepiece: "puzzle", sparkle: "sparkles", star: "star", target: "target", flag: "flag",
  umbrella: "umbrella", sun: "sun", snow: "snow", anchor: "anchor", rocket: "rocket", trophy: "trophy",
  dumbbell: "gym", map: "map", globe: "globe", mail: "mail", inbox: "inbox", tag: "tag", tags: "tags",
  babycarriage: "baby", stroller: "baby", mouse: "computer", desk: "deskLamp", lamp: "lamp", fridge: "fridge",
  washer: "washer", bath: "bath", bed: "bed", hammer2: "hammer", school2: "school",
};

/** Castellano primero: si una palabra existe en ambos idiomas, manda la inglesa. */
const ICON_WORDS: Record<string, string> = { ...ICON_WORDS_ES, ...ICON_WORDS_EN };

/** Traduce los iconos de MoneyMatter (`food-20-filled`) a las claves del catálogo de la app. */
export function mapIcon(raw: string | undefined, fallback = "tag"): string {
  if (!raw) return fallback;
  const tokens = fold(raw.toLowerCase())
    .replace(/\.(svg|png)$/, "")
    .split(/[-_.\s]+/)
    .filter((t) => t && !/^\d+$/.test(t) && t !== "filled" && t !== "outline" && t !== "20" && t !== "24");
  for (const token of tokens) {
    if (ICON_WORDS[token]) return ICON_WORDS[token];
  }
  return fallback;
}

/* ------------------------------ resultado ------------------------------ */

export interface ImportSummary {
  source: string;
  exportedAt: string | null;
  accounts: number;
  investmentAccounts: number;
  categories: number;
  subcategories: number;
  transactions: number;
  transfers: number;
  holdings: number;
  operations: number;
  firstDate: string | null;
  lastDate: string | null;
  income: number;
  expense: number;
  warnings: string[];
}

export interface Snapshot {
  accounts: Account[];
  categories: Category[];
  holdings: Holding[];
  transactions: Tx[];
}

export interface ImportResult {
  snapshot: Snapshot;
  summary: ImportSummary;
}

export interface BuildOptions {
  /** Nombre del fichero de origen, solo informativo. */
  source?: string;
}

/* ------------------------------ utilidades ------------------------------ */

/** Serie de 12 puntos mensuales con el último saldo conocido de cada mes. */
function monthlyHistory(dates: string[], balances: number[], fallback: number): number[] {
  const chunks = new Map<string, { date: string; value: number }>();
  dates.forEach((date, i) => {
    const key = monthOf(date);
    const prev = chunks.get(key);
    if (!prev || date >= prev.date) chunks.set(key, { date, value: balances[i] });
  });
  const ordered = [...chunks.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v.value);
  if (!ordered.length) return Array(12).fill(round2(fallback));
  const tail = ordered.slice(-12);
  while (tail.length < 12) tail.unshift(tail[0]);
  return tail.map(round2);
}

function holdingType(name: string, ticker: string): Holding["type"] {
  const n = fold(`${name} ${ticker}`.toLowerCase());
  if (/(etf|etc|etp|ucits)/.test(n)) return "ETF";
  if (/(bitcoin|btc|ethereum|cripto|crypto)/.test(n)) return "Cripto";
  if (/(fondo|fund|idx|indx|index|fi\b|sicav|tresor|treasury|monetario)/.test(n)) return "Fondo";
  if (/(pensi|plan de)/.test(n)) return "Pensiones";
  return "Acción";
}

function holdingCategory(name: string, ticker: string): HoldingCategory {
  const n = fold(`${name} ${ticker}`.toLowerCase());
  if (/(bitcoin|btc|ethereum|cripto|crypto)/.test(n)) return "Cripto";
  if (/(gold|oro|silver|plata|commodit|materia)/.test(n)) return "Materias primas";
  if (/(tresor|treasury|court terme|monetario|money market)/.test(n)) return "Fondo monetario";
  if (/(accion|stock|equity|vanguard|amundi|fidelity)/.test(n) && !/(index|idx|fund|fondo)/.test(n)) return "Acciones";
  return "Fondo indexado";
}

const shortName = (name: string, ticker: string): string => {
  const clean = name.replace(/\s+(IE|IE Acc|Acc|EUR|S Acc|D Acc)\b/gi, "").trim();
  const words = clean.split(/\s+/);
  const short = words.slice(0, 3).join(" ");
  return short.length > 26 ? `${short.slice(0, 25)}…` : short || ticker;
};

const isIsin = (ticker: string) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(ticker.replace(/\.\w+$/, ""));

/* ------------------------------ constructor ------------------------------ */

export function buildSnapshot(files: Record<string, string>, options: BuildOptions = {}): ImportResult {
  const warnings: string[] = [];

  const accountsCsv = findFile(files, "accounts.csv");
  const transactionsCsv = findFile(files, "transactions.csv");
  const categoriesCsv = findFile(files, "categories.csv");
  const holdingsCsv = findFile(files, "holdings.csv");
  const portfoliosCsv = findFile(files, "portfolios.csv");
  const investTxCsv = findFile(files, "investment_transactions.csv");
  const balancesCsv = findFile(files, "balances_history.csv");

  if (!accountsCsv && !transactionsCsv) {
    throw new Error("El ZIP no parece un export de MoneyMatter: falta accounts.csv y transactions.csv");
  }
  if (!transactionsCsv) warnings.push("No se encontró transactions.csv: no se han importado movimientos.");
  if (!accountsCsv) warnings.push("No se encontró accounts.csv: las cuentas se han deducido de los movimientos.");

  /* ---------------- historial de saldos ---------------- */
  const balanceRows = balancesCsv ? csvRows(balancesCsv) : [];
  const balanceByAccount = new Map<string, { dates: string[]; values: number[] }>();
  for (const row of balanceRows) {
    const name = row.Account ?? "";
    if (!name) continue;
    const bucket = balanceByAccount.get(name) ?? { dates: [], values: [] };
    bucket.dates.push(row.Date ?? "");
    bucket.values.push(num(row.BalanceInBaseCurrency));
    balanceByAccount.set(name, bucket);
  }

  /* ---------------- cuentas corrientes ---------------- */
  const accounts: Account[] = [];
  const accountByName = new Map<string, Account>();
  let nextAccountId = 1;

  const accountRows = accountsCsv ? csvRows(accountsCsv) : [];
  for (const row of accountRows) {
    const name = row.Name || `Cuenta ${nextAccountId}`;
    const balance = num(row.CurrentBalance);
    const bucket = balanceByAccount.get(name);
    const account: Account = {
      id: nextAccountId++,
      name,
      kind: "corriente",
      balance: round2(balance),
      initialBalance: round2(num(row.InitialBalance) || balance),
      colorIdx: (accounts.length * 3) % 12,
      history: bucket ? monthlyHistory(bucket.dates, bucket.values, balance) : Array(12).fill(round2(balance)),
      archived: (row.Status ?? "").toLowerCase() === "archived" ? true : undefined,
    };
    accounts.push(account);
    accountByName.set(name, account);
  }

  /* ---------------- carteras de inversión ---------------- */
  const portfolioRows = portfoliosCsv ? csvRows(portfoliosCsv) : [];
  const portfolioAccount = new Map<string, Account>();
  for (const row of portfolioRows) {
    const name = row.Name;
    if (!name) continue;
    const clash = accountByName.get(name);
    const displayName = clash ? `${name} · inversión` : name;
    const cash = num((row.CashBalances ?? "").replace(/^[A-Z]{3}:/, ""));
    const bucket = balanceByAccount.get(name);
    const account: Account = {
      id: nextAccountId++,
      name: displayName,
      kind: "inversion",
      balance: round2(cash),
      initialBalance: round2(cash),
      colorIdx: (accounts.length * 3) % 12,
      history: bucket ? monthlyHistory(bucket.dates, bucket.values, cash) : Array(12).fill(round2(cash)),
      archived: clash?.archived,
    };
    accounts.push(account);
    portfolioAccount.set(name, account);
  }

  /* ---------------- productos de inversión ---------------- */
  const operationsBySecurity = new Map<string, Operation[]>();
  if (investTxCsv) {
    for (const row of csvRows(investTxCsv)) {
      const ticker = row.Security ?? "";
      const key = `${row.Portfolio ?? ""}::${ticker}`;
      const type = (row.Type ?? "").toLowerCase();
      const op: Operation = {
        id: (operationsBySecurity.get(key)?.length ?? 0) + 1,
        date: row.Date ?? "",
        type: type === "sell" ? "venta" : type === "dividend" ? "dividendo" : type === "transfer_in" || type === "transfer" ? "aportacion" : "compra",
        units: num(row.Quantity),
        price: num(row.Price),
        fees: num(row.Fees),
      };
      operationsBySecurity.set(key, [...(operationsBySecurity.get(key) ?? []), op]);
    }
  }

  const holdings: Holding[] = [];
  if (holdingsCsv) {
    const rows = csvRows(holdingsCsv);
    rows.forEach((row, index) => {
      const ticker = row.SecurityTicker || `MM${index + 1}`;
      const name = row.SecurityName || ticker;
      const portfolio = row.Portfolio ?? "";
      const account = portfolioAccount.get(portfolio);
      if (!account) warnings.push(`Cartera "${portfolio}" sin cuenta asociada (${ticker}).`);
      const units = num(row.Quantity);
      const invested = num(row.CostBasis);
      const costPerUnit = num(row.CostBasisPerUnit) || (units ? invested / units : 0);
      const operations = operationsBySecurity.get(`${portfolio}::${ticker}`) ?? [];
      const lastPrice = [...operations].reverse().find((o) => o.price > 0)?.price ?? costPerUnit;
      const price = lastPrice || costPerUnit;

      /* Serie de 24 meses con el coste medio por unidad (no hay precios de mercado en el export). */
      const byMonth = new Map<string, { units: number; cost: number }>();
      for (const op of operations) {
        if (!op.date) continue;
        const bucket = byMonth.get(monthOf(op.date)) ?? { units: 0, cost: 0 };
        bucket.units += op.units;
        bucket.cost += op.units * op.price + op.fees;
        byMonth.set(monthOf(op.date), bucket);
      }
      let cumUnits = 0;
      let cumCost = 0;
      const points: number[] = [];
      const contrib: number[] = [];
      const lastOp = operations.reduce((max, op) => (op.date > max ? op.date : max), "");
      const allMonths = last24Months(lastOp ? monthOf(lastOp) : undefined);
      for (const month of allMonths) {
        const bucket = byMonth.get(month);
        if (bucket) {
          cumUnits += bucket.units;
          cumCost += bucket.cost;
          contrib.push(round2(bucket.cost));
        } else contrib.push(0);
        points.push(cumUnits > 0 ? round2(cumCost / cumUnits) : 0);
      }
      let last = 0;
      const prices = points.map((p) => {
        if (p > 0) last = p;
        return last || round2(costPerUnit);
      });
      const spark = prices.slice(-12);

      holdings.push({
        id: index + 1,
        accountId: account?.id ?? accounts[0]?.id ?? 1,
        ticker,
        isin: isIsin(ticker) ? ticker.replace(/\.\w+$/, "") : "",
        name,
        type: holdingType(name, ticker),
        currency: "EUR",
        units,
        price: round2(price),
        invested: round2(invested),
        change1d: 0,
        spark,
        prices,
        colorIdx: (index * 5) % 12,
        source: "MoneyMatter",
        operations,
        nickname: shortName(name, ticker),
        category: holdingCategory(name, ticker),
        top: [["Sin desglose", 100]],
        sectors: [["Sin clasificar", 100]],
        countries: [["Sin clasificar", 100]],
        contrib,
      });
    });
  }

  /* Historial de las cuentas de inversión: evolución de las aportaciones (24 → 12 meses) */
  for (const account of accounts.filter((a) => a.kind === "inversion")) {
    const own = holdings.filter((h) => h.accountId === account.id);
    if (!own.length) continue;
    const monthly: number[] = [];
    for (let m = 0; m < 24; m++) {
      let total = 0;
      for (const holding of own) {
        for (let k = 0; k <= m; k++) total += holding.contrib[k] ?? 0;
      }
      monthly.push(round2(total));
    }
    account.history = monthly.slice(-12);
  }

  /* Saldo de las cuentas de inversión = valor de sus productos + efectivo */
  for (const account of accounts.filter((a) => a.kind === "inversion")) {
    const value = holdings.filter((h) => h.accountId === account.id).reduce((s, h) => s + h.units * h.price, 0);
    if (value > 0) {
      account.balance = round2(value + account.balance);
      account.initialBalance = round2(
        holdings.filter((h) => h.accountId === account.id).reduce((s, h) => s + h.invested, 0) + account.initialBalance,
      );
    }
  }

  /* ---------------- categorías ---------------- */
  const categories: Category[] = [];
  const categoryByName = new Map<string, Category>();
  const subIndex = new Map<string, { category: Category; sub: Subcategory }>();

  const categoryRows = categoriesCsv ? csvRows(categoriesCsv) : [];
  const topRows = categoryRows.filter((r) => !r.ParentCategory);
  const childRows = categoryRows.filter((r) => r.ParentCategory);

  const ensureCategory = (name: string, color?: string, icon?: string): Category => {
    const existing = categoryByName.get(name);
    if (existing) return existing;
    const category: Category = {
      id: categories.length + 1,
      name,
      icon: mapIcon(icon, mapIcon(name.replace(/,.*/, ""), "tag")),
      colorIdx: color || "#78716C",
      kind: /ingreso|salario|reembolso|cobro|devoluci/i.test(name) ? "ingreso" : "gasto",
      subcategories: [],
    };
    categories.push(category);
    categoryByName.set(name, category);
    return category;
  };

  for (const row of topRows) ensureCategory(row.Name, row.Color, row.Icon);
  for (const row of childRows) {
    const parent = ensureCategory(row.ParentCategory, row.Color, "");
    const id = parent.id * 1000 + parent.subcategories.length + 1;
    const sub: Subcategory = { id, name: row.Name, icon: mapIcon(row.Icon, parent.icon), colorIdx: row.Color || undefined };
    parent.subcategories.push(sub);
    subIndex.set(`${parent.name}::${row.Name}`, { category: parent, sub });
    if (!subIndex.has(`${row.Name}`)) subIndex.set(row.Name, { category: parent, sub });
  }

  const fallbackCategory = ensureCategory("Sin clasificar", "#78716C", "tag");

  const resolveCategory = (categoryName: string, subName: string): { categoryId: number; subcategoryId: number } => {
    if (subName) {
      const direct = subIndex.get(`${categoryName}::${subName}`) ?? subIndex.get(subName);
      if (direct) return { categoryId: direct.category.id, subcategoryId: direct.sub.id };
    }
    if (categoryName) {
      const cat = categoryByName.get(categoryName);
      if (cat) {
        const sub = cat.subcategories.find((s) => s.name === subName);
        return { categoryId: cat.id, subcategoryId: sub?.id ?? 0 };
      }
      const asSub = subIndex.get(categoryName);
      if (asSub) return { categoryId: asSub.category.id, subcategoryId: asSub.sub.id };
    }
    return { categoryId: fallbackCategory.id, subcategoryId: 0 };
  };

  /* ---------------- movimientos ---------------- */
  const transactions: Tx[] = [];
  let transfers = 0;
  let income = 0;
  let expense = 0;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  if (transactionsCsv) {
    const rows = csvRows(transactionsCsv);
    rows.forEach((row, index) => {
      const date = row.Date ?? "";
      if (!date) return;
      const type = (row.Type ?? "").toLowerCase();
      const account = accountByName.get(row.Account ?? "");
      if (!account) {
        warnings.push(`Movimiento de una cuenta desconocida: ${row.Account || "—"}`);
        return;
      }
      const raw = Math.abs(num(row.Amount) || num(row.AmountInBaseCurrency));
      let amount = raw;
      let categoryId = 0;
      let subcategoryId = 0;

      if (type === "expense") {
        amount = -raw;
        expense += raw;
        ({ categoryId, subcategoryId } = resolveCategory(row.Category ?? "", row.Subcategory ?? ""));
      } else if (type === "income") {
        amount = raw;
        income += raw;
        ({ categoryId, subcategoryId } = resolveCategory(row.Category ?? "", row.Subcategory ?? ""));
      } else if (type === "transfer_in" || type === "transfer_out" || type === "transfer") {
        transfers++;
        amount = type === "transfer_out" ? -raw : raw;
      } else {
        amount = raw;
        ({ categoryId, subcategoryId } = resolveCategory(row.Category ?? "", row.Subcategory ?? ""));
      }

      const transfer = type.startsWith("transfer");
      const concept =
        row.Note ||
        row.Subcategory ||
        row.Category ||
        (transfer ? (type === "transfer_in" ? "Entrada de traspaso" : "Salida de traspaso") : "Movimiento");

      const tags = (row.Tags ?? "")
        .split(/[;,|]/)
        .map((t) => t.trim())
        .filter(Boolean);

      transactions.push({
        id: index + 1,
        date,
        concept,
        categoryId,
        subcategoryId,
        accountId: account.id,
        amount: round2(amount),
        tags: tags.length ? tags : undefined,
        note: row.Note || undefined,
      });

      if (!firstDate || date < firstDate) firstDate = date;
      if (!lastDate || date > lastDate) lastDate = date;
    });
    transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }

  if (transactions.some((t) => t.categoryId === fallbackCategory.id)) {
    warnings.push("Algunos movimientos no traían categoría en el export: están en «Sin clasificar».");
  }
  if (holdings.length) {
    warnings.push("El export no incluye precios de mercado: el valor de los productos usa el coste medio de compra.");
  }
  if (holdings.some((h) => h.sectors[0][0] === "Sin clasificar")) {
    warnings.push("Las posiciones no traen desglose por sectores, países ni top de empresas.");
  }

  const summary: ImportSummary = {
    source: options.source ?? "export de MoneyMatter",
    exportedAt: readExportedAt(files),
    accounts: accounts.filter((a) => a.kind === "corriente").length,
    investmentAccounts: accounts.filter((a) => a.kind === "inversion").length,
    categories: categories.length,
    subcategories: categories.reduce((s, c) => s + c.subcategories.length, 0),
    transactions: transactions.length,
    transfers,
    holdings: holdings.length,
    operations: holdings.reduce((s, h) => s + h.operations.length, 0),
    firstDate,
    lastDate,
    income: round2(income),
    expense: round2(expense),
    warnings: [...new Set(warnings)].slice(0, 6),
  };

  return { snapshot: { accounts, categories, holdings, transactions }, summary };
}

function readExportedAt(files: Record<string, string>): string | null {
  const manifest = findFile(files, "manifest.json");
  if (!manifest) return null;
  try {
    const parsed = JSON.parse(manifest) as { exportedAt?: string };
    return parsed.exportedAt ?? null;
  } catch {
    return null;
  }
}

/** Últimos 24 meses (YYYY-MM) terminando en el mes del último movimiento. */
function last24Months(endYm?: string): string[] {
  const base = endYm ? new Date(`${endYm}-01T12:00:00Z`) : new Date();
  const out: string[] = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/* ------------------------------ resumen legible ------------------------------ */

export function formatSummary(summary: ImportSummary): string {
  const parts = [
    `${summary.transactions} movimientos`,
    `${summary.accounts + summary.investmentAccounts} cuentas`,
    `${summary.holdings} productos`,
    `${summary.categories} categorías`,
  ];
  return parts.join(" · ");
}
