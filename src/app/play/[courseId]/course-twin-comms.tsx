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
          });
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
    const poll = async () => {
      const response = await fetch(`/api/course-twins/rooms/${roomId}/events`, {
        cache: "no-store",
      });
      if (!active || !response.ok) return;
      const body = (await response.json()) as { events?: RoomEvent[] };
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
    };
    void poll();
    const interval = window.setInterval(() => void poll(), 2_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [currentUserId, ensurePeer, postEvent, roomId]);

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
      setVoiceError("Microphone access was not granted.");
    }
  };

  const disableVoice = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((peer) => peer.close());
    peersRef.current.clear();
    setVoiceEnabled(false);
    void postEvent("voice.leave", {});
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    setMessage("");
    await postEvent("chat.message", { text });
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
          className="h-7 !border-white/15 !bg-transparent px-2 text-[11px] !text-white"
          onClick={voiceEnabled ? disableVoice : enableVoice}
        >
          {voiceEnabled ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
          {voiceEnabled ? "Voice on" : "Enable voice"}
        </Button>
      </div>
      <div className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-emerald-100/70">
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
          <p>No messages yet.</p>
        )}
      </div>
      <div className="flex gap-1.5">
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void sendMessage();
          }}
          maxLength={500}
          aria-label="Group chat message"
          placeholder="Message the group"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/20 px-2 text-xs text-white outline-none placeholder:text-white/35"
        />
        <Button type="button" size="icon" className="size-8" onClick={() => void sendMessage()}>
          <Send className="size-3.5" />
          <span className="sr-only">Send message</span>
        </Button>
      </div>
      {voiceError ? <p className="text-[11px] text-amber-200">{voiceError}</p> : null}
      <p className="text-[10px] leading-4 text-emerald-100/45">
        Voice is peer-to-peer. Browsers exchange connection details through this room; audio is not
        stored by ForeKingHell.
      </p>
    </div>
  );
}
