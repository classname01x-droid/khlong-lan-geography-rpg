import type { NpcDefinition } from '../../types';

/**
 * NPC ด่านคลองน้ำไหล — ให้ข้อมูลภูมิศาสตร์และเบาะแสโดยไม่บอกตำแหน่งตาน้ำตรง ๆ
 * ตัวเลขระยะ ทิศ และระดับความสูงทั้งหมดคำนวณจากแผนที่ ({{dist}} {{dir}} {{elev}} {{flow}})
 *
 * หมายเหตุ: ชื่อตัวละครและเรื่องราวเป็นข้อมูลสมมติเพื่อการเรียนรู้ ต้องตรวจสอบเนื้อหาชุมชนจริงก่อนใช้สอน
 */
const NEM = 'ครูเนม';
const CHAN = 'ป้าจันทร์ (ผู้ดูแลแหล่งน้ำ)';
const PHUM = 'พี่ภูมิ (อาสาสมัครสำรวจแผนที่)';
const PHET = 'ลุงเพชร';
const HOM = 'ยายหอม';

export const khlongNamLaiNpcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 8, y: 12 },
    dialogue: [
      {
        when: { maxStep: 1 },
        nodes: [
          { speaker: NEM, text: 'ยินดีต้อนรับสู่คลองน้ำไหล! ภารกิจครั้งนี้เกี่ยวกับทรัพยากรน้ำของชุมชน' },
          {
            speaker: NEM,
            text: 'ชาวบ้านอยากรู้ว่าน้ำในลำห้วยมาจากตาน้ำที่ไหน ป้าจันทร์ผู้ดูแลแหล่งน้ำรออยู่ที่ศาลาจัดการน้ำชุมชน',
          },
          {
            speaker: NEM,
            text: 'ศาลาอยู่ทาง{{dir:school>water-office}}ของโรงเรียน ห่างเป็นเส้นตรงประมาณ {{dist:school>water-office}} เมตร',
            effects: [{ type: 'clue', clueId: 'clue-office' }],
          },
          {
            speaker: NEM,
            text: 'ด่านนี้แผนที่ (M) มีเส้นชั้นความสูงและตัวเลขระดับความสูง (▲) ด้วย จำไว้ว่าด้านบนของแผนที่คือทิศเหนือ ไม่ได้แปลว่าสูงกว่า',
          },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: NEM, text: 'เบาะแสทุกอย่างจดอยู่ในสมุดภาคสนาม (N) ลองเทียบข้อมูลให้ครบก่อนสรุปนะ' }],
      },
    ],
  },
  {
    id: 'water-keeper',
    name: 'ป้าจันทร์',
    appearance: 'headman',
    at: { x: 47, y: 37 },
    dialogue: [
      {
        when: { maxStep: 1 },
        ambient: true,
        nodes: [{ speaker: CHAN, text: 'สวัสดีจ้ะ ไปพบครูเนมที่โรงเรียนก่อนนะ ครูมีภารกิจให้' }],
      },
      {
        when: { minStep: 2, maxStep: 2 },
        nodes: [
          { speaker: CHAN, text: 'ป้าดูแลฝายและแหล่งน้ำของหมู่บ้านมาหลายสิบปีแล้ว' },
          {
            speaker: CHAN,
            text: 'หน้าแล้งปีนี้น้ำในลำห้วยน้อยลง ชาวบ้านอยากรู้ว่าตาน้ำต้นลำห้วยอยู่ที่ไหน จะได้ช่วยกันดูแลให้ดี',
          },
          {
            speaker: CHAN,
            text: 'ป้ามีแผนที่เก่าของชุมชนที่วาดมือไว้ เอาไปเทียบกับแผนที่ที่หลานสำรวจเองนะ (กด M แล้วกด Tab สลับแผ่น)',
            effects: [
              { type: 'evidence', evidenceId: 'old-map' },
              { type: 'clue', clueId: 'clue-symbol' },
            ],
          },
          {
            speaker: CHAN,
            text: 'แต่ระวังนะ หมู่บ้านเรามีแหล่งน้ำหลายแห่งที่ดูคล้ายกัน ทั้งฝาย หนองน้ำ และบ่อในไร่',
          },
          {
            speaker: CHAN,
            text: 'เริ่มจากหาให้ได้ก่อนว่าน้ำในลำห้วยไหลไปทางไหน ลองถามพี่ภูมิที่ริมลำห้วยใกล้สะพานดู',
            effects: [{ type: 'flag', flag: 'got-old-map' }],
          },
        ],
      },
      {
        ambient: true,
        nodes: [
          {
            speaker: CHAN,
            text: 'ตาน้ำต้นลำห้วยต้องอยู่ "ต้นน้ำ" นะหลาน ไม่ใช่ปลายน้ำ แผนที่เก่าของป้าจะช่วยยืนยันได้',
          },
        ],
      },
    ],
  },
  {
    id: 'surveyor-phum',
    name: 'พี่ภูมิ',
    appearance: 'student',
    at: { x: 28, y: 36 },
    dialogue: [
      {
        when: { maxStep: 2 },
        nodes: [
          { speaker: PHUM, text: 'พี่เป็นอาสาสมัครสำรวจแผนที่ของตำบล กำลังเก็บข้อมูลระดับความสูงอยู่' },
          {
            speaker: PHUM,
            text: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ ถ้าอยากรู้ว่าลำห้วยไหลไปทางไหน ต้องดูระดับความสูง ไม่ใช่ดูว่าอยู่ด้านบนหรือด้านล่างของแผนที่',
            effects: [{ type: 'clue', clueId: 'clue-elev-rule' }],
          },
        ],
      },
      {
        when: { minStep: 3, maxStep: 3, flags: ['read-bm-north', 'read-bm-south'] },
        nodes: [
          { speaker: PHUM, text: 'อ่านหมุดหลักฐานระดับครบทั้งสองหมุดแล้ว เก่งมาก! ลองตอบพี่ดูนะ' },
          { quiz: 'flow' },
          {
            speaker: PHUM,
            text: 'ถ้าลำห้วยไหลไปทาง{{flow:stream-main}} ต้นน้ำก็ต้องอยู่ฝั่งตรงข้าม จุดที่สูงที่สุดของลำห้วยนั่นแหละ',
          },
        ],
      },
      {
        when: { minStep: 3, maxStep: 3 },
        nodes: [
          {
            speaker: PHUM,
            text: 'น้ำไหลจากที่สูงไปที่ต่ำ ลองอ่านหมุดหลักฐานระดับ (BM) ให้ครบสองหมุดก่อน แล้วกลับมาบอกพี่',
            effects: [{ type: 'clue', clueId: 'clue-elev-rule' }],
          },
          {
            speaker: PHUM,
            text: 'หมุดหนึ่งอยู่ทาง{{dir:bridge>bm-north}}ของสะพาน อีกหมุดอยู่ทาง{{dir:bridge>bm-south}}ของสะพาน ใกล้ริมลำห้วยทั้งคู่ (เดินไปใกล้ ๆ แล้วกด E)',
          },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: PHUM, text: 'บนแผนที่ (M) ตัวเลข ▲ คือระดับความสูง และเส้นบาง ๆ คือเส้นชั้นความสูงทุก 10 เมตร' }],
      },
    ],
  },
  {
    id: 'farmer-phet',
    name: 'ลุงเพชร',
    appearance: 'villager',
    at: { x: 60, y: 48 },
    dialogue: [
      {
        nodes: [
          { speaker: PHET, text: 'บ่อนี้ลุงขุดเองเมื่อไม่กี่ปีก่อน ไว้เก็บน้ำฝนใช้ในไร่' },
          {
            speaker: PHET,
            text: 'น้ำในบ่อมาจากฝน ไม่ได้ไหลมาจากลำห้วยหรอก แผนที่เก่า ๆ คงยังไม่มีบ่อนี้',
            effects: [{ type: 'clue', clueId: 'clue-farm-pond' }],
          },
        ],
      },
    ],
  },
  {
    id: 'villager-hom',
    name: 'ยายหอม',
    appearance: 'villager',
    at: { x: 47, y: 33 },
    dialogue: [
      {
        nodes: [
          { speaker: HOM, text: 'หนองทางเหนือน้ำเต็มทั้งปี เด็ก ๆ ชอบไปเล่นน้ำกัน' },
          {
            speaker: HOM,
            text: 'ส่วนตาน้ำต้นลำห้วย สมัยยายเด็ก ๆ ผู้ใหญ่เล่าว่าอยู่ใกล้ก้อนหินใหญ่สามก้อน แต่ยายไม่เคยไปเองหรอก',
            effects: [{ type: 'clue', clueId: 'clue-stones' }],
          },
        ],
      },
    ],
  },
];
