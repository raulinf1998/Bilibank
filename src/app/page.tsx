import { FullApp } from "@/components/app-shell/FullApp";
import { loadAppState } from "@/lib/server-app-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { config, palettes, data } = await loadAppState();
  return <FullApp initialConfig={config} initialPalettes={palettes} initialData={data} />;
}
