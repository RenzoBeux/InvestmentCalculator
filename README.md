# Planificador de retiro

Calculadora de independencia financiera (FIRE) en **React 18 + TypeScript + Vite**.
Modela dos fases —acumulación a un rendimiento real configurable y retiro con una
cartera acciones/bonos a elección— todo en **dólares de hoy** (rendimiento real,
ya descontada la inflación).

## Correr en local

```bash
npm install
npm run dev
```

Build de producción (sale estático, listo para Cloudflare Pages, Netlify, o tu
homelab detrás de Cloudflare):

```bash
npm run build      # genera /dist
npm run preview    # previsualiza el build localmente
```

## Estructura

```
src/
  finance.ts            ← toda la lógica financiera (funciones puras y tipadas)
  RetirementPlanner.tsx ← la UI: controles, tarjetas y gráfico (Recharts)
  styles.css            ← el sistema de diseño
  main.tsx              ← punto de entrada
index.html              ← carga las fuentes (Fraunces + IBM Plex Sans)
```

`finance.ts` es el corazón y no depende de React: ahí viven los supuestos de
rendimiento (`ACCUMULATION_REAL_RETURN`, `RETIREMENT_REAL_RETURNS`) y el cálculo
del ciclo completo (`computeLifecycle`). Es el archivo que vas a tocar para
mejorar el modelo.

## Ideas para mejorarlo

- **Simulación de Montecarlo** — la mejora más importante. Reemplazar los
  rendimientos promedio en línea recta por miles de escenarios con volatilidad
  real, y reportar una *probabilidad de éxito* en vez de un único resultado.
  Es lo que captura el riesgo de secuencia (años malos al inicio del retiro),
  que el modelo determinista actual ignora.
- Modelar la acumulación con una cartera (acciones/bonos) en vez de un único rendimiento plano.
- Aportes que crecen con el tiempo (subís el aporte cada año).
- Glide path: pasaje gradual de acciones a bonos en vez de un salto al jubilarte.
- Persistir los inputs en `localStorage` o en una URL compartible.
- Tests sobre `finance.ts` (al ser puro, es trivial: Vitest + casos de borde).

## Aviso

Modelo determinista con fines educativos. No es asesoramiento financiero.
