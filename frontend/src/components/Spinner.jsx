/** CSS-only loading spinner + full-page centered variant. */
export function Spinner({ size = 22 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Loading" />
}

export function PageLoading({ text = 'Loading…' }) {
  return (
    <div className="page-loading">
      <Spinner size={30} />
      <p>{text}</p>
    </div>
  )
}
