import type { NpcDefinition } from '../../types';

/**
 * NPC ด่านคลองลานพัฒนา (ด่านสุดท้าย) — ให้หลักฐานทีละชนิดโดยไม่บอกว่าจุดใดคือคำตอบ
 * ตัวเลขทั้งหมดใช้ตัวแปร: {{dist}} {{mapcm}} {{road}} {{elev}} {{grid}} และ {{ia:...}} (ค่าจากหลักฐานรวมของด่าน)
 *
 * หมายเหตุ: ตัวละคร แหล่งเรียนรู้ และเรื่องราวทั้งหมดเป็นข้อมูลจำลองเพื่อการเรียนรู้ ไม่ใช่ข้อเท็จจริงของชุมชน
 */
const NEM = 'ครูเนม';
const KLA = 'พี่ต้นกล้า (อาสาสำรวจ)';
const BUA = 'ป้าบัวลอย (ผู้ดูแลลำน้ำ)';
const JAM = 'ลุงจำรัส (ผู้เก็บบันทึกพิกัด)';

export const khlongLanPattanaNpcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 9, y: 50 },
    dialogue: [
      {
        when: { notFlags: ['mission-accepted'] },
        nodes: [
          { speaker: NEM, text: 'มาถึงด่านสุดท้ายแล้ว! ครูได้รับแผนที่ภูมิปัญญาของตำบลคลองลานพัฒนา แต่แผนที่โดนน้ำจนข้อมูลบางส่วนเสียหาย' },
          {
            speaker: NEM,
            text: 'แผนที่ระบุแหล่งเรียนรู้ชุมชนแห่งสุดท้าย แต่ตำแหน่งเลือนไป — แหล่งเรียนรู้นี้เป็นข้อมูลจำลองเพื่อฝึกทักษะ ไม่ใช่สถานที่จริง',
            effects: [
              { type: 'evidence', evidenceId: 'damaged-map' },
              { type: 'clue', clueId: 'clue-mission' },
            ],
          },
          {
            speaker: NEM,
            text: 'ต้องใช้ทุกอย่างที่เรียนมา: มาตราส่วน ทิศ ระยะทาง · สัญลักษณ์ ความสูง ทิศน้ำไหล · และพิกัด E/N กับหมุดอ้างอิง',
          },
          { speaker: NEM, text: 'ทบทวนก่อนนะ แผนที่นี้มาตราส่วน 1:10,000 เหมือนเดิม' },
          { quiz: 'scale-review' },
          {
            speaker: NEM,
            text: 'ไปตรวจหมุดอ้างอิง RP-1, RP-2, RP-3 (กด E ที่หมุด) แล้วคุยกับพี่ต้นกล้าที่สะพาน ทาง{{dir:center>bridge}} ห่างเป็นเส้นตรงราว {{dist:center>bridge}} เมตร',
            effects: [{ type: 'clue', clueId: 'clue-rps' }],
          },
        ],
      },
      {
        ambient: true,
        nodes: [
          {
            speaker: NEM,
            text: 'อย่าตัดสินจากหลักฐานข้อเดียว แหล่งเรียนรู้ที่ถูกต้องต้องตรงทั้งระยะทาง ภูมิประเทศ และพิกัดพร้อมกัน (เบาะแสอยู่ในสมุด กด N)',
          },
        ],
      },
    ],
  },
  {
    id: 'surveyor-tonkla',
    name: 'พี่ต้นกล้า',
    appearance: 'student',
    at: { x: 46, y: 46 },
    dialogue: [
      {
        when: { maxStep: 1 },
        ambient: true,
        nodes: [{ speaker: KLA, text: 'สวัสดี! รับภารกิจจากครูเนมที่ศูนย์ภาคสนามก่อนนะ แล้วค่อยมาคุยกัน' }],
      },
      {
        when: { minStep: 2, notFlags: ['distance-ok'] },
        nodes: [
          { speaker: KLA, text: 'พี่ช่วยวัดระยะให้ครูเนมอยู่ จำไว้นะ: ระยะเส้นตรงกับระยะเดินตามถนนไม่เท่ากัน ถนนต้องอ้อมลำน้ำและเนิน' },
          {
            speaker: KLA,
            text: 'อย่างศูนย์ภาคสนามถึงชุมชน บนแผนที่ห่าง {{mapcm:center>village}} ซม. แต่ถ้าเดินตามถนนจะไกลกว่า เพราะต้องออกถนนใหญ่ก่อนแล้วเลี้ยวเข้าชุมชน',
            effects: [{ type: 'clue', clueId: 'clue-straight-road' }],
          },
          { quiz: 'rp-distance' },
          {
            speaker: KLA,
            text: 'แผนที่ที่เสียหายยังอ่านได้หนึ่งบรรทัด: "จากสะพาน ไปทาง{{ia:dir}} เส้นตรงราว {{ia:straight}} ม. · เดินตามถนนราว {{ia:road}} ม."',
            effects: [{ type: 'clue', clueId: 'clue-distance' }],
          },
          { speaker: KLA, text: 'ลองกด R ที่สะพานแล้วเดินตามถนน ดูว่าระยะที่วัดได้เป็นเท่าไร' },
        ],
      },
      {
        ambient: true,
        nodes: [
          {
            speaker: KLA,
            text: 'ระยะเส้นตรงดูจากแผนที่ (มาตราส่วน) ส่วนระยะตามถนนต้องเดินวัดจริง (R) — มีหลายจุดที่ระยะเส้นตรงใกล้กัน ต้องใช้หลักฐานอื่นประกอบ',
          },
        ],
      },
    ],
  },
  {
    id: 'water-keeper',
    name: 'ป้าบัวลอย',
    appearance: 'headman',
    at: { x: 44, y: 40 },
    dialogue: [
      {
        when: { maxStep: 2 },
        ambient: true,
        nodes: [{ speaker: BUA, text: 'สวัสดีจ้ะ ตรวจหมุดอ้างอิงและคุยกับพี่ต้นกล้าเรื่องระยะทางก่อนนะ แล้วค่อยมาดูลำน้ำกับป้า' }],
      },
      {
        when: { minStep: 3, notFlags: ['flow-ok'] },
        nodes: [
          { speaker: BUA, text: 'ป้าดูแลลำน้ำคลองลานมานาน ป้าติดป้ายวัดระดับไว้สองป้ายริมลำน้ำ' },
          {
            speaker: BUA,
            text: 'ป้ายทางเหนือสูง {{elev:bm-up}} ม. · ป้ายทางใต้สูง {{elev:bm-down}} ม. จากระดับทะเลปานกลาง',
            effects: [{ type: 'clue', clueId: 'clue-elev' }],
          },
          { quiz: 'flow-4' },
          {
            speaker: BUA,
            text: 'บนแผนที่ที่เสียหาย แหล่งเรียนรู้ใช้สัญลักษณ์ศาลา/อาคาร อยู่บนเนินสูงกว่า {{ia:minelev}} ม. และอยู่ทางต้นน้ำของสะพาน',
            effects: [{ type: 'clue', clueId: 'clue-terrain' }],
          },
          { speaker: BUA, text: 'บนเนินแถวนี้มีทั้งอาคารและวัด ดูสัญลักษณ์ให้ดีนะ — กด M ดูเส้นชั้นความสูงประกอบ' },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: BUA, text: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ ต้นน้ำคือฝั่งที่สูงกว่า ไม่ใช่ฝั่งที่อยู่ด้านบนของจอ' }],
      },
    ],
  },
  {
    id: 'record-keeper',
    name: 'ลุงจำรัส',
    appearance: 'villager',
    at: { x: 25, y: 41 },
    dialogue: [
      {
        when: { maxStep: 3 },
        ambient: true,
        nodes: [{ speaker: JAM, text: 'ลุงเก็บบันทึกพิกัดของตำบลไว้ ถ้าตรวจระยะทางและลำน้ำครบแล้ว ค่อยมาดูพิกัดกับลุงนะ' }],
      },
      {
        // ฉาก 4 อยู่ระหว่างพัฒนา — ข้อมูลหลักฐานพิกัด (clue-grid) เตรียมไว้ใน mission.ts แล้ว
        ambient: true,
        nodes: [
          {
            speaker: JAM,
            text: '(ฉาก 4 อยู่ระหว่างพัฒนา) ลุงกำลังอ่านพิกัดที่เลือนจากแผนที่ที่เสียหาย เทียบกับหมุด RP-2 อยู่ — กลับมาใหม่ในรุ่นถัดไปนะ',
          },
        ],
      },
    ],
  },
];
