import { addFeedComment, deleteFeedComment } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { feedItemId, body } = (await request.json()) as {
      feedItemId?: unknown;
      body?: unknown;
    };

    if (typeof feedItemId !== "string" || !feedItemId.trim()) {
      return Response.json({ error: "feedItemId is required." }, { status: 400 });
    }

    if (typeof body !== "string" || !body.trim()) {
      return Response.json({ error: "Comment cannot be empty." }, { status: 400 });
    }

    await addFeedComment(feedItemId.trim(), body.trim());

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to post comment." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { commentId } = (await request.json()) as {
      commentId?: unknown;
    };

    if (typeof commentId !== "string" || !commentId.trim()) {
      return Response.json({ error: "commentId is required." }, { status: 400 });
    }

    await deleteFeedComment(commentId.trim());

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to delete comment." }, { status: 400 });
  }
}
