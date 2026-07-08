"use client";

import { ChartAccessibleFallback } from "@/components/app/chart-accessible-fallback";
import { cn } from "@/lib/utils";

export type CourseScorecardSvgHole = {
  holeNumber: number;
  par: number;
  yards: number;
  score?: number | null;
  putts?: number | null;
  penalties?: number | null;
  shotCount?: number | null;
};

export function CourseScorecardSvg({
  className,
  courseName,
  editable = false,
  holes,
  onPenaltiesChange,
  onScoreChange,
  onShotCountChange,
  playerName = "LM World Tour",
  showPenalties = false,
  showShotCounts = false,
  subtitle,
  variant = "full",
}: {
  className?: string;
  courseName: string;
  editable?: boolean;
  holes: CourseScorecardSvgHole[];
  onPenaltiesChange?: (holeNumber: number, value: number | null) => void;
  onScoreChange?: (holeNumber: number, value: number | null) => void;
  onShotCountChange?: (holeNumber: number, value: number | null) => void;
  playerName?: string;
  showPenalties?: boolean;
  showShotCounts?: boolean;
  subtitle?: string;
  variant?: "full" | "compact";
}) {
  const orderedHoles = holes.slice().sort((left, right) => left.holeNumber - right.holeNumber);
  const totalPar = sumValues(orderedHoles.map((hole) => hole.par));
  const totalYards = sumValues(orderedHoles.map((hole) => hole.yards));
  const totalScore = sumNullable(orderedHoles.map((hole) => hole.score ?? null));
  const totalPutts = sumNullable(orderedHoles.map((hole) => hole.putts ?? null));
  const toPar = totalScore === null ? null : totalScore - totalPar;
  const totalShots = sumNullable(orderedHoles.map((hole) => hole.shotCount ?? null));
  const totalPenalties = sumNullable(orderedHoles.map((hole) => hole.penalties ?? null));

  if (variant === "compact") {
    return (
      <CompactCourseScorecardSvg
        className={className}
        courseName={courseName}
        holes={orderedHoles}
        subtitle={subtitle}
        totalPar={totalPar}
        totalPutts={totalPutts}
        totalScore={totalScore}
        totalShots={totalShots}
        totalYards={totalYards}
        toPar={toPar}
      />
    );
  }

  const groups = chunkHoles(orderedHoles);
  const rowsPerGroup = 5 + (showShotCounts ? 1 : 0) + (showPenalties ? 1 : 0);
  const groupHeight = 38 + rowsPerGroup * 48 + 24;
  const width = 1120;
  const height = 200 + groups.length * groupHeight;

  return (
    <div
      className={cn(
        "min-w-0 overflow-x-auto rounded-lg border border-emerald-950/15 bg-[#071311] p-2 shadow-sm",
        className,
      )}
    >
      <svg
        role="img"
        aria-label={`${courseName} scorecard`}
        viewBox={`0 0 ${width} ${height}`}
        className="block min-w-[980px]"
        style={{ width: "100%", height: "auto" }}
      >
        <defs>
          <linearGradient id="scorecardHeader" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0B7A3B" />
            <stop offset="54%" stopColor="#0A4F35" />
            <stop offset="100%" stopColor="#071311" />
          </linearGradient>
          <linearGradient id="scorecardBlue" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0F8F4D" />
            <stop offset="100%" stopColor="#14B875" />
          </linearGradient>
          <filter id="scorecardGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.05 0 0 0 0 0.75 0 0 0 0 0.39 0 0 0 0.45 0"
            />
            <feBlend in="SourceGraphic" mode="screen" />
          </filter>
        </defs>

        <rect width={width} height={height} rx="22" fill="#071311" />
        <rect x="14" y="14" width={width - 28} height="86" rx="16" fill="url(#scorecardHeader)" />
        <rect x="14" y="14" width={width - 28} height="86" rx="16" fill="#FFFFFF" opacity="0.05" />
        <rect x="34" y="30" width="54" height="54" rx="12" fill="#EAFBF2" opacity="0.94" />
        <text x="61" y="52" textAnchor="middle" fontSize="11" fontWeight="800" fill="#063E2A">
          LM
        </text>
        <text x="61" y="68" textAnchor="middle" fontSize="11" fontWeight="800" fill="#063E2A">
          WT
        </text>
        <text x="110" y="48" fontSize="30" fontWeight="800" fill="#F8FFFA">
          {courseName}
        </text>
        <text x="112" y="74" fontSize="15" fontWeight="700" fill="#B9F5D0">
          {subtitle ?? "Scorecard import"}
        </text>
        <text x={width - 34} y="46" textAnchor="end" fontSize="20" fontWeight="900" fill="#F8FFFA">
          {formatToPar(toPar)}
        </text>
        <text x={width - 34} y="74" textAnchor="end" fontSize="13" fontWeight="700" fill="#B9F5D0">
          {formatNullable(totalScore)} strokes · {formatNullable(totalPutts)} putts
        </text>

        <rect x="24" y="118" width={width - 48} height="44" rx="10" fill="#020907" />
        <text x="42" y="147" fontSize="30" fontWeight="900" fill="#F8FFFA">
          {playerName}
        </text>

        {groups.map((group, groupIndex) => {
          const y = 182 + groupIndex * groupHeight;
          return (
            <ScorecardGroup
              key={groupIndex}
              editable={editable}
              group={group}
              groupIndex={groupIndex}
              onPenaltiesChange={onPenaltiesChange}
              onScoreChange={onScoreChange}
              onShotCountChange={onShotCountChange}
              showPenalties={showPenalties}
              showShotCounts={showShotCounts}
              y={y}
            />
          );
        })}

        <SummaryStrip
          x={880}
          y={118}
          values={[
            ["PAR", totalPar.toString()],
            ["YDS", totalYards.toString()],
            ["SHOTS", formatNullable(totalShots)],
            ["PEN", formatNullable(totalPenalties)],
          ]}
        />
      </svg>
      <ChartAccessibleFallback
        title="Course scorecard"
        summary={scorecardSummary({
          courseName,
          holes: orderedHoles,
          showPenalties,
          showShotCounts,
          totalPar,
          totalPenalties,
          totalPutts,
          totalScore,
          totalShots,
          totalYards,
          toPar,
        })}
        columns={scorecardFallbackColumns(showShotCounts, showPenalties)}
        rows={scorecardFallbackRows(orderedHoles, showShotCounts, showPenalties)}
        className="mt-2 bg-white/95"
      />
    </div>
  );
}

