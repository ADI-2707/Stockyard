
export default function App() {
  return (
    <div style={{ padding: '40px', fontFamily: 'var(--font-family)', backgroundColor: 'var(--color-bg-app)', height: '100vh' }}>
      <div style={{ backgroundColor: 'var(--color-bg-card)', padding: '24px', border: '1px solid var(--color-border-light)', borderRadius: 'var(--border-radius-sm)', maxWidth: '400px', boxShadow: 'var(--shadow-sm)' }}>
        <h1 style={{ color: 'var(--color-brand-primary)', marginBottom: '12px' }}>Stockyard</h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-base)' }}>
          Project setup and design tokens initialized. Database connection and UI components will be implemented next.
        </p>
      </div>
    </div>
  )
}
