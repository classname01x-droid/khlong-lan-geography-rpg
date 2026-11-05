/** คีย์ใน registry ของ Phaser ที่ใช้แชร์ข้อมูลระหว่างฉาก */
export const REGISTRY_SESSION = 'session';
export const REGISTRY_LEVEL_ID = 'levelId';
/** ชื่อด่านที่เพิ่งปลดล็อก (แสดงในหน้าสรุปผล) */
export const REGISTRY_UNLOCKED = 'unlockedName';
/** รหัสลับที่สะสมได้ทั้งหมด (จาก ProgressStore) แสดงในหน้าสรุปผล */
export const REGISTRY_CODE_PIECES = 'codePieces';
/** ProgressStore ตัวเดียวที่ทุกฉากใช้ร่วมกัน (ถ้า localStorage ใช้ไม่ได้ ข้อมูลในหน่วยความจำจะไม่หายระหว่างเปลี่ยนฉาก) */
export const REGISTRY_PROGRESS = 'progress';
export const REGISTRY_SETTINGS = 'settings';
/** true = เล่นบนจอสัมผัส (แสดงปุ่มสัมผัสและข้อความ DOM ตัวใหญ่) */
export const REGISTRY_TOUCH_UI = 'touchUi';

/** เหตุการณ์บน game.events: ข้อความแจ้งเตือน (จอสัมผัสแสดงเป็น DOM ตัวอักษรใหญ่ แทนข้อความใน canvas) */
export const EVENT_TOUCH_TOAST = 'touch-toast';
