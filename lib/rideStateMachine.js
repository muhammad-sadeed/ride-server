const VALID_TRANSITIONS = {
  requested: ["accepted", "cancelled"],
  accepted: ["arrived", "cancelled"],
  arrived: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
};

export function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