function CompactCourseScorecardSvg({
  className,
  courseName,
  holes,
  subtitle,
  totalPar,
  totalPutts,
  totalScore,
  totalShots,
  totalYards,
  toPar,
}: {
  className?: string;
  courseName: string;
  holes: CourseScorecardSvgHole[];
  subtitle?: string;
  totalPar: number;
  totalPutts: number | null;
  totalScore: number | null;
  totalShots: number | null;
  totalYards: number;
  toPar: number | null;
}) {
  const groups = chunkHoles(holes);
  const width = 360;
  const groupHeight = 160;
  const height = 116 + groups.length * groupHeight + 48;

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-lg border border-emerald-950/15 bg-[#071311] p-1.5 shadow-sm",
        className,
      )}
    >
      <svg
        role="img"
        aria-label={`${courseName} scorecard`}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        style={{ height: "auto" }}
      >
        <defs>
          <linearGradient id="compactScorecardHeader" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#0B7A3B" />
            <stop offset="62%" stopColor="#0A4F35" />
            <stop offset="100%" stopColor="#071311" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} rx="16" fill="#071311" />
        <rect
          x="8"
          y="8"
          width={width - 16}
          height="66"
          rx="13"
          fill="url(#compactScorecardHeader)"
        />
        <rect x="20" y="20" width="36" height="36" rx="9" fill="#EAFBF2" />
        <text x="38" y="35" textAnchor="middle" fontSize="8" fontWeight="900" fill="#063E2A">
          LM
        </text>
        <text x="38" y="47" textAnchor="middle" fontSize="8" fontWeight="900" fill="#063E2A">
          WT
        </text>
        <text x="68" y="34" fontSize="18" fontWeight="900" fill="#F8FFFA">
          {truncateSvgText(courseName, 22)}
        </text>
        <text x="70" y="54" fontSize="10" fontWeight="800" fill="#B9F5D0">
          {truncateSvgText(subtitle ?? "Scorecard", 34)}
        </text>
        <text x={width - 14} y="34" textAnchor="end" fontSize="18" fontWeight="900" fill="#F8FFFA">
          {formatToPar(toPar)}
        </text>
        <text x={width - 14} y="54" textAnchor="end" fontSize="9" fontWeight="800" fill="#B9F5D0">
          {formatNullable(totalScore)} · {formatNullable(totalPutts)} putts
        </text>

        {groups.map((group, index) => (
          <CompactScorecardGroup
            key={index}
            group={group}
            index={index}
            y={90 + index * groupHeight}
          />
        ))}

        <rect x="10" y={height - 40} width={width - 20} height="30" rx="9" fill="#020907" />
        <CompactTotal label="Score" value={formatNullable(totalScore)} x="26" y={height - 30} />
        <CompactTotal label="Par" value={totalPar.toString()} x="116" y={height - 30} />
        <CompactTotal label="Putts" value={formatNullable(totalPutts)} x="198" y={height - 30} />
        <CompactTotal label="Yards" value={totalYards.toString()} x="280" y={height - 30} />
      </svg>
      <ChartAccessibleFallback
        title="Course scorecard"
        summary={scorecardSummary({
          courseName,
          holes,
          showPenalties: false,
          showShotCounts: totalShots !== null,
          totalPar,
          totalPenalties: null,
          totalPutts,
          totalScore,
          totalShots,
          totalYards,
          toPar,
        })}
        columns={scorecardFallbackColumns(totalShots !== null, false)}
        rows={scorecardFallbackRows(holes, totalShots !== null, false)}
        className="mt-2 bg-white/95"
      />
    </div>
  );
}

