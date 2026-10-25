"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Trash2, Wand2 } from "lucide-react";
import { buildCustomPalette, genChart, getArchetype, seedsFromPalette, type BaseSeed, type CustomSeeds, type ModeKey, type PaletteDef } from "@/lib/themes";
import { Btn, Field, Input, Modal, Segmented, Select } from "./primitives";
import { usePaletteLibrary } from "./palettes";
import { useArch, usePreview } from "./state";

/* ------------------------------------------------------------------
   Miniatura de una paleta (Ajustes y editor)
------------------------------------------------------------------ */

export function PaletteThumb({ palette, mode }: { palette: PaletteDef; mode: ModeKey }) {
  const tk = palette.tokens[mode];
  return (
    <div style={{ backgroundColor: tk.bg, backgroundImage: tk.bgImage, borderRadius: "var(--radius-sm)", padding: 8, border: `1px solid ${tk.border}` }}>
      <div style={{ background: tk.surface, border: `1px solid ${tk.border}`, borderRadius: 6, padding: 7 }}>
        <div style={{ height: 5, width: "58%", background: tk.text, opacity: 0.85, borderRadius: 3 }} />
        <div style={{ height: 4, width: "36%", background: tk.muted, opacity: 0.7, borderRadius: 3, marginTop: 4 }} />
        <div className="mt-2 flex items-end gap-[3px]" style={{ height: 22 }}>
          {tk.chart.slice(0, 8).map((c, i) => (
            <span key={i} style={{ flex: 1, height: `${38 + ((i * 37) % 62)}%`, background: c, borderRadius: 2 }} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span style={{ height: 11, width: 34, borderRadius: 6, background: tk.accent }} />
          <span style={{ height: 11, width: 16, borderRadius: 6, background: tk.pos }} />
          <span style={{ height: 11, width: 16, borderRadius: 6, background: tk.neg }} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Campo de color: muestra + selector nativo + código hexadecimal
------------------------------------------------------------------ */

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;
  return (
    <div className="flex items-center gap-2.5">
      <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden" style={{ background: value, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}>
        <input
          type="color"
          value={value}
          aria-label={label}
          onChange={(e) => {
            setDraft(null);
            onChange(e.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="pv-muted text-[10.5px] font-semibold uppercase tracking-[0.08em]">{label}</p>
        <input
          value={shown}
          spellCheck={false}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const w = v.startsWith("#") ? v : `#${v}`;
            if (/^#[0-9a-fA-F]{6}$/.test(w)) onChange(w.toLowerCase());
          }}
          onBlur={() => setDraft(null)}
          className="pv-num w-full bg-transparent text-[12px] outline-none"
          style={{ color: "var(--text)" }}
        />
      </div>
    </div>
  );
}

const FIELDS: [keyof BaseSeed, string][] = [
  ["bg", "Fondo"],
  ["surface", "Paneles"],
  ["text", "Texto"],
  ["accent", "Acento"],
  ["accent2", "Acento 2"],
  ["pos", "Positivo"],
  ["neg", "Negativo"],
];

/* ------------------------------------------------------------------
   Editor de paletas personalizadas
------------------------------------------------------------------ */

export function PaletteEditorModal({ paletteKey, onClose }: { paletteKey?: string; onClose: () => void }) {
  const lib = usePaletteLibrary();
  const { cfg, patchConfig } = useArch();
  const { flash } = usePreview();
  const editing = paletteKey ? lib.custom.find((p) => p.key === paletteKey) : undefined;

  const [name, setName] = useState(editing?.name ?? "");
  const [seeds, setSeeds] = useState<CustomSeeds>(() => seedsFromPalette(editing ?? lib.resolve(cfg.paletteKey)));
  const [tab, setTab] = useState<ModeKey>(cfg.mode);
  const [base, setBase] = useState<string>(editing ? "" : cfg.paletteKey);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const draft = useMemo(() => buildCustomPalette({ key: "draft", name: name || "Sin nombre", seeds }), [name, seeds]);
  const cur = seeds[tab];

  const setField = (key: keyof BaseSeed, value: string) => setSeeds((s) => ({ ...s, [tab]: { ...s[tab], [key]: value } }));
  const setChart = (i: number, value: string) => setSeeds((s) => ({ ...s, [tab]: { ...s[tab], chart: s[tab].chart.map((c, k) => (k === i ? value : c)) } }));
  const regenChart = () => setSeeds((s) => ({ ...s, [tab]: { ...s[tab], chart: genChart(s[tab].accent, s[tab].accent2, tab === "dark") } }));
  const copyToOther = () => {
    const other: ModeKey = tab === "dark" ? "light" : "dark";
    setSeeds((s) => ({ ...s, [other]: { ...s[tab], chart: [...s[tab].chart] } }));
    flash(`Colores copiados al modo ${other === "dark" ? "oscuro" : "claro"}`);
  };
  const loadFrom = (key: string) => {
    setBase(key);
    if (key) setSeeds(seedsFromPalette(lib.resolve(key)));
  };

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    const r = await lib.save({ key: editing?.key, name: name.trim(), seeds });
    setSaving(false);
    if (!r.ok) {
      flash(`!${r.error}`);
      return;
    }
    patchConfig?.({ paletteKey: r.palette.key });
    flash(editing ? "Paleta actualizada" : "Paleta guardada y aplicada");
    onClose();
  };

  const remove = async () => {
    if (!editing) return;
    const ok = await lib.remove(editing.key);
    if (!ok) {
      flash("!No se pudo eliminar la paleta");
      return;
    }
    if (cfg.paletteKey === editing.key) patchConfig?.({ paletteKey: getArchetype(cfg.archetypeKey).paletteKey });
    flash("Paleta eliminada");
    onClose();
  };

  return (
    <Modal
      title={editing ? "Editar paleta" : "Nueva paleta personalizada"}
      sub="Define los colores base de cada modo; el resto se calcula automáticamente"
      width={820}
      onClose={onClose}
      footer={
        confirmDelete ? (
          <>
            <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>No, conservar</Btn>
            <Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={remove}>Sí, eliminar «{editing?.name}»</Btn>
          </>
        ) : (
          <>
            {editing && <Btn variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setConfirmDelete(true)}>Eliminar</Btn>}
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
            <Btn disabled={!name.trim() || saving} icon={<Check className="h-3.5 w-3.5" strokeWidth={3} />} onClick={submit}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Guardar y aplicar"}</Btn>
          </>
        )
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre de la paleta">
              <Input value={name} maxLength={40} placeholder="Mi paleta" onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Partir de">
              <Select value={base} onChange={(e) => loadFrom(e.target.value)}>
                {editing && <option value="">Mis cambios actuales</option>}
                {lib.all.map((p) => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented options={[{ id: "dark" as ModeKey, label: "Modo oscuro" }, { id: "light" as ModeKey, label: "Modo claro" }]} value={tab} onChange={setTab} />
            <Btn variant="ghost" size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={copyToOther}>Copiar al modo {tab === "dark" ? "claro" : "oscuro"}</Btn>
          </div>

          <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
            {FIELDS.map(([k, label]) => (
              <ColorField key={k} label={label} value={cur[k]} onChange={(v) => setField(k, v)} />
            ))}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="pv-muted text-[11px] font-bold uppercase tracking-[0.1em]">12 colores de gráficas genéricas</span>
              <Btn variant="ghost" size="sm" icon={<Wand2 className="h-3.5 w-3.5" />} onClick={regenChart}>Generar desde el acento</Btn>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {cur.chart.map((c, i) => (
                <label key={i} className="relative h-9 cursor-pointer overflow-hidden" title={`Color ${i + 1}: ${c}`} style={{ background: c, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)" }}>
                  <input type="color" value={c} aria-label={`Color de gráfica ${i + 1}`} onChange={(e) => setChart(i, e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="pv-muted text-[11px] font-bold uppercase tracking-[0.1em]">Vista previa · {tab === "dark" ? "oscuro" : "claro"}</p>
          <PaletteThumb palette={draft} mode={tab} />
          <div className="grid grid-cols-6 gap-1.5">
            {draft.tokens[tab].chart.map((c, i) => (
              <span key={i} className="h-5" style={{ background: c, borderRadius: 4 }} />
            ))}
          </div>
          <p className="pv-faint text-[11px] leading-relaxed">
            Al guardar, la paleta aparece en <b>Ajustes › Paleta de color</b> junto a las integradas y queda disponible en los dos modos. Se guarda en la base de datos.
          </p>
          <p className="pv-faint text-[11px] leading-relaxed">
            Los colores de tus cuentas, categorías y productos son fijos y no cambian con la paleta.
          </p>
        </div>
      </div>
    </Modal>
  );
}
