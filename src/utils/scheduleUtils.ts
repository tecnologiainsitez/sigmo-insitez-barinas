/**
 * Schedule & Time Slot Utilities for Doctors in Centro de Salud
 */

/**
 * Parses a doctor's working schedule string (e.g. "08:00 - 14:00", "09:00 a 15:00", "08:30 - 13:30")
 * and generates an array of valid 30-minute appointment start time slots.
 */
export function generateDoctorTimeSlots(
  scheduleStr?: string,
  slotDurationMinutes: number = 30
): string[] {
  if (!scheduleStr || typeof scheduleStr !== 'string') {
    return ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];
  }

  const slotsSet = new Set<string>();

  // Split multiple ranges if separated by comma, semicolon or slash (e.g. "08:00 - 12:00, 14:00 - 18:00")
  const ranges = scheduleStr.split(/[,;/]/);

  for (const range of ranges) {
    // Look for patterns like "08:00 - 14:00" or "8:00 a 15:00" or "08:30-13:30"
    const match = range.match(/(\d{1,2}):(\d{2})\s*(?:-|a|to)\s*(\d{1,2}):(\d{2})/i);
    if (match) {
      const startH = parseInt(match[1], 10);
      const startM = parseInt(match[2], 10);
      const endH = parseInt(match[3], 10);
      const endM = parseInt(match[4], 10);

      const startTotalMinutes = startH * 60 + startM;
      const endTotalMinutes = endH * 60 + endM;

      for (
        let curr = startTotalMinutes;
        curr + slotDurationMinutes <= endTotalMinutes;
        curr += slotDurationMinutes
      ) {
        const h = Math.floor(curr / 60);
        const m = curr % 60;
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slotsSet.add(formatted);
      }
    }
  }

  // If no ranges matched regex, fallback to default standard clinic slots
  if (slotsSet.size === 0) {
    return ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];
  }

  return Array.from(slotsSet).sort((a, b) => a.localeCompare(b));
}

/**
 * Checks if a given time string falls strictly within a doctor's schedule.
 */
export function isTimeWithinDoctorSchedule(
  time: string,
  scheduleStr?: string,
  slotDurationMinutes: number = 30
): boolean {
  const allowedSlots = generateDoctorTimeSlots(scheduleStr, slotDurationMinutes);
  return allowedSlots.includes(time.trim());
}
