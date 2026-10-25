/* Operaciones puras sobre el árbol de categorías y subcategorías.

   Se mantienen fuera de React para poder probarlas y para que el estado sólo
   tenga que aplicarlas. Ninguna función muta la entrada.

   Al convertir una categoría en subcategoría (o al revés) hay que reescribir
   también los movimientos; cada función devuelve el mapeo necesario.
*/

import type { Category, Subcategory } from "./mock";

/** Mueve un elemento dentro de la lista (-1 arriba, +1 abajo). */
export function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

const nextCategoryId = (list: Category[]) => Math.max(0, ...list.map((c) => c.id)) + 1;
const nextSubId = (list: Category[]) => Math.max(0, ...list.flatMap((c) => c.subcategories.map((s) => s.id))) + 1;

export interface CategoryChange {
  categories: Category[];
  /** Movimientos que deben pasar a otra categoría/subcategoría: [de, a] */
  remap?: { categoryId: number; subcategoryId?: number; toCategoryId: number; toSubcategoryId: number };
}

/** Convierte una subcategoría en una categoría propia, justo debajo de su padre. */
export function promoteSubcategory(categories: Category[], categoryId: number, subId: number): CategoryChange {
  const parent = categories.find((c) => c.id === categoryId);
  const sub = parent?.subcategories.find((s) => s.id === subId);
  if (!parent || !sub) return { categories };

  const created: Category = {
    id: nextCategoryId(categories),
    name: sub.name,
    icon: sub.icon ?? parent.icon,
    colorIdx: sub.colorIdx ?? parent.colorIdx,
    kind: parent.kind,
    subcategories: [],
  };
  const index = categories.findIndex((c) => c.id === categoryId);
  const without: Category[] = categories
    .filter((c) => c.id !== categoryId)
    .map((c) => (c.id === categoryId ? c : c));
  const parentUpdated: Category = { ...parent, subcategories: parent.subcategories.filter((s) => s.id !== subId) };
  const next = [...without];
  next.splice(index, 0, parentUpdated, created);

  return {
    categories: next,
    remap: { categoryId, subcategoryId: subId, toCategoryId: created.id, toSubcategoryId: 0 },
  };
}

/** Convierte una categoría en subcategoría de otra, conservando sus movimientos. */
export function demoteCategory(categories: Category[], categoryId: number, targetCategoryId: number): CategoryChange {
  const source = categories.find((c) => c.id === categoryId);
  const target = categories.find((c) => c.id === targetCategoryId);
  if (!source || !target || source.id === target.id) return { categories };

  const moved: Subcategory = { id: nextSubId(categories), name: source.name, icon: source.icon, colorIdx: source.colorIdx };
  const next = categories
    .filter((c) => c.id !== categoryId)
    .map((c) => (c.id === targetCategoryId ? { ...c, subcategories: [...c.subcategories, moved] } : c));

  return {
    categories: next,
    remap: { categoryId, toCategoryId: targetCategoryId, toSubcategoryId: moved.id },
  };
}

/** Mueve una subcategoría (con su id) a otra categoría padre. */
export function moveSubcategory(categories: Category[], categoryId: number, subId: number, targetCategoryId: number): Category[] {
  const source = categories.find((c) => c.id === categoryId);
  const target = categories.find((c) => c.id === targetCategoryId);
  const sub = source?.subcategories.find((s) => s.id === subId);
  if (!source || !target || !sub || source.id === target.id) return categories;

  return categories.map((c) => {
    if (c.id === categoryId) return { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) };
    if (c.id === targetCategoryId) return { ...c, subcategories: [...c.subcategories, sub] };
    return c;
  });
}

/** Aplica a un movimiento el remapeo devuelto por `promoteSubcategory`/`demoteCategory`. */
export function remapTransaction<T extends { categoryId: number; subcategoryId: number }>(tx: T, remap: CategoryChange["remap"]): T {
  if (!remap) return tx;
  const matchCategory = tx.categoryId === remap.categoryId;
  const matchSub = remap.subcategoryId === undefined || tx.subcategoryId === remap.subcategoryId;
  if (!matchCategory || !matchSub) return tx;
  return { ...tx, categoryId: remap.toCategoryId, subcategoryId: remap.toSubcategoryId };
}
