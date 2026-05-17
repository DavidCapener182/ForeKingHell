import { getDashboardFeedPreview } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await getDashboardFeedPreview(40);

    return Response.json(
      {
        items: items.map((item) => ({
          id: item.id,
          userId: item.userId,
          itemType: item.itemType,
          headline: item.headline,
          metricLabel: item.metricLabel,
          metricValue: item.metricValue,
          context: item.context,
          proofUrl: item.proofUrl?.startsWith("data:image/") ? null : item.proofUrl,
          visibility: item.visibility,
          verificationLabel: item.verificationLabel,
          createdAt: item.createdAt.toISOString(),
          profile: item.profile,
          reactionCount: item.reactionCount,
          commentCount: item.commentCount,
          viewerReacted: item.viewerReacted,
          comments: item.comments.map((comment) => ({
            ...comment,
            createdAt: comment.createdAt.toISOString(),
          })),
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { items: [] },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
