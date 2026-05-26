import { getOptionalCurrentUserId } from "@/lib/current-user";
import { BRAND_NAME } from "@/lib/brand";
import { getVisibleFeedItemsForViewer } from "@/lib/social";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    feedItemId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const userId = await getOptionalCurrentUserId();

  if (!userId) {
    return Response.json({ message: "Authentication required." }, { status: 401 });
  }

  const { feedItemId } = await context.params;
  const item = (await getVisibleFeedItemsForViewer(userId, { limit: 80 })).find(
    (candidate) => candidate.id === feedItemId,
  );

  if (!item) {
    return Response.json({ message: "Feed item not found." }, { status: 404 });
  }

  const svg = renderShareCardSvg({
    title: item.headline,
    metricLabel: item.metricLabel ?? BRAND_NAME,
    metricValue: item.metricValue ?? item.verificationLabel,
    context: item.context ?? item.verificationLabel,
    footer: `${item.verificationLabel} · @${item.profile.username}`,
  });

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "private, max-age=60",
    },
  });
}

function renderShareCardSvg(input: {
  title: string;
  metricLabel: string;
  metricValue: string;
  context: string;
  footer: string;
}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f7f8fa"/>
  <rect x="48" y="48" width="1104" height="534" rx="26" fill="#ffffff" stroke="#dfe5ec" stroke-width="2"/>
  <circle cx="1012" cy="152" r="70" fill="#dcfce7"/>
  <circle cx="1084" cy="210" r="48" fill="#bae6fd"/>
  <text x="96" y="128" font-family="Geist, Arial, sans-serif" font-size="30" font-weight="700" fill="#111827">${escapeXml(BRAND_NAME)}</text>
  <text x="96" y="218" font-family="Geist, Arial, sans-serif" font-size="56" font-weight="800" fill="#111827">${escapeXml(input.title)}</text>
  <text x="96" y="316" font-family="Geist, Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="4" fill="#6b7280">${escapeXml(input.metricLabel.toUpperCase())}</text>
  <text x="96" y="400" font-family="Geist, Arial, sans-serif" font-size="74" font-weight="800" fill="#16a34a">${escapeXml(input.metricValue)}</text>
  <text x="96" y="472" font-family="Geist, Arial, sans-serif" font-size="30" fill="#374151">${escapeXml(input.context)}</text>
  <text x="96" y="538" font-family="Geist, Arial, sans-serif" font-size="24" fill="#6b7280">${escapeXml(input.footer)}</text>
</svg>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
