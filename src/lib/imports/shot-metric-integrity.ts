const MINIMUM_IMPLAUSIBLE_SPINBACK_YD = 20;
const MINIMUM_IMPLAUSIBLE_SPINBACK_RATIO = 0.2;

export type ShotMetricIntegrityIssue = {
  code: "total_below_carry";
  field: "totalYd";
  value: number;
  explanation: string;
};

export function quarantineIncompatibleTotalDistance({
  carryYd,
  totalYd,
  rowNumber,
}: {
  carryYd: number | null;
  totalYd: number | null;
  rowNumber: number;
}) {
  if (carryYd === null || totalYd === null || carryYd <= 0) {
    return { totalYd, warning: null, issue: null };
  }

  const spinbackYd = carryYd - totalYd;
  const quarantineThresholdYd = Math.max(
    MINIMUM_IMPLAUSIBLE_SPINBACK_YD,
    carryYd * MINIMUM_IMPLAUSIBLE_SPINBACK_RATIO,
  );

  if (spinbackYd < quarantineThresholdYd) {
    return { totalYd, warning: null, issue: null };
  }

  const explanation = `Total distance ${totalYd} yd is incompatible with carry distance ${carryYd} yd.`;

  return {
    totalYd: null,
    warning: `Row ${rowNumber}: total distance ${totalYd} yd is incompatible with carry distance ${carryYd} yd; only the total-distance field was quarantined.`,
    issue: {
      code: "total_below_carry",
      field: "totalYd",
      value: totalYd,
      explanation,
    } satisfies ShotMetricIntegrityIssue,
  };
}
