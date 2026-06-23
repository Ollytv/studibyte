// ─────────────────────────────────────────────────────────────────────────────
// GRADE SCALE  (score-first system)
// Score → Grade → Grade Point
// ─────────────────────────────────────────────────────────────────────────────

export interface GradeResult {
  grade: string;
  gradePoint: number;
}

/**
 * Derive grade and grade point from a 0–100 score.
 * Returns { grade: 'F', gradePoint: 0 } for any out-of-range input.
 */
export function scoreToGrade(score: number): GradeResult {
  if (score >= 70) return { grade: 'A', gradePoint: 5.0 };
  if (score >= 60) return { grade: 'B', gradePoint: 4.0 };
  if (score >= 50) return { grade: 'C', gradePoint: 3.0 };
  if (score >= 45) return { grade: 'D', gradePoint: 2.0 };
  if (score >= 40) return { grade: 'E', gradePoint: 1.0 };
  return            { grade: 'F', gradePoint: 0.0 };
}

/**
 * Backward-compat lookup for old records that were saved with a letter grade
 * but no score. Returns the grade point so the GPA calculation still works.
 */
export const LEGACY_GRADE_POINTS: Record<string, number> = {
  'A': 5.0, 'AB': 4.5, 'B': 4.0, 'BC': 3.5,
  'C': 3.0, 'CD': 2.5, 'D': 2.0, 'E': 1.0, 'F': 0.0,
};

/**
 * Resolve a grade point from either a numeric score (new) or a legacy grade
 * string (old records). Used by the store / display layer.
 */
export function resolveGradePoint(score: number | undefined, grade: string): number {
  if (score !== undefined) return scoreToGrade(score).gradePoint;
  return LEGACY_GRADE_POINTS[grade] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// GPA calculation — unchanged, score-agnostic
// ─────────────────────────────────────────────────────────────────────────────

export function calculateGPA(courses: { creditUnits: number; gradePoint: number }[]): number {
  const totalUnits  = courses.reduce((s, c) => s + c.creditUnits, 0);
  const totalPoints = courses.reduce((s, c) => s + c.creditUnits * c.gradePoint, 0);
  return totalUnits > 0 ? Math.round((totalPoints / totalUnits) * 100) / 100 : 0;
}

export function getGPAClass(gpa: number): { label: string; color: string } {
  if (gpa >= 4.5) return { label: 'First Class',         color: '#22c55e' };
  if (gpa >= 3.5) return { label: 'Second Class Upper',  color: '#3b82f6' };
  if (gpa >= 2.5) return { label: 'Second Class Lower',  color: '#f97316' };
  if (gpa >= 1.5) return { label: 'Third Class',         color: '#eab308' };
  if (gpa >= 1.0) return { label: 'Pass',                color: '#f87171' };
  return                 { label: 'Fail',                color: '#ef4444' };
}