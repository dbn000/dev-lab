function App() {
  return (
    <main className="page">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Entorno de experimentación</p>
        <h1 id="page-title">Dev Lab</h1>
        <p className="description">
          Un espacio para probar APIs y explorar diferentes tecnologías.
        </p>
        <div className="status" aria-label="Estado del laboratorio">
          <span className="status-dot" />
          Preparado para empezar
        </div>
      </section>
    </main>
  )
}

export default App
