export default function SessionsLoading() {
  return (
    <main
      id="main-content"
      className="grid min-h-screen gap-3 px-4 py-6 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading sessions"
    >
      <div className="h-36 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" />
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="h-20 animate-pulse rounded-xl bg-muted motion-reduce:animate-none"
        />
      ))}
    </main>
  );
}
