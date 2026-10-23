import { ThemeToggle } from './components/ThemeToggle.jsx'

function App() {
  return (
    <main style={{ padding: 32 }}>
      <ThemeToggle />
      <h1>Athena</h1>
      <p>Running on {window.athena?.platform ?? 'the web'}</p>
    </main>
  )
}

export default App
