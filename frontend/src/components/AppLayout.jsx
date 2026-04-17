import Navbar from './Navbar'

function AppLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        {title ? <h1 className="mb-6 ds-page-title sm:text-3xl">{title}</h1> : null}
        {children}
      </main>
    </div>
  )
}

export default AppLayout

