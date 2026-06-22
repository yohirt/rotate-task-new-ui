const NOTE = {
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  C6: 1046.5,
};

const chord = (frequencies, duration = 0.34) =>
  frequencies.map((frequency) => ({
    frequency,
    duration,
    startOffset: 0,
  }));

export const TASK_SOUND_ALERTS = [
  {
    thresholdSeconds: 5 * 60,
    sound: chord([NOTE.C5, NOTE.G5]),
  },
  {
    thresholdSeconds: 4 * 60,
    sound: chord([NOTE.C5, NOTE.F5]),
  },
  {
    thresholdSeconds: 3 * 60,
    sound: chord([NOTE.C5, NOTE.E5]),
  },
  {
    thresholdSeconds: 60,
    sound: chord([NOTE.C5, NOTE.D5], 0.28),
  },
];

export const CLASSIC_COMPLETION_SOUND = [
  { frequency: 620, duration: 0.75, startOffset: 0 },
  { frequency: 930, duration: 0.65, startOffset: 0.08 },
];

export const TASK_COMPLETION_SOUND = [
  { frequency: NOTE.C5, duration: 0.14, startOffset: 0 },
  { frequency: NOTE.E5, duration: 0.14, startOffset: 0.13 },
  { frequency: NOTE.G5, duration: 0.16, startOffset: 0.26 },
  { frequency: NOTE.E5, duration: 0.13, startOffset: 0.44 },
  { frequency: NOTE.G5, duration: 0.14, startOffset: 0.57 },
  { frequency: NOTE.C6, duration: 0.46, startOffset: 0.72 },
  { frequency: NOTE.E5, duration: 0.46, startOffset: 0.72 },
  { frequency: NOTE.G5, duration: 0.46, startOffset: 0.72 },
];

export const TASK_SWITCH_SOUND = [
  { frequency: NOTE.G5, duration: 0.08, startOffset: 0 },
];
