/* Empaqueta la aplicación completa para subirla a GitHub y desplegarla con Docker.
   Uso: node scripts/build-release.mjs
   Salida: public/download/mi-patrimonio-app.zip
   Incluye sólo una lista blanca: nunca .env, bases de datos, backups ni node_modules. */
import fs from "node:fs";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";

const root = process.cwd();
const output = path.join(root, "public", "download", "mi-patrimonio-app.zip");

const ROOT_FILES = [
  "package.json", "package-lock.json", "next.config.ts", "tsconfig.json",
  "postcss.config.mjs", "eslint.config.mjs", "drizzle.config.json",
  "env.example", "dockerignore", "install.sh", "Dockerfile", "docker-compose.yml",
  "next-env.d.ts",
];
const DIRECTORIES = ["src", "docker", "deploy", "docs", "scripts"];
const PUBLIC_DIR = "public";
const BLOCKED = /(^|\/)(\.env$|\.env\.(?!example)|\.env\.local$|node_modules|\.next|\.git|download\/)|^data\/|\.(db|sqlite|sqlite3|tgz|log)$/i;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.relative(root, path.join(dir, entry.name)).split(path.sep).join("/");
    if (BLOCKED.test(rel)) continue;
    if (entry.isDirectory()) out.push(...walk(path.join(dir, entry.name)));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

const files = new Set(ROOT_FILES.filter((f) => fs.existsSync(path.join(root, f))));
for (const dir of DIRECTORIES) {
  if (fs.existsSync(path.join(root, dir))) for (const f of walk(path.join(root, dir))) files.add(f);
}
if (fs.existsSync(path.join(root, PUBLIC_DIR))) {
  for (const f of walk(path.join(root, PUBLIC_DIR))) files.add(f);
}
for (const f of [...files]) if (BLOCKED.test(f)) files.delete(f);

const entries = {};
for (const file of [...files].sort()) entries[file] = new Uint8Array(fs.readFileSync(path.join(root, file)));

entries["LEEME-PRIMERO.md"] = strToU8(`# Mi Patrimonio — aplicación completa

Aplicación autohospedada con la interfaz del laboratorio: 6 estructuras,
todas las paletas integradas, paletas personalizadas y base de datos PostgreSQL persistente.

## Arranque rápido con Docker

\`\`\`bash
bash install.sh
\`\`\`

El script crea \`.env\` (con contraseña segura generada) y \`.dockerignore\`,
y arranca los contenedores. Si prefieres hacerlo a mano:

\`\`\`bash
cp env.example .env      # edita POSTGRES_PASSWORD
cp dockerignore .dockerignore
docker compose up -d --build
\`\`\`

Abre desde cualquier dispositivo de tu red:

    http://IP-DE-TU-SERVIDOR:3000

La aplicación está en \`/\` (y \`/app\`). El laboratorio de diseño, en \`/laboratorio\`.

Instrucciones completas para Proxmox, copias de seguridad, actualización y seguridad:
\`deploy/README.md\`.

Los datos se guardan en el volumen Docker \`mi-patrimonio-db\`. No ejecutes
\`docker compose down -v\` si quieres conservarlos.

## Ojo con el ZIP de GitHub

El botón «Code → Download ZIP» de GitHub **no incluye los archivos que empiezan por punto**
(.env, .dockerignore…). Por eso van renombrados (env.example, dockerignore) y \`install.sh\`
los crea por ti. Si clonas con \`git clone\` sí aparecerán.
`);

const generated = new Date().toISOString();
const readme = `# Mi Patrimonio\n\nAplicación autohospedada con Next.js, PostgreSQL y Docker.\n\nGenerado: ${generated}\n\nArranque: \`docker compose up -d --build\` tras crear \`.env\`.\nAplicación: \`http://IP:3000\`. Guía: \`deploy/README.md\`.\n`;
if (!entries["README.md"]) entries["README.md"] = strToU8(readme);
entries["VERSION.txt"] = strToU8(`app=mi-patrimonio\nformat=standalone-docker\nbuilt=${generated}\nfiles=${Object.keys(entries).length}\n`);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, zipSync(entries, { level: 6 }));
const size = fs.statSync(output).size;
console.log(`ZIP: ${path.relative(root, output)} · ${Object.keys(entries).length} archivos · ${(size / 1024 / 1024).toFixed(2)} MB`);
