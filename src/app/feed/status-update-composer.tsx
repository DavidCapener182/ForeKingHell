"use client";

import { type ChangeEvent, useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, Send, Trash2 } from "lucide-react";

import { createStatusUpdateAction } from "@/app/feed/actions";
import { SocialAvatar } from "@/components/social/social-avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDetailPanel } from "@/components/app/responsive-detail-panel";
import { useClientReady } from "@/hooks/use-client-ready";
import { cn } from "@/lib/utils";

type VisibilityOption = "private" | "friends" | "public";
type StatusUpdateComposerState = {
  status: "idle" | "success" | "error";
  message: string;
  resetKey: string;
};

const initialState: StatusUpdateComposerState = {
  status: "idle",
  message: "",
  resetKey: "initial",
};
const visibilityOptions: VisibilityOption[] = ["private", "friends", "public"];
const MAX_BODY_LENGTH = 800;
const MAX_SOURCE_IMAGE_BYTES = 12_000_000;
const MAX_STATUS_IMAGE_EDGE = 1280;
const MAX_DATA_URL_LENGTH = 650_000;

export function StatusUpdateComposerSheet({
  displayName,
  username,
  avatarUrl,
  defaultVisibility,
}: {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  defaultVisibility: VisibilityOption;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = useClientReady();
  return (
    <>
      <Button disabled={!ready} onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Create post
      </Button>
      <ResponsiveDetailPanel
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Create a feed post"
        description="Choose the audience, review your update and explicitly publish."
      >
        <StatusUpdateComposer
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          defaultVisibility={defaultVisibility}
          className="shadow-none"
          onBusyChange={setBusy}
        />
      </ResponsiveDetailPanel>
    </>
  );
}

export function StatusUpdateComposer({
  displayName,
  username,
  avatarUrl,
  defaultVisibility,
  variant = "desktop",
  className,
  onBusyChange,
}: {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  defaultVisibility: VisibilityOption;
  variant?: "desktop" | "mobile";
  className?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(createStatusUpdateAction, initialState);
  useEffect(() => {
    onBusyChange?.(pending);
  }, [pending, onBusyChange]);

  return (
    <StatusUpdateComposerFields
      key={state.resetKey}
      avatarUrl={avatarUrl}
      className={className}
      defaultVisibility={defaultVisibility}
      displayName={displayName}
      formAction={formAction}
      pending={pending}
      state={state}
      username={username}
      variant={variant}
    />
  );
}

function StatusUpdateComposerFields({
  displayName,
  username,
  avatarUrl,
  defaultVisibility,
  variant,
  className,
  state,
  formAction,
  pending,
}: {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  defaultVisibility: VisibilityOption;
  variant: "desktop" | "mobile";
  className?: string;
  state: StatusUpdateComposerState;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const [body, setBody] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageStatus, setImageStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ready = useClientReady();
  const [review, setReview] = useState(false);
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [preparing, setPreparing] = useState(false);
  const imageRequest = useRef(0);
  const compact = variant === "mobile";
  const canPost = body.trim().length > 0 || imageDataUrl.length > 0;

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setImageStatus("Choose a JPG, PNG or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setImageStatus("Choose an image under 12 MB.");
      event.target.value = "";
      return;
    }

    const request = ++imageRequest.current;
    setPreparing(true);
    setImageStatus("Preparing image…");
    try {
      const resized = await resizeStatusImage(file);
      if (request !== imageRequest.current) return;
      setImageDataUrl(resized);
      setImageStatus("Image ready.");
    } catch {
      if (request !== imageRequest.current) return;
      setImageStatus("That image could not be prepared.");
    } finally {
      if (request === imageRequest.current) setPreparing(false);
      event.target.value = "";
    }
  }

  return (
    <Card className={cn("py-0", compact && "rounded-2xl", className)}>
      <form
        action={formAction}
        className="p-4"
        aria-busy={pending || preparing}
        onSubmit={(event) => {
          if (!review) {
            event.preventDefault();
            setReview(true);
          }
        }}
      >
        {review ? (
          <section className="mb-4 grid gap-3 rounded-xl border p-3" aria-label="Review feed post">
            <h3 className="font-semibold">Review your post</h3>
            <p className="whitespace-pre-wrap break-words">{body || "Photo update"}</p>
            <p>Audience: {visibility}</p>
            <p className="text-sm text-muted-foreground">
              This update will be published only when you confirm below.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setReview(false)}
            >
              Edit draft
            </Button>
          </section>
        ) : null}
        <input type="hidden" name="visibility" value={visibility} />
        <input type="hidden" name="imageDataUrl" value={imageDataUrl} readOnly />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleImageChange}
        />

        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <SocialAvatar
            displayName={displayName}
            username={username}
            avatarUrl={avatarUrl}
            href="/profile"
            size={compact ? "sm" : "md"}
          />
          <div className="grid gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Post a status update</p>
              <p className="text-xs text-muted-foreground">
                Share a range note, round recap, swing feel or golf photo.
              </p>
            </div>
            <Textarea
              aria-label="Post text"
              disabled={pending}
              readOnly={review}
              name="body"
              value={body}
              maxLength={MAX_BODY_LENGTH}
              rows={compact ? 3 : 4}
              placeholder="What changed in your game today?"
              className="resize-none rounded-xl bg-background"
              onChange={(event) => setBody(event.target.value)}
            />

            {imageDataUrl ? (
              <div className="overflow-hidden rounded-xl border border-border bg-muted/45">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageDataUrl} alt="" className="max-h-80 w-full object-contain" />
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-xs text-muted-foreground">
                    {imageStatus ?? "Image ready."}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    disabled={pending || review}
                    onClick={() => {
                      imageRequest.current += 1;
                      setPreparing(false);
                      setImageDataUrl("");
                      setImageStatus(null);
                    }}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  disabled={pending || preparing || review}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                  {imageDataUrl ? "Change image" : "Add image"}
                </Button>
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <span>Visibility</span>
                  <select
                    aria-label="Post visibility"
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value as VisibilityOption)}
                    disabled={pending || review}
                    className="min-h-11 min-w-0 rounded-lg border bg-background px-3 text-sm"
                  >
                    {visibilityOptions.map((option) => (
                      <option key={option} value={option}>
                        {titleCase(option)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {body.length}/{MAX_BODY_LENGTH}
                </span>
                <Button
                  type="submit"
                  disabled={!ready || pending || preparing || !canPost}
                  size="sm"
                  className="min-h-11"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {review ? "Confirm publish" : "Review post"}
                </Button>
              </div>
            </div>

            {imageStatus && !imageDataUrl ? (
              <p className="text-xs text-muted-foreground">{imageStatus}</p>
            ) : null}
            {state.message ? (
              <Alert
                variant={state.status === "error" ? "destructive" : "default"}
                aria-live="polite"
              >
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>
      </form>
    </Card>
  );
}

async function resizeStatusImage(file: File) {
  const image = await loadImage(await readFileAsDataUrl(file));
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const scale = Math.min(1, MAX_STATUS_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#F8FAFC";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  for (const quality of [0.84, 0.74, 0.64, 0.56]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      return dataUrl;
    }
  }

  throw new Error("Image is too large.");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = src;
  });
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
