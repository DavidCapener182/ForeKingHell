export type WorkbenchBreadcrumb = { label: string; href?: string };
export function buildWorkbenchBreadcrumbItems(
  root: WorkbenchBreadcrumb | undefined,
  pathname: string,
): WorkbenchBreadcrumb[] {
  const items: WorkbenchBreadcrumb[] = root ? [{ ...root }] : [];
  const add = (label: string, href: string) => {
    if (!items.some((item) => item.href === href)) items.push({ label, href });
  };
  const club = /^(\/bag\/[^/]+)\/analytics$/.exec(pathname);
  if (club) add("Club profile", club[1]);
  const course = /^(\/courses\/[^/]+)\/(holes|records|shot-pattern|tournaments)(?:\/[^/]+)?$/.exec(
    pathname,
  );
  if (course) {
    add("Course detail", course[1]);
    if (course[2] === "records" && pathname !== `${course[1]}/records`)
      add("Course records", `${course[1]}/records`);
  }
  const event = /^(\/tournaments\/[^/]+)\/(leaderboard|rounds|rules|submit)$/.exec(pathname);
  if (event) add("Event detail", event[1]);
  const detail = deepRouteLabel(pathname);
  if (detail && items.at(-1)?.label !== detail) items.push({ label: detail });
  return items;
}
function deepRouteLabel(pathname: string) {
  if (/^\/sessions\/[^/]+$/.test(pathname)) return "Session review";
  if (pathname === "/bag/longest") return "Best shots";
  if (/^\/bag\/[^/]+\/analytics$/.test(pathname)) return "Club analytics";
  if (/^\/bag\/[^/]+$/.test(pathname)) return "Club profile";
  if (pathname === "/rounds/new") return "New round";
  if (/^\/rounds\/[^/]+$/.test(pathname)) return "Round review";
  if (pathname === "/courses/new") return "New course";
  if (pathname === "/courses/strategy") return "Course Strategy";
  if (/^\/courses\/[^/]+\/holes$/.test(pathname)) return "Hole management";
  if (/^\/courses\/[^/]+\/records\/[^/]+$/.test(pathname)) return "Record detail";
  if (/^\/courses\/[^/]+\/records$/.test(pathname)) return "Course records";
  if (/^\/courses\/[^/]+\/shot-pattern$/.test(pathname)) return "Shot pattern";
  if (/^\/courses\/[^/]+\/tournaments$/.test(pathname)) return "Course tournaments";
  if (/^\/courses\/[^/]+$/.test(pathname)) return "Course detail";
  if (/^\/course-records\/[^/]+$/.test(pathname)) return "Record detail";
  if (/^\/tournaments\/[^/]+\/leaderboard$/.test(pathname)) return "Event leaderboard";
  if (/^\/tournaments\/[^/]+\/rounds$/.test(pathname)) return "Event rounds";
  if (/^\/tournaments\/[^/]+\/rules$/.test(pathname)) return "Event rules";
  if (/^\/tournaments\/[^/]+\/submit$/.test(pathname)) return "Submit round";
  if (/^\/tournaments\/[^/]+$/.test(pathname)) return "Event detail";
  if (/^\/speed\/sessions\/[^/]+$/.test(pathname)) return "Speed session";
  if (/^\/groups\/[^/]+$/.test(pathname)) return "Group detail";
  if (/^\/profile\/[^/]+$/.test(pathname)) return "Public profile";
  if (/^\/friends\/qr\/[^/]+$/.test(pathname)) return "Friend invite";
  if (/^\/settings\/invitations\/[^/]+$/.test(pathname)) return "Invitation";

  return null;
}
