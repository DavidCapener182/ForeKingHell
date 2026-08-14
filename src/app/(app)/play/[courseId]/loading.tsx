import { Spinner } from "@/components/ui/spinner";

export default function CourseTwinLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#07150e] text-sm text-emerald-100">
      <span className="grid place-items-center gap-3">
        <Spinner className="size-6" />
        Loading mapped course and replay evidence…
      </span>
    </main>
  );
}
