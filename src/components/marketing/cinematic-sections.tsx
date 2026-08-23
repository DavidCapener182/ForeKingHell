import { ArrowUpRight, BadgeCheck, Database, Flag, ShieldCheck, Target } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { marketingJoinBetaHref } from "@/lib/marketing-links";

import cinematic from "./cinematic.module.css";
import { Reveal } from "./reveal";

const loop = [
  ["01", "Import", "Keep the original shot evidence."],
  ["02", "Trust", "Separate the clean sample from the noise."],
  ["03", "Practise", "Give the next range session one job."],
  ["04", "Play", "Take the number to the first tee."],
] as const;

const capabilities = [
  {
    number: "01",
    title: "Import",
    body: "Bring launch-monitor sessions into one traceable history.",
  },
  {
    number: "02",
    title: "Analyse",
    body: "Read patterns, progress, gapping and strokes gained without hiding the sample.",
  },
  {
    number: "03",
    title: "Improve",
    body: "Turn the strongest signal into a focused practice prescription.",
  },
  {
    number: "04",
    title: "Plan",
    body: "Carry trusted numbers into strategy, rounds and the Course Twin pilot.",
  },
] as const;

const productScreens = [
  {
    number: "01",
    eyebrow: "Today",
    title: "Read the latest measured signal.",
    body: "The live decision surface pulls the strongest change from the latest review and keeps the underlying evidence one click away.",
    image: "/assets/landing/product-today.avif",
    alt: "LM World Tour Today screen showing a measured session review and decision confidence",
    focusLabel: "Latest signal",
    focusTitle: "Better than your previous baseline",
  },
  {
    number: "02",
    eyebrow: "Bag",
    title: "Trust only the numbers ready to play.",
    body: "Club confidence, playable yardages, gaps and the next bag action come from the same measured shot history.",
    image: "/assets/landing/product-bag.avif",
    alt: "LM World Tour Bag screen showing trusted club numbers, bag health and the distance ladder",
    focusLabel: "Bag confidence",
    focusTitle: "9 of 10 clubs have trusted numbers",
  },
  {
    number: "03",
    eyebrow: "Practice Planner",
    title: "Give the next session one clear job.",
    body: "The planner uses the current goal, latest weakness and available time to build a programme that can be scored after the next upload.",
    image: "/assets/landing/product-practice.avif",
    alt: "LM World Tour Practice Planner screen showing a structured training programme and its evidence context",
    focusLabel: "Practice plan",
    focusTitle: "One clear job. Scored after upload.",
  },
] as const;

const practiceBlocks = [
  ["01", "Warm up", "8 shots", "Find the strike before the test starts."],
  ["02", "Start line", "10 shots", "Hold one window and score every attempt."],
  ["03", "Driver test", "15 measured shots", "Test the current signal under a clear constraint."],
  ["04", "Review", "Against baseline", "Upload once and compare the result with the evidence."],
] as const;
const practicePhases = ["intro", "line", "zone", "resolve"] as const;

