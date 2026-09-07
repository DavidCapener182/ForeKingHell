import Link from "next/link";
import type { WorkbenchBreadcrumb } from "@/lib/workbench-breadcrumbs";
export function WorkbenchBreadcrumbs({ items: breadcrumbItems }: { items: WorkbenchBreadcrumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      <Link
        href="/dashboard"
        className="focus-aaa inline-flex min-h-11 items-center rounded-md px-2 py-1 font-semibold text-foreground outline-none hover:bg-muted/55"
      >
        Home
      </Link>
      {breadcrumbItems.map((item, index) => {
        const isLast = index === breadcrumbItems.length - 1;

        return (
          <span
            key={`${item.label}-${item.href ?? index}`}
            className="flex min-w-0 items-center gap-2"
          >
            <span className="text-muted-foreground" aria-hidden>
              /
            </span>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="focus-aaa inline-flex min-h-11 min-w-0 items-center rounded-md px-2 py-1 font-medium text-muted-foreground outline-none hover:bg-muted/55 hover:text-foreground"
              >
                <span className="break-words">{item.label}</span>
              </Link>
            ) : (
              <span
                className="min-w-0 break-words rounded-md px-2 py-1 font-medium text-muted-foreground"
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
