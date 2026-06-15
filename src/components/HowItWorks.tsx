const STEPS = [
  {
    n: "01",
    title: "Acumulás mes a mes",
    body: "Tu inicial más cada aporte se capitalizan a un rendimiento real anual. Es un supuesto editable: cambialo en los ajustes según en qué inviertas vos.",
  },
  {
    n: "02",
    title: "Tu número de retiro",
    body: "Es el capital que, a tu tasa de retiro, genera tu gasto anual sin que tengas que trabajar: gasto anual ÷ tasa de retiro.",
  },
  {
    n: "03",
    title: "La regla del 4%",
    body: "Retirar ~4% al año del capital es el punto de referencia clásico. Bajala para más margen, subila si tu cartera rinde más.",
  },
  {
    n: "04",
    title: "Todo en términos reales",
    body: "El gasto se mantiene en poder de compra de hoy y los rendimientos ya tienen la inflación descontada.",
  },
];

export function HowItWorks() {
  return (
    <section className="how" id="como-funciona">
      <div className="how-inner">
        <div className="section-head">
          <span className="eyebrow">Cómo funciona</span>
          <h2>Las cuatro ideas del modelo</h2>
          <p>Con los mismos números te da siempre el mismo resultado.</p>
        </div>

        <div className="how-grid">
          {STEPS.map((s) => (
            <article className="how-card" key={s.n}>
              <span className="how-num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
