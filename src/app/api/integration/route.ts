import {
  ARCHETYPES,
  PALETTES,
  buildCustomPalette,
  coerceConfig,
  getPalette,
  parseSeeds,
} from "@/lib/themes";
import { buildIntegrationPackage, readMigrationGuide } from "@/lib/integration-package";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64 * 1024;
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export async function GET() {
  try {
    const guide = await readMigrationGuide();
    return new Response(guide, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'inline; filename="guia-integracion-money-v2.md"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "No se pudo abrir la guía de integración" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "La selección de diseño es demasiado grande" }, { status: 413 });
  }

  let payload: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
      return Response.json({ error: "La selección de diseño es demasiado grande" }, { status: 413 });
    }
    payload = JSON.parse(text);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!record(payload) || !record(payload.config)) {
    return Response.json({ error: "Falta la configuración visual" }, { status: 400 });
  }

  const raw = payload.config;
  if (!ARCHETYPES.some((a) => a.key === raw.archetypeKey)) {
    return Response.json({ error: "Estructura no válida" }, { status: 400 });
  }
  const paletteKey = typeof raw.paletteKey === "string" ? raw.paletteKey : "";
  const custom = /^custom-[a-z0-9-]{3,60}$/.test(paletteKey);
  if (!custom && !PALETTES.some((p) => p.key === paletteKey)) {
    return Response.json({ error: "Paleta no válida" }, { status: 400 });
  }

  const config = coerceConfig(raw);
  let palette = getPalette(config.paletteKey);
  if (custom) {
    const data = payload.palette;
    if (!record(data)) return Response.json({ error: "Faltan los colores de la paleta personalizada" }, { status: 400 });
    const seeds = parseSeeds(data.seeds);
    const name = typeof data.name === "string" ? data.name.trim().slice(0, 40).replace(/[\r\n*/]/g, " ") : "";
    if (!seeds || !name) return Response.json({ error: "Paleta personalizada no válida" }, { status: 400 });
    palette = buildCustomPalette({ key: paletteKey, name, seeds });
  }

  try {
    const zip = await buildIntegrationPackage(config, palette);
    // Copy to a regular ArrayBuffer-backed Uint8Array for the Response BodyInit contract.
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="money-v2-integracion-${config.archetypeKey}.zip"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "No se pudo generar el paquete de integración" }, { status: 500 });
  }
}
