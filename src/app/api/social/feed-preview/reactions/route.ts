import { addFeedReaction, removeFeedReaction } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mutateReaction(request, "add");
}

export async function DELETE(request: Request) {
  return mutateReaction(request, "remove");
}

async function mutateReaction(request: Request, action: "add" | "remove") {
  try {
    const { feedItemId } = (await request.json()) as { feedItemId?: unknown };

    if (typeof feedItemId !== "string" || !feedItemId.trim()) {
      return Response.json({ error: "feedItemId is required." }, { status: 400 });
    }

    if (action === "add") {
      await addFeedReaction(feedItemId.trim());
    } else {
      await removeFeedReaction(feedItemId.trim());
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to update kudos." }, { status: 400 });
  }
}
