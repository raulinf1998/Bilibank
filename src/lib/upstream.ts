/* Utilidades para llamar a servicios externos sin que la app se quede colgada.

   `AbortSignal.timeout` no siempre corta una conexión bloqueada (por ejemplo,
   una red que descarta paquetes o un proxy que no responde). Aquí se combina el
   abort con una carrera contra un temporizador: la promesa siempre se resuelve
   o devuelve `null` dentro del plazo.
*/

export type Deadline = { stop: number };

export function deadline(ms: number): Deadline {
  return { stop: Date.now() + ms };
}

export function expired(d: Deadline): boolean {
  return Date.now() > d.stop;
}

export function remaining(d: Deadline): number {
  return Math.max(0, d.stop - Date.now());
}

/** `fetch` con plazo máximo garantizado; devuelve `null` si no hay respuesta a tiempo. */
export async function fetchWithDeadline(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), ms);
  let release: (value: null) => void = () => {};
  const guard = new Promise<null>((resolve) => {
    release = resolve;
    setTimeout(() => resolve(null), ms + 100);
  });
  try {
    return await Promise.race([fetch(url, { ...init, signal: controller.signal }), guard]);
  } catch {
    return null;
  } finally {
    clearTimeout(abort);
    release(null);
  }
}

export async function readJson<T>(response: Response | null): Promise<T | null> {
  if (!response || !response.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function readText(response: Response | null): Promise<string | null> {
  if (!response || !response.ok) return null;
  try {
    return await response.text();
  } catch {
    return null;
  }
}
