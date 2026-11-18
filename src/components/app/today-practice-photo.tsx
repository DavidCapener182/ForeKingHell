import Image from "next/image";

export function TodayPracticePhoto() {
  return (
    <div aria-hidden="true" className="relative h-28 overflow-hidden bg-[#415640] sm:h-auto">
      <Image
        alt=""
        src="/assets/landing/practice-range.avif"
        fill
        sizes="(max-width: 640px) 100vw, 400px"
        loading="eager"
        className="object-cover object-[21%_49%]"
      />
    </div>
  );
}
