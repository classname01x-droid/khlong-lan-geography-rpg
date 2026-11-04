/** ชื่อ event ที่ใช้สื่อสารระหว่าง WorldScene → UIScene (ผ่าน game.events) */
export const GameEvents = {
  DialogueShow: 'dialogue:show',
  DialogueHide: 'dialogue:hide',
  Toast: 'ui:toast',
  MapShow: 'map:show',
  MapHide: 'map:hide',
} as const;

export interface DialoguePayload {
  speaker: string;
  text: string;
  index: number;
  total: number;
}

export const REGISTRY_SESSION = 'session';
export const REGISTRY_LEVEL_ID = 'levelId';
