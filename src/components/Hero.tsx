export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-inner">
        <span className="eyebrow">Calculadora de retiro · FIRE</span>
        <h1>
          Cuánto necesitás para <em>vivir de tus inversiones</em>
        </h1>
        <p>
          <strong>FIRE</strong> significa <em>Financial Independence, Retire
          Early</em>: independencia financiera para retirarte antes y vivir de
          tus inversiones. Armé esta calculadora para entender mi propio retiro y
          la comparto por si te sirve. Poné cuánto aportás por mes y cuánto querés
          gastar: vas a ver tu número, en cuántos años llegás y si tu cartera
          aguanta. Todo en valores de hoy y podés editar cada supuesto para tu
          caso.
        </p>

        <div className="hero-actions">
          <a className="btn btn-primary" href="#calculadora">
            Probar la calculadora
          </a>
          <a className="btn btn-ghost" href="#como-funciona">
            Cómo funciona
          </a>
        </div>
      </div>
    </section>
  );
}
