import type { StorageLike } from '../progress/ProgressStore';

/**
 * การตั้งค่าพื้นฐาน — เก็บแยกจากความคืบหน้า จึงไม่หายเมื่อ "เริ่มเกมใหม่"
 * ยังไม่มีไฟล์เสียงจริง: soundEnabled ใช้สั่ง mute ระบบเสียงของ Phaser ไว้ล่วงหน้า
 * (ยังไม่มีการปรับระดับเสียง จนกว่าจะมีระบบเสียง)
 */
export interface Settings {
  soundEnabled: boolean;
  showControlsHint: boolean;
}

export const SETTINGS_KEY = 'khlonglan-geo-rpg:settings';

export const DEFAULT_SETTINGS: Readonly<Settings> = { soundEnabled: true, showControlsHint: true };

export class SettingsStore {
  private value: Settings;

  constructor(private readonly storage: StorageLike | null) {
    this.value = this.read();
  }

  private read(): Settings {
    try {
      const raw = this.storage?.getItem(SETTINGS_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Settings>;
        return {
          soundEnabled: typeof d.soundEnabled === 'boolean' ? d.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
          showControlsHint:
            typeof d.showControlsHint === 'boolean' ? d.showControlsHint : DEFAULT_SETTINGS.showControlsHint,
        };
      }
    } catch {
      /* ใช้ค่าเริ่มต้น */
    }
    return { ...DEFAULT_SETTINGS };
  }

  get settings(): Readonly<Settings> {
    return this.value;
  }

  update(patch: Partial<Settings>): Settings {
    this.value = { ...this.value, ...patch };
    try {
      this.storage?.setItem(SETTINGS_KEY, JSON.stringify(this.value));
    } catch {
      /* เขียนไม่ได้ → ใช้ค่าในหน่วยความจำ */
    }
    return this.value;
  }
}