function CompactScorecardGroup({
  group,
  index,
  y,
}: {
  group: CourseScorecardSvgHole[];
  index: number;
  y: number;
}) {
  const left = 58;
  const cellWidth = 31;
  const rows = [
    { label: "Hole", key: "hole" },
    { label: "Par", key: "par" },
    { label: "Yds", key: "yards" },
    { label: "Putts", key: "putts" },
    { label: "Score", key: "score" },
  ];

  return (
    <g>
      <rect x="10" y={y} width="340" height="145" rx="12" fill="#0C1815" />
      <rect x="10" y={y} width="340" height="24" rx="12" fill="#0E6F40" />
      <text x="22" y={y + 16} fontSize="9" fontWeight="900" fill="#F8FFFA">
        {index === 0 ? "FRONT" : "BACK"}
      </text>
      {rows.map((row, rowIndex) => {
        const rowY = y + 24 + rowIndex * 23;
        const isDark = row.key === "score" || row.key === "putts";

        return (
          <g key={row.key}>
            <rect
              x="10"
              y={rowY}
              width="340"
              height="23"
              fill={isDark ? "#020907" : rowIndex % 2 === 0 ? "#DFF7EA" : "#C7EEDB"}
            />
            <rect x="10" y={rowY} width="48" height="23" fill={isDark ? "#071311" : "#B9E9CE"} />
            <text
              x="34"
              y={rowY + 15}
              textAnchor="middle"
              fontSize="7.5"
              fontWeight="900"
              fill={isDark ? "#A7F3C8" : "#063E2A"}
            >
              {row.label}
            </text>
            {group.map((hole, holeIndex) => (
              <CompactScorecardCell
                key={`${row.key}-${hole.holeNumber}`}
                hole={hole}
                rowKey={row.key}
                x={left + holeIndex * cellWidth}
                y={rowY}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

function CompactScorecardCell({
  hole,
  rowKey,
  x,
  y,
}: {
  hole: CourseScorecardSvgHole;
  rowKey: string;
  x: number;
  y: number;
}) {
  if (rowKey === "putts") {
    return (
      <text
        x={x + 15.5}
        y={y + 15}
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="900"
        fill="#CFFBE0"
      >
        {formatNullable(hole.putts ?? null)}
      </text>
    );
  }

  if (rowKey === "score") {
    return (
      <ScoreMark
        cx={x + 15.5}
        cy={y + 11.5}
        par={hole.par}
        score={hole.score ?? null}
        size="compact"
      />
    );
  }

  return (
    <text
      x={x + 15.5}
      y={y + 15.5}
      textAnchor="middle"
      fontSize={rowKey === "yards" ? "8" : "11"}
      fontWeight="900"
      fill={rowKey === "score" ? "#F8FFFA" : "#083525"}
    >
      {compactValueForRow(rowKey, hole)}
    </text>
  );
}

function CompactTotal({
  label,
  value,
  x,
  y,
}: {
  label: string;
  value: string;
  x: string;
  y: number;
}) {
  return (
    <g>
      <text x={x} y={y} fontSize="7.5" fontWeight="900" fill="#A7F3C8">
        {label}
      </text>
      <text x={x} y={y + 15} fontSize="14" fontWeight="900" fill="#F8FFFA">
        {value}
      </text>
    </g>
  );
}

function ScorecardGroup({
  editable,
  group,
  groupIndex,
  onPenaltiesChange,
  onScoreChange,
  onShotCountChange,
  showPenalties,
  showShotCounts,
  y,
}: {
  editable: boolean;
  group: CourseScorecardSvgHole[];
  groupIndex: number;
  onPenaltiesChange?: (holeNumber: number, value: number | null) => void;
  onScoreChange?: (holeNumber: number, value: number | null) => void;
  onShotCountChange?: (holeNumber: number, value: number | null) => void;
  showPenalties: boolean;
  showShotCounts: boolean;
  y: number;
}) {
  const rowLabels = [
    "HOLE",
    "PAR",
    "YARDS",
    ...(showShotCounts ? ["SHOTS"] : []),
    "PUTTS",
    "SCORE",
    ...(showPenalties ? ["PEN"] : []),
  ];
  const rowCount = rowLabels.length;
  const rowHeight = 48;
  const left = 92;
  const cellWidth = 86;
  const totalX = 92 + 9 * cellWidth;
  const groupPar = sumValues(group.map((hole) => hole.par));
  const groupYards = sumValues(group.map((hole) => hole.yards));
  const groupScore = sumNullable(group.map((hole) => hole.score ?? null));
  const groupPutts = sumNullable(group.map((hole) => hole.putts ?? null));
  const groupShots = sumNullable(group.map((hole) => hole.shotCount ?? null));
  const groupPenalties = sumNullable(group.map((hole) => hole.penalties ?? null));

  return (
    <g>
      <rect x="24" y={y} width="1072" height={rowCount * rowHeight + 16} rx="14" fill="#0C1815" />
      <rect x="24" y={y} width="1072" height="38" rx="14" fill="#0E6F40" opacity="0.95" />
      <text x="44" y={y + 25} fontSize="14" fontWeight="800" fill="#F8FFFA">
        {groupIndex === 0 ? "FRONT" : "BACK"}
      </text>
      <text
        x={totalX + 92}
        y={y + 25}
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="#CFFBE0"
      >
        TOTAL
      </text>

      {rowLabels.map((label, rowIndex) => {
        const rowY = y + 38 + rowIndex * rowHeight;
        const isDark = label === "SCORE" || label === "PUTTS";
        return (
          <g key={label}>
            <rect
              x="24"
              y={rowY}
              width="1072"
              height={rowHeight}
              fill={isDark ? "#020907" : rowIndex % 2 === 0 ? "#DFF7EA" : "#C7EEDB"}
              opacity={isDark ? 1 : 0.98}
            />
            <rect
              x="24"
              y={rowY}
              width="68"
              height={rowHeight}
              fill={isDark ? "#071311" : "#B9E9CE"}
            />
            <text
              x="58"
              y={rowY + 30}
              textAnchor="middle"
              fontSize="11"
              fontWeight="900"
              fill={isDark ? "#A7F3C8" : "#063E2A"}
            >
              {label}
            </text>

            {group.map((hole, index) => (
              <ScorecardCell
                key={`${label}-${hole.holeNumber}`}
                editable={editable}
                hole={hole}
                label={label}
                onPenaltiesChange={onPenaltiesChange}
                onScoreChange={onScoreChange}
                onShotCountChange={onShotCountChange}
                x={left + index * cellWidth}
                y={rowY}
              />
            ))}

            <rect
              x={totalX}
              y={rowY}
              width="184"
              height={rowHeight}
              fill={isDark ? "#071311" : "#AEE8CA"}
            />
            <text
              x={totalX + 92}
              y={rowY + 31}
              textAnchor="middle"
              fontSize={isDark ? "29" : "18"}
              fontWeight="900"
              fill={isDark ? "#F8FFFA" : "#063E2A"}
            >
              {totalForLabel(label, {
                par: groupPar,
                yards: groupYards,
                score: groupScore,
                putts: groupPutts,
                shots: groupShots,
                penalties: groupPenalties,
              })}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function ScorecardCell({
  editable,
  hole,
  label,
  onPenaltiesChange,
  onScoreChange,
  onShotCountChange,
  x,
  y,
}: {
  editable: boolean;
  hole: CourseScorecardSvgHole;
  label: string;
  onPenaltiesChange?: (holeNumber: number, value: number | null) => void;
  onScoreChange?: (holeNumber: number, value: number | null) => void;
  onShotCountChange?: (holeNumber: number, value: number | null) => void;
  x: number;
  y: number;
}) {
  const isDark = label === "SCORE" || label === "PUTTS";
  const textFill = isDark ? "#F8FFFA" : "#083525";
  const value = valueForLabel(label, hole);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width="86"
        height="48"
        fill="transparent"
        stroke="#071311"
        strokeOpacity="0.16"
      />
      {editable && label === "SCORE" ? (
        <NumberForeignObject
          label={`Hole ${hole.holeNumber} score`}
          value={hole.score ?? null}
          x={x + 17}
          y={y + 8}
          onChange={(nextValue) => onScoreChange?.(hole.holeNumber, nextValue)}
        />
      ) : editable && label === "SHOTS" ? (
        <NumberForeignObject
          label={`Hole ${hole.holeNumber} Rapsodo shots`}
          value={hole.shotCount ?? null}
          x={x + 19}
          y={y + 9}
          compact
          onChange={(nextValue) => onShotCountChange?.(hole.holeNumber, nextValue)}
        />
      ) : editable && label === "PEN" ? (
        <NumberForeignObject
          label={`Hole ${hole.holeNumber} penalties`}
          value={hole.penalties ?? null}
          x={x + 21}
          y={y + 9}
          compact
          onChange={(nextValue) => onPenaltiesChange?.(hole.holeNumber, nextValue)}
        />
      ) : label === "PUTTS" ? (
        <text
          x={x + 43}
          y={y + 30}
          textAnchor="middle"
          fontSize="17"
          fontWeight="900"
          fill="#CFFBE0"
        >
          {formatNullable(hole.putts ?? null)}
        </text>
      ) : label === "SCORE" ? (
        <ScoreMark cx={x + 43} cy={y + 24} par={hole.par} score={hole.score ?? null} size="full" />
      ) : (
        <text
          x={x + 43}
          y={y + (label === "YARDS" ? 30 : 31)}
          textAnchor="middle"
          fontSize={label === "HOLE" ? "18" : label === "YARDS" ? "15" : "20"}
          fontWeight={label === "HOLE" ? "900" : "800"}
          fill={textFill}
        >
          {value}
        </text>
      )}
    </g>
  );
}

function ScoreMark({
  cx,
  cy,
  par,
  score,
  size,
}: {
  cx: number;
  cy: number;
  par: number;
  score: number | null;
  size: "compact" | "full";
}) {
  const value = formatNullable(score);
  const mark = scoreMarkForHole(score, par);
  const isCompact = size === "compact";
  const textSize = isCompact ? 10 : 22;
  const circleRadius = isCompact ? 9 : 18;
  const innerCircleRadius = isCompact ? 6.5 : 13;
  const squareSize = isCompact ? 18 : 34;
  const innerSquareSize = isCompact ? 13 : 26;
  const strokeWidth = isCompact ? 1.4 : 2.8;
  const fill = "#F8FFFA";
  const stroke = "#F8FFFA";

  if (mark === "circle" || mark === "double-circle") {
    return (
      <g>
        <circle
          cx={cx}
          cy={cy}
          r={circleRadius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {mark === "double-circle" ? (
          <circle
            cx={cx}
            cy={cy}
            r={innerCircleRadius}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth * 0.75}
          />
        ) : null}
        <text
          x={cx}
          y={cy + (isCompact ? 3.5 : 7.5)}
          textAnchor="middle"
          fontSize={textSize}
          fontWeight="900"
          fill={fill}
        >
          {value}
        </text>
      </g>
    );
  }

  if (mark === "square" || mark === "double-square") {
    return (
      <g>
        <rect
          x={cx - squareSize / 2}
          y={cy - squareSize / 2}
          width={squareSize}
          height={squareSize}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
        {mark === "double-square" ? (
          <rect
            x={cx - innerSquareSize / 2}
            y={cy - innerSquareSize / 2}
            width={innerSquareSize}
            height={innerSquareSize}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth * 0.75}
          />
        ) : null}
        <text
          x={cx}
          y={cy + (isCompact ? 3.5 : 7.5)}
          textAnchor="middle"
          fontSize={textSize}
          fontWeight="900"
          fill={fill}
        >
          {value}
        </text>
      </g>
    );
  }

  return (
    <text
      x={cx}
      y={cy + (isCompact ? 4 : 8)}
      textAnchor="middle"
      fontSize={textSize}
      fontWeight="900"
      fill={fill}
    >
      {value}
    </text>
  );
}

function NumberForeignObject({
  compact = false,
  label,
  onChange,
  value,
  x,
  y,
}: {
  compact?: boolean;
  label: string;
  onChange: (value: number | null) => void;
  value: number | null;
  x: number;
  y: number;
}) {
  return (
    <foreignObject x={x} y={y} width={compact ? 48 : 52} height={compact ? 32 : 34}>
      <input
        aria-label={label}
        inputMode="numeric"
        min={0}
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(numberOrNull(event.target.value))}
        className={cn(
          "h-full w-full rounded-md border border-emerald-100/70 bg-white text-center font-black text-emerald-950 shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-300/70",
          compact ? "text-sm" : "text-lg",
        )}
      />
    </foreignObject>
  );
}

function SummaryStrip({ values, x, y }: { values: Array<[string, string]>; x: number; y: number }) {
  return (
    <g>
      {values.map(([label, value], index) => (
        <g key={label}>
          <rect
            x={x + index * 54}
            y={y}
            width="46"
            height="44"
            rx="8"
            fill="#EAFBF2"
            opacity="0.95"
          />
          <text
            x={x + index * 54 + 23}
            y={y + 17}
            textAnchor="middle"
            fontSize="9"
            fontWeight="900"
            fill="#0B4F35"
          >
            {label}
          </text>
          <text
            x={x + index * 54 + 23}
            y={y + 34}
            textAnchor="middle"
            fontSize="13"
            fontWeight="900"
            fill="#071311"
          >
            {value}
          </text>
        </g>
      ))}
    </g>
  );
}

function chunkHoles(holes: CourseScorecardSvgHole[]) {
  if (holes.length <= 9) {
    return [holes];
  }

  return [holes.slice(0, 9), holes.slice(9, 18)];
}

function valueForLabel(label: string, hole: CourseScorecardSvgHole) {
  switch (label) {
    case "HOLE":
      return hole.holeNumber.toString();
    case "PAR":
      return hole.par.toString();
    case "YARDS":
      return hole.yards.toString();
    case "SHOTS":
      return formatNullable(hole.shotCount ?? null);
    case "SCORE":
      return formatNullable(hole.score ?? null);
    case "PEN":
      return formatNullable(hole.penalties ?? null);
    default:
      return "";
  }
}

function totalForLabel(
  label: string,
  totals: {
    par: number;
    yards: number;
    score: number | null;
    putts: number | null;
    shots: number | null;
    penalties: number | null;
  },
) {
  switch (label) {
    case "PAR":
      return totals.par.toString();
    case "YARDS":
      return totals.yards.toString();
    case "SHOTS":
      return formatNullable(totals.shots);
    case "SCORE":
      return formatNullable(totals.score);
    case "PUTTS":
      return formatNullable(totals.putts);
    case "PEN":
      return formatNullable(totals.penalties);
    default:
      return "";
  }
}

function compactValueForRow(rowKey: string, hole: CourseScorecardSvgHole) {
  switch (rowKey) {
    case "hole":
      return hole.holeNumber.toString();
    case "par":
      return hole.par.toString();
    case "yards":
      return hole.yards.toString();
    case "score":
      return formatNullable(hole.score ?? null);
    case "putts":
      return formatNullable(hole.putts ?? null);
    default:
      return "";
  }
}

function scoreMarkForHole(score: number | null, par: number) {
  if (score === null) {
    return "none";
  }

  const relativeToPar = score - par;

  if (relativeToPar <= -2) {
    return "double-circle";
  }

  if (relativeToPar === -1) {
    return "circle";
  }

  if (relativeToPar >= 2) {
    return "double-square";
  }

  if (relativeToPar === 1) {
    return "square";
  }

  return "none";
}

function scorecardSummary({
  courseName,
  holes,
  showPenalties,
  showShotCounts,
  totalPar,
  totalPenalties,
  totalPutts,
  totalScore,
  totalShots,
  totalYards,
  toPar,
}: {
  courseName: string;
  holes: CourseScorecardSvgHole[];
  showPenalties: boolean;
  showShotCounts: boolean;
  totalPar: number;
  totalPenalties: number | null;
  totalPutts: number | null;
  totalScore: number | null;
  totalShots: number | null;
  totalYards: number;
  toPar: number | null;
}) {
  const scoredHoles = holes.filter((hole) => typeof hole.score === "number").length;
  const puttHoles = holes.filter((hole) => typeof hole.putts === "number").length;
  const scoreText =
    totalScore === null
      ? "No saved score is available yet"
      : `${totalScore} strokes (${formatToPar(toPar)}) across ${scoredHoles}/${holes.length} scored holes`;
  const puttText =
    totalPutts === null
      ? "putts are not saved"
      : `${totalPutts} putts across ${puttHoles}/${holes.length} holes`;
  const shotText =
    showShotCounts && totalShots !== null
      ? ` Launch-monitor rows account for ${totalShots} linked shots.`
      : "";
  const penaltyText =
    showPenalties && totalPenalties !== null ? ` Penalties total ${totalPenalties}.` : "";

  return `${courseName} scorecard shows ${holes.length} holes, par ${totalPar}, ${totalYards} yd. ${scoreText}; ${puttText}.${shotText}${penaltyText}`;
}

function scorecardFallbackColumns(showShotCounts: boolean, showPenalties: boolean) {
  return [
    { key: "hole", label: "Hole" },
    { key: "par", label: "Par" },
    { key: "yards", label: "Yards" },
    { key: "score", label: "Score" },
    { key: "toPar", label: "To par" },
    { key: "putts", label: "Putts" },
    ...(showShotCounts ? [{ key: "shots", label: "Shots" }] : []),
    ...(showPenalties ? [{ key: "penalties", label: "Penalties" }] : []),
  ];
}

function scorecardFallbackRows(
  holes: CourseScorecardSvgHole[],
  showShotCounts: boolean,
  showPenalties: boolean,
) {
  return holes.map((hole) => ({
    _key: `hole-${hole.holeNumber}`,
    hole: hole.holeNumber.toString(),
    par: hole.par.toString(),
    yards: hole.yards.toString(),
    score: formatNullable(hole.score ?? null),
    toPar: formatHoleToPar(hole.score ?? null, hole.par),
    putts: formatNullable(hole.putts ?? null),
    ...(showShotCounts ? { shots: formatNullable(hole.shotCount ?? null) } : {}),
    ...(showPenalties ? { penalties: formatNullable(hole.penalties ?? null) } : {}),
  }));
}

function formatHoleToPar(score: number | null, par: number) {
  if (score === null) {
    return "--";
  }

  return formatToPar(score - par);
}

function numberOrNull(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function sumValues(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function sumNullable(values: Array<number | null>) {
  const present = values.filter((value): value is number => typeof value === "number");
  return present.length > 0 ? present.reduce((total, value) => total + value, 0) : null;
}

function formatNullable(value: number | null) {
  return typeof value === "number" ? value.toString() : "--";
}

function formatToPar(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value === 0) {
    return "E";
  }

  return value > 0 ? `+${value}` : value.toString();
}

function truncateSvgText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
