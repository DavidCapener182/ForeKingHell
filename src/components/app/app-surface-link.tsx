import type { ComponentProps } from "react";

type AppSurfaceLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: `/surface/${string}`;
};

/** Surface changes need a document navigation so the server remounts the selected app shell. */
export function AppSurfaceLink({ href, ...props }: AppSurfaceLinkProps) {
  return <a href={href} {...props} />;
}