export function BrandPromise() {
  return (
    <section
      id="how-it-works"
      className={cinematic.promise}
      aria-labelledby="promise-title"
      data-scroll-pause="promise"
    >
      <div className={cinematic.promiseStage}>
        <div className={cinematic.promiseImage} aria-hidden>
          <Image
            src="/assets/landing/promise-walk.avif"
            alt=""
            fill
            sizes="100vw"
            data-scene-parallax
          />
          <span />
        </div>
        <Reveal className={cinematic.promiseLead} from="left">
          <p className={cinematic.kicker}>Range to first tee</p>
          <h2 id="promise-title">
            Your numbers should do more than <span>sit in a dashboard.</span>
          </h2>
        </Reveal>
        <div className={cinematic.loopRail}>
          <div
            className={cinematic.evidenceAxis}
            aria-hidden
            data-scene-vars="intro line zone resolve"
          >
            <span />
            <span />
          </div>
          <div className={cinematic.evidenceCore} data-scene-vars="intro line zone resolve">
            <Database aria-hidden />
            <small>One traceable record</small>
            <strong>Same evidence</strong>
          </div>
          {loop.map(([number, title, detail], index) => (
            <Reveal
              as="article"
              className={cinematic.loopStep}
              from={index % 2 ? "right" : "left"}
              key={number}
              sceneVars={practicePhases[index]}
            >
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal as="p" className={cinematic.promiseCoda} from="scale">
          Same evidence. Four better decisions.
        </Reveal>
      </div>
    </section>
  );
}

export function PracticeShowcase() {
  return (
    <section
      id="practice"
      className={cinematic.practice}
      aria-labelledby="practice-title"
      data-scroll-pause="practice"
    >
      <div className={cinematic.practiceStage}>
        <div className={cinematic.practiceMedia}>
          <Image
            src="/assets/landing/practice-job.avif"
            alt="Golfer setting up a measured range practice station with alignment rods and a launch monitor"
            fill
            sizes="(max-width: 767px) 100vw, 66vw"
            data-scene-progress
          />
          <span className={cinematic.practiceShade} aria-hidden />
          <div className={cinematic.rangeCaption}>
            <Target aria-hidden />
            <span>Alignment · target · evidence</span>
          </div>
        </div>
        <Reveal className={cinematic.practiceCopy} from="right">
          <p className={cinematic.kicker}>Practice with a job</p>
          <h2 id="practice-title">Stop beating balls. Start testing a signal.</h2>
          <p>
            LM World Tour turns the clearest session pattern into a focused block you can run,
            measure and review against the next import.
          </p>
          <article className={cinematic.practicePrescription} aria-label="Today's practice plan">
            <header>
              <span>Today&apos;s practice · Driver</span>
              <BadgeCheck aria-hidden />
            </header>
            <strong>Build one session. Test one signal.</strong>
            <ul className={cinematic.practiceWorkflow} data-scene-progress>
              {practiceBlocks.map(([number, title, measure, detail], index) => (
                <li
                  key={number}
                  data-practice-step={number}
                  data-scene-vars={practicePhases[index]}
                >
                  <span>{number}</span>
                  <div>
                    <p>
                      <b>{title}</b>
                      <em>{measure}</em>
                    </p>
                    <small>{detail}</small>
                  </div>
                </li>
              ))}
            </ul>
          </article>
          <a className={cinematic.textLink} href="#product-screens">
            See it in the current product <ArrowUpRight aria-hidden />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

export function ProductScreensShowcase() {
  return (
    <section
      id="product-screens"
      className={cinematic.productScreens}
      aria-labelledby="product-screens-title"
    >
      <div className={cinematic.productScreensIntro} data-scroll-pause="product-intro">
        <div className={cinematic.productScreensIntroStage}>
          <div className={cinematic.productScreensIntroImage} aria-hidden>
            <Image
              src="/assets/landing/product-review.avif"
              alt=""
              fill
              sizes="100vw"
              data-scene-parallax
            />
            <span />
          </div>
          <Reveal className={cinematic.productScreensHeading} from="left">
            <h2 id="product-screens-title">See the decision chain in the product.</h2>
          </Reveal>
        </div>
      </div>
      <div className={cinematic.productScreenList}>
        {productScreens.map((screen, index) => (
          <article
            className={cinematic.productScreenCard}
            key={screen.eyebrow}
            data-immersive={index === 0 ? "true" : "false"}
            data-scroll-pause={index === 0 ? `product-${screen.number}` : undefined}
          >
            <div className={cinematic.productScreenStage}>
              <div className={cinematic.productScreenBackdrop} aria-hidden>
                <Image src={screen.image} alt="" fill sizes="100vw" data-scene-parallax />
                <span />
              </div>
              <Reveal
                className={cinematic.productScreenCopy}
                from={index % 2 ? "right" : "left"}
                sceneVars="ui"
              >
                <span>{screen.number}</span>
                <p>{screen.eyebrow}</p>
                <h3>{screen.title}</h3>
                <p>{screen.body}</p>
              </Reveal>
              <Reveal className={cinematic.productScreenshot} from="scale">
                <Image
                  src={screen.image}
                  alt={screen.alt}
                  width={1440}
                  height={900}
                  sizes="80vw"
                  data-scene-vars="zone"
                />
                <div
                  className={cinematic.productFocusCard}
                  aria-hidden
                  data-scene-vars="resolve ui"
                >
                  <span>{screen.focusLabel}</span>
                  <strong>{screen.focusTitle}</strong>
                  <i data-scene-vars="ui" />
                </div>
              </Reveal>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EditorialFeatureGrid() {
  return (
    <section id="features" className={cinematic.editorial} aria-labelledby="features-title">
      <div className={cinematic.editorialIntroPause} data-scroll-pause="workspace">
        <div className={cinematic.editorialIntroStage}>
          <div className={cinematic.editorialIntroImage} aria-hidden>
            <Image
              src="/assets/landing/connected-bag.avif"
              alt=""
              fill
              sizes="100vw"
              data-scene-parallax
            />
            <span />
          </div>
          <Reveal className={cinematic.editorialHeading} from="left">
            <p className={cinematic.kicker}>Beyond the core loop</p>
            <h2 id="features-title">
              The rest of the product stays connected to the same evidence.
            </h2>
          </Reveal>
          <Reveal as="article" className={cinematic.capabilityManifest} from="up">
            <p className={cinematic.kicker}>The connected workspace</p>
            <div>
              {capabilities.map(({ number, title, body }) => (
                <section key={title}>
                  <span className={cinematic.capabilityNumber} aria-hidden>
                    {number}
                  </span>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </section>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      <div className={cinematic.editorialSupportPause} data-scroll-pause="support">
        <div className={cinematic.editorialGrid}>
          <div className={cinematic.editorialSupportImage} aria-hidden>
            <Image
              src="/assets/landing/connected-bag.avif"
              alt=""
              fill
              sizes="100vw"
              data-scene-parallax
            />
            <span />
          </div>
          <Reveal as="article" className={cinematic.communityFeature} from="left">
            <div>
              <Flag aria-hidden />
              <span id="community">Community, after the golf</span>
            </div>
            <h3>Compete on evidence, not noise.</h3>
            <p>
              Challenges, groups, records, achievements and tournaments stay connected to actual
              golf activity.
            </p>
            <Link href={marketingJoinBetaHref}>Join the beta</Link>
          </Reveal>

          <Reveal as="article" className={cinematic.evidenceFeature} from="right">
            <ShieldCheck aria-hidden />
            <p>Measured</p>
            <p>Reconstructed</p>
            <p>Modelled</p>
            <strong>Never quietly conflated.</strong>
          </Reveal>

          <Reveal as="article" className={cinematic.dataFeature} from="scale">
            <Database aria-hidden />
            <span>Data Chat</span>
            <strong>Explain the record. Never alter it.</strong>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
