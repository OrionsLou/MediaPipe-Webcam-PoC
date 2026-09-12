// Index into FaceLandmarker's 478-point face mesh for each iris center.
// Mesh layout: 0-467 face surface, 468-472 right eye iris (center 468),
// 473-477 left eye iris (center 473).
export const RIGHT_IRIS_CENTER_INDEX = 468
export const LEFT_IRIS_CENTER_INDEX = 473

// Six-point eye contour indices used for eye-aspect-ratio (EAR) calculation,
// ordered [outerCorner, upperLid1, upperLid2, innerCorner, lowerLid2, lowerLid1] —
// matching the classic EAR formula's p1..p6.
export const RIGHT_EYE_EAR_INDICES = [33, 160, 158, 133, 153, 144] as const
export const LEFT_EYE_EAR_INDICES = [362, 385, 387, 263, 373, 380] as const
