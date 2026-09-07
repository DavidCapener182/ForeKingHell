"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Mic, MicOff, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

type RoomMember = { userId: string; displayName: string; role: string };
type RoomEvent = {
  id: string;
  userId: string | null;
  eventType: string;
  payloadJson: Record<string, unknown>;
  createdAt: string;
};

export function CourseTwinComms({
  roomId,
  currentUserId,
  members,
}: {
  roomId: string;
  currentUserId: string;
  members: RoomMember[];
}) {
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [message, setMessage] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [connected, setConnected] = useState(false);
  const [voicePending, setVoicePending] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const audioRef = useRef(new Map<string, HTMLAudioElement>());
  const processedEventsRef = useRef(new Set<string>());

  const postEvent = useCallback(
    async (type: string, payload: Record<string, unknown>) => {
      const response = await fetch(`/api/course-twins/rooms/${roomId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload }),
      });
      if (!response.ok) throw new Error("Group communication could not be sent.");
    },
    [roomId],
  );

  const ensurePeer = useCallback(
    (peerUserId: string) => {
      const existing = peersRef.current.get(peerUserId);
      if (existing) return existing;
      const peer = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      for (const track of localStreamRef.current?.getTracks() ?? []) {
        peer.addTrack(track, localStreamRef.current as MediaStream);
      }
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          void postEvent("voice.ice", {
            targetUserId: peerUserId,
            candidate: event.candidate.toJSON(),
          }).catch(() =>
            setVoiceError("Voice connection details could not be sent. Turn voice off and retry."),
          );
        }
      };
      peer.ontrack = (event) => {
        let audio = audioRef.current.get(peerUserId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audioRef.current.set(peerUserId, audio);
        }
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => undefined);
      };
      peersRef.current.set(peerUserId, peer);
      return peer;
    },
    [postEvent],
  );

  useEffect(() => {
    let active = true;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const response = await fetch(`/api/course-twins/rooms/${roomId}/events`, {
          cache: "no-store",
        });
        if (!active) return;
        if (!response.ok)
          throw new Error(
            response.status === 403
              ? "This room is no longer available to your account."
              : "Messages could not refresh. Retrying automatically; saved messages remain below.",
          );
        const body = (await response.json()) as { events?: RoomEvent[] };
        if (!active) return;
        setPollError(null);
        setConnected(true);
        const next = body.events ?? [];
        setEvents(next.filter((event) => event.eventType === "chat.message").slice(-30));
        if (!localStreamRef.current) return;
        for (const event of next) {
          if (processedEventsRef.current.has(event.id) || event.userId === currentUserId) continue;
          processedEventsRef.current.add(event.id);
          const target = event.payloadJson.targetUserId;
          if (target !== currentUserId || !event.userId) continue;
          const peer = ensurePeer(event.userId);
          try {
            if (event.eventType === "voice.offer" && typeof event.payloadJson.sdp === "string") {
              await peer.setRemoteDescription({ type: "offer", sdp: event.payloadJson.sdp });
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              await postEvent("voice.answer", { targetUserId: event.userId, sdp: answer.sdp });
            } else if (
              event.eventType === "voice.answer" &&
              typeof event.payloadJson.sdp === "string"
            ) {
              await peer.setRemoteDescription({ type: "answer", sdp: event.payloadJson.sdp });
            } else if (event.eventType === "voice.ice" && event.payloadJson.candidate) {
              await peer.addIceCandidate(
                event.payloadJson.candidate as unknown as RTCIceCandidateInit,
              );
            }
          } catch {
            setVoiceError("Voice connection was interrupted; turn voice off and on to reconnect.");
          }
        }
      } catch (error) {
        if (active)
          setPollError(
            error instanceof Error
              ? error.message
              : "Messages could not refresh. Retry the connection.",
          );
      } finally {
        polling = false;
      }
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUserId, ensurePeer, postEvent, roomId, retry]);

  useEffect(
    () => () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      peersRef.current.forEach((peer) => peer.close());
      audioRef.current.forEach((audio) => {
        audio.srcObject = null;
      });
    },
    [],
  );

  const enableVoice = async () => {
    if (voicePending) return;
    setVoicePending(true);
    try {
      setVoiceError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setVoiceEnabled(true);
      for (const member of members) {
        if (member.userId === currentUserId || currentUserId > member.userId) continue;
        const peer = ensurePeer(member.userId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await postEvent("voice.offer", { targetUserId: member.userId, sdp: offer.sdp });
      }
    } catch {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((peer) => peer.close());
      peersRef.current.clear();
      setVoiceEnabled(false);
      setVoiceError(
        "Voice could not connect. Check microphone permission and connection, then retry.",
      );
    } finally {
      setVoicePending(false);
    }
  };

  const disableVoice = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    setVoiceEnabled(false);
    void postEvent("voice.leave", {}).catch(() =>
      setVoiceError("Voice is off on this device, but the room could not be notified."),
    );
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    setSendError(null);
    try {
      await postEvent("chat.message", { text });
      setMessage((current) => (current.trim() === text ? "" : current));
      setRetry((value) => value + 1);
    } catch {
      setSendError("Message was not sent. Your draft is kept; use Send message to retry.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/15 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-100">
          <MessageCircle className="size-3.5" /> Group chat
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 !border-white/15 !bg-transparent px-2 text-sm !text-white"
          disabled={voicePending}
          aria-pressed={voiceEnabled}
          onClick={voiceEnabled ? disableVoice : enableVoice}
        >
          {voiceEnabled ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
          {voiceEnabled ? "Voice on" : "Enable voice"}
        </Button>
      </div>
      {pollError ? (
        <div role="status" className="text-sm text-amber-200">
          <p>{pollError}</p>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry messages
          </Button>
        </div>
      ) : !connected ? (
        <p role="status" className="text-sm">
          Connecting to group messages…
        </p>
      ) : null}
      <div
        aria-label="Recent group messages"
        className="max-h-48 space-y-1 overflow-y-auto break-words text-sm text-emerald-100/70"
      >
        {events.length ? (
          events.map((event) => (
            <p key={event.id}>
              <span className="font-semibold text-emerald-100">
                {members.find((member) => member.userId === event.userId)?.displayName ?? "Golfer"}:
              </span>{" "}
              {String(event.payloadJson.text ?? "")}
            </p>
          ))
        ) : (
          <p>{connected ? "No messages yet." : "Messages have not loaded yet."}</p>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void sendMessage();
          }}
          disabled={sending}
          maxLength={500}
          aria-label="Group chat message"
          placeholder="Message the group"
          className="min-h-11 min-w-0 flex-1 rounded-md border border-white/15 bg-background px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="button"
          size="icon"
          disabled={sending || !message.trim()}
          aria-busy={sending}
          className="size-11"
          onClick={() => void sendMessage()}
        >
          <Send className="size-3.5" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
      {sending ? (
        <p role="status" className="text-sm">
          Sending message…
        </p>
      ) : null}
      {sendError ? (
        <p role="alert" className="text-sm text-amber-200">
          {sendError}
        </p>
      ) : null}
      {voiceError ? (
        <p role="alert" className="text-sm text-amber-200">
          {voiceError}
        </p>
      ) : null}
      <p className="text-[10px] leading-4 text-emerald-100/45">
        Voice is peer-to-peer. Browsers exchange connection details through this room; audio is not
        stored by ForeKingHell.
      </p>
    </div>
  );
}
