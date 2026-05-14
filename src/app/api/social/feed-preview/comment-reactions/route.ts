import { addFeedCommentReaction, removeFeedCommentReaction } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mutateCommentReaction(request, "add");
}

export async function DELETE(request: Request) {
  return mutateCommentReaction(request, "remove");
}

async function mutateCommentReaction(request: Request, action: "add" | "remove") {
  try {
    const { commentId } = (await request.json()) as { commentId?: unknown };

    if (typeof commentId !== "string" || !commentId.trim()) {
      return Response.json({ error: "commentId is required." }, { status: 400 });
    }

    if (action === "add") {
      await addFeedCommentReaction(commentId.trim());
    } else {
      await removeFeedCommentReaction(commentId.trim());
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to update comment like." }, { status: 400 });
  }
}
