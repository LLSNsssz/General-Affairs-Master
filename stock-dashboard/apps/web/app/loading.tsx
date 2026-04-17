export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="panel flex w-full animate-pulse flex-col rounded-[32px] p-6 sm:p-8">
        <div className="mb-8 h-6 w-36 rounded-full bg-white/8" />
        <div className="mb-4 h-16 w-2/3 rounded-3xl bg-white/8" />
        <div className="mb-10 h-6 w-1/2 rounded-full bg-white/8" />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 rounded-[28px] bg-white/8" />
            ))}
          </div>
          <div className="h-[460px] rounded-[32px] bg-white/8" />
        </div>
      </section>
    </main>
  );
}
