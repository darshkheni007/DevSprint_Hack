import { prisma } from "./db";
import {
  DEFAULT_ATTENDANCE_THRESHOLD,
  SETTING_KEYS,
} from "./constants";

export async function getSetting(
  key: string,
  fallback: string,
): Promise<string> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

/** Attendance flag threshold in percent (configurable, requirements M06-R06). */
export async function getAttendanceThreshold(): Promise<number> {
  const raw = await getSetting(
    SETTING_KEYS.attendanceThreshold,
    String(DEFAULT_ATTENDANCE_THRESHOLD),
  );
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_ATTENDANCE_THRESHOLD;
}

export async function setAttendanceThreshold(percent: number): Promise<void> {
  await setSetting(SETTING_KEYS.attendanceThreshold, String(percent));
}
