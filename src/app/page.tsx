export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">VLHoldings</h1>
        <p className="mt-2 text-sm text-gray-600">Static home page is running.</p>

        <form action="/" method="get" className="mt-6">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Refresh
          </button>
        </form>
      </section>
    </main>
  );
}
