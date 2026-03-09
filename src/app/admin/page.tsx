import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold text-black">Admin</h1>
        <p className="mt-2 text-sm text-black/65">
          Internal tools for data operations. No authentication is enabled yet.
        </p>
      </header>

      <section className="mt-6">
        <Link
          href="/admin/poi-import"
          className="inline-flex items-center rounded-md border border-black/15 bg-white px-4 py-2 text-sm font-medium text-black hover:bg-black/5"
        >
          Open POI Import
        </Link>
      </section>
    </main>
  );
}
