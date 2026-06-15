/** Marca gráfica: una trayectoria que sube hacia una chispa (el "fire" de FIRE). */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 17 L9 11 L13 14 L21 5" />
      <path d="M21 5 v5" />
      <path d="M21 5 h-5" />
    </svg>
  );
}
