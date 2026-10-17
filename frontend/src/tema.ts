import type React from 'react';

/** Cores de séries dos gráficos; os valores reais vêm de --chart-N no App.css
 *  e mudam junto com o tema. */
export const CORES_SERIE = Array.from({ length: 10 }, (_, i) => `var(--chart-${i + 1})`);

/** Mesma categoria → mesma cor em todas as telas (hash estável do nome). */
export function corCategoria(nome: string | null | undefined): string {
  if (!nome) return 'var(--color-text-light)';
  let h = 0;
  for (const ch of nome.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CORES_SERIE[h % CORES_SERIE.length];
}

/** Estilo para <span className="cat-chip">. */
export function estiloCategoria(nome: string | null | undefined): React.CSSProperties {
  return { ['--cat-cor' as string]: corCategoria(nome) };
}
