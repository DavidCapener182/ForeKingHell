export default function AnalyseLoading() {
  return (
    <main
      id="main-content"
      className="grid min-h-screen gap-4 px-4 py-6 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading analysis"
    >
      <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
        <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      </div>
    </main>
  );
}
