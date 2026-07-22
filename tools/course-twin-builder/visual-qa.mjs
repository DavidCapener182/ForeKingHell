const ACCEPTED_VERDICTS = new Set(["pass", "pass_with_grade_b_caveats"]);

export function summarizeVisualQa({ packages, document }) {
  if (document?.schemaVersion !== 1) {
    throw new Error("Course Twin visual QA must use schema version 1.");
  }
  if (!Array.isArray(document.courses)) {
    throw new Error("Course Twin visual QA must contain a courses array.");
  }

  const entriesBySlug = new Map();
  const duplicates = [];
  for (const entry of document.courses) {
    if (!entry?.slug || entriesBySlug.has(entry.slug)) {
      duplicates.push(entry?.slug ?? "missing-slug");
      continue;
    }
    entriesBySlug.set(entry.slug, entry);
  }

  const missing = [];
  const rejected = [];
  const mismatched = [];
  let approved = 0;
  let approvedWithCaveats = 0;
  for (const coursePackage of packages) {
    const entry = entriesBySlug.get(coursePackage.slug);
    if (!entry) {
      missing.push(coursePackage.slug);
      continue;
    }
    if (entry.courseId !== coursePackage.courseId) {
      mismatched.push(coursePackage.slug);
      continue;
    }
    if (!ACCEPTED_VERDICTS.has(entry.verdict) || !entry.evidenceFile) {
      rejected.push(coursePackage.slug);
      continue;
    }
    approved += 1;
    if (entry.verdict === "pass_with_grade_b_caveats") approvedWithCaveats += 1;
  }

  const packageSlugs = new Set(packages.map((coursePackage) => coursePackage.slug));
  const unexpected = [...entriesBySlug.keys()].filter((slug) => !packageSlugs.has(slug));
  const complete =
    packages.length >= 20 &&
    packages.length <= 50 &&
    approved === packages.length &&
    missing.length === 0 &&
    rejected.length === 0 &&
    mismatched.length === 0 &&
    duplicates.length === 0 &&
    unexpected.length === 0;

  return {
    complete,
    reviewer: document.reviewer,
    reviewedAt: document.reviewedAt,
    scope: document.scope,
    approved,
    approvedWithCaveats,
    missing,
    rejected,
    mismatched,
    duplicates,
    unexpected,
  };
}
