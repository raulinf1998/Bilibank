import Link from "next/link";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/** Server deployment guide, available from the app itself. */
export default async function InstalacionPage() {
  let markdown = "No se encontró la guía de instalación en este contenedor.";
  try {
    markdown = await readFile(path.join(process.cwd(), "deploy", "README.md"), "utf8");
  } catch {
    // Keep the fallback message.
  }
  return (
    <main style={{ background: "#0b0d14", color: "#e5e9f0", minHeight: "100vh", padding: "32px 20px" }}>
      <article style={{ maxWidth: 860, margin: "0 auto", fontFamily: "ui-sans-serif, system-ui, sans-serif", lineHeight: 1.6 }}>
        <Link href="/" style={{ color: "#6ee7b7", fontSize: 14 }}>← Volver a la aplicación</Link>
        <h1 style={{ fontSize: 26, margin: "16px 0 8px" }}>Instalación en tu servidor</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
          Guía incluida en el contenedor. El ZIP completo del proyecto se descarga desde el laboratorio de diseño, en «Código para tu repo».
        </p>
        <pre style={{ whiteSpace: "pre-wrap", background: "#111827", border: "1px solid #1f2937", borderRadius: 14, padding: 20, fontSize: 13, overflowX: "auto" }}>{markdown}</pre>
      </article>
    </main>
  );
}
