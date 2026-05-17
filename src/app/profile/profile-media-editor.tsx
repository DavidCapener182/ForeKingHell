"use client";

import Link from "next/link";
import { type ChangeEvent, useRef, useState } from "react";
import { Camera, ImageIcon, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials } from "@/components/social/social-avatar";

const AVATAR_SIZE = 256;
const HEADER_SIZE = {
  width: 1200,
  height: 360,
};
const MAX_DATA_URL_LENGTH = 650_000;
const TOUR_COVER_COUNT = 10;

export function ProfileMediaEditor({
  displayName,
  username,
  initialAvatarUrl,
  initialHeaderImageUrl,
  publicHref,
  formId,
}: {
  displayName: string;
  username: string;
  initialAvatarUrl?: string | null;
  initialHeaderImageUrl?: string | null;
  publicHref: string;
  formId: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [headerImageUrl, setHeaderImageUrl] = useState(initialHeaderImageUrl ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>, target: "avatar" | "header") {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setStatus("Choose an image file.");
      event.target.value = "";
      return;
    }

    try {
      const nextUrl =
        target === "avatar"
          ? await resizeImage(file, AVATAR_SIZE, AVATAR_SIZE, 0.84)
          : await resizeImage(file, HEADER_SIZE.width, HEADER_SIZE.height, 0.76);

      if (target === "avatar") {
        setAvatarUrl(nextUrl);
        setStatus("Avatar photo ready. Save profile to keep it.");
      } else {
        setHeaderImageUrl(nextUrl);
        setStatus("Header photo ready. Save profile to keep it.");
      }
    } catch {
      setStatus("That photo could not be loaded.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="relative overflow-hidden">
      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handlePhotoChange(event, "avatar")} />
      <input ref={headerInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handlePhotoChange(event, "header")} />
      <input form={formId} type="hidden" name="avatarUrl" value={avatarUrl} readOnly />
      <input form={formId} type="hidden" name="headerImageUrl" value={headerImageUrl} readOnly />

      <div
        className="relative h-36 bg-cover bg-center"
        style={{ backgroundImage: profileHeaderBackground(profileHeaderImageUrl(headerImageUrl, username)) }}
      >
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="bg-white/95 shadow-sm hover:bg-white"
            onClick={() => headerInputRef.current?.click()}
          >
            <ImageIcon className="size-4" />
            {headerImageUrl ? "Change header" : "Add header"}
          </Button>
          {headerImageUrl ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="bg-white/95 shadow-sm hover:bg-white"
              aria-label="Remove header photo"
              onClick={() => {
                setHeaderImageUrl("");
                setStatus("Header photo removed. Save profile to keep it removed.");
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-4 pt-4">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            className="group relative -mt-14 shrink-0 rounded-full bg-white p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Choose avatar photo"
            onClick={() => avatarInputRef.current?.click()}
          >
            <Avatar className="size-20 border-4 border-white bg-white shadow-md ring-1 ring-slate-950/10">
              {avatarUrl ? (
                <ProfileEditorAvatarImage src={avatarUrl} />
              ) : (
                <AvatarFallback className="bg-[#111827] text-lg font-semibold tracking-normal text-white">
                  {initials(displayName, username)}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-white bg-[#0B7A3B] text-white shadow-sm transition-colors group-hover:bg-[#064E3B]">
              <Camera className="size-4" />
            </span>
          </button>

          <div className="min-w-0 pt-1">
            <h2 className="truncate text-2xl font-semibold tracking-normal">{displayName}</h2>
            <p className="text-sm text-muted-foreground">@{username}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>
                <Camera className="size-4" />
                {avatarUrl ? "Change avatar" : "Add avatar"}
              </Button>
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAvatarUrl("");
                    setStatus("Avatar photo removed. Save profile to keep it removed.");
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Button asChild variant="outline" className="mb-1 bg-white">
          <Link href={publicHref} prefetch={false}>Preview public page</Link>
        </Button>
      </div>

      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      {status ? <p className="px-5 pb-4 text-xs text-muted-foreground">{status}</p> : null}
    </div>
  );
}

function ProfileEditorAvatarImage({ src }: { src: string }) {
  if (src.startsWith("data:image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="aspect-square size-full rounded-full object-cover" />;
  }

  return <AvatarImage src={src} alt="" />;
}

function profileHeaderBackground(imageUrl: string) {
  return `linear-gradient(90deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0)), url("${imageUrl.replace(/"/g, "%22")}")`;
}

function profileHeaderImageUrl(headerImageUrl: string, username: string) {
  return headerImageUrl || tourCoverForKey(username);
}

function tourCoverForKey(key: string) {
  let hash = 0;

  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % TOUR_COVER_COUNT;
  }

  return `/assets/tour-covers/tour-cover-${String(hash + 1).padStart(2, "0")}.webp`;
}

async function resizeImage(file: File, width: number, height: number, quality: number) {
  const image = await loadImage(await readFileAsDataUrl(file));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#F8FAFC";
  context.fillRect(0, 0, width, height);

  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const drawX = (width - drawWidth) / 2;
  const drawY = (height - drawHeight) / 2;

  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
    return dataUrl;
  }

  const compressedDataUrl = canvas.toDataURL("image/jpeg", Math.max(0.58, quality - 0.18));

  if (compressedDataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Photo is too large.");
  }

  return compressedDataUrl;
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
