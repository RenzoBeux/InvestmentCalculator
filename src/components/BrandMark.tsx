import { useId } from "react";

/**
 * Logo de marca: una calculadora de inversión. En la pantalla, la trayectoria
 * que sube (el "fire" de FIRE); el botón "=" en dorado es el número de retiro.
 * Mismo arte que el favicon (public/favicon.svg).
 */
export function BrandMark({ size = 32 }: { size?: number }) {
  const tile = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={tile} x1="32" y1="0" x2="32" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a8a60" />
          <stop offset="1" stopColor="#196848" />
        </linearGradient>
      </defs>

      {/* Tile */}
      <rect x="0" y="0" width="64" height="64" rx="14" fill={`url(#${tile})`} />
      {/* Brillo sutil arriba */}
      <rect x="0" y="0" width="64" height="30" rx="14" fill="#ffffff" opacity="0.07" />

      {/* Cuerpo de la calculadora */}
      <rect x="17" y="11" width="30" height="42" rx="5.5" fill="#faf6ec" />

      {/* Pantalla */}
      <rect x="21" y="15.5" width="22" height="12" rx="2.5" fill="#16140f" />
      {/* Trayectoria que sube: el crecimiento de la inversión (FIRE) */}
      <polyline
        points="23.5,24 28,21.4 31.5,22.7 36,18.4 40.5,17.2"
        fill="none"
        stroke="#e8b53e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="40.5" cy="17.2" r="1.8" fill="#e8b53e" />

      {/* Teclado */}
      <g fill="#d9d0be">
        <rect x="21.8" y="31.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="29.4" y="31.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="37.0" y="31.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="21.8" y="38.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="29.4" y="38.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="37.0" y="38.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="21.8" y="45.4" width="5.2" height="5.2" rx="1.4" />
        <rect x="29.4" y="45.4" width="5.2" height="5.2" rx="1.4" />
      </g>
      {/* Botón "=" en dorado (el número de retiro / objetivo) */}
      <rect x="37.0" y="45.4" width="5.2" height="5.2" rx="1.4" fill="#b07d18" />
    </svg>
  );
}
