import type { NpcDefinition } from '../../types';

/**
 * NPC บทที่ 3 "ปริศนาเมืองโบราณใต้ผืนดิน" — 4 บทบาท ให้ข้อมูลต่างกัน ไม่มีใครบอกพื้นที่เป้าหมาย
 *   ครูเนม           มอบภารกิจ เกณฑ์ 2 ข้อ และแผนที่ · เชื่อมตำนานพญาจระเข้ · สอนเสริมเฉพาะเกณฑ์ที่ยังพลาด
 *   ลุงสอน           สอนอ่านระดับความสูงจากเส้นชั้นความสูง (id villager-son)
 *   ป้าจันทร์        ข้อมูลน้ำท่วมและระยะใช้น้ำ (id water-keeper)
 *   พี่เขียว         นักสำรวจ ตรวจหลักฐานภาคสนามร่วมกับผู้เล่น (id explorer-khiao)
 *
 * เกณฑ์มีเพียง 2 ข้อ: ระดับความสูง (สูงกว่าลำน้ำ) และระยะจากแหล่งน้ำ — ไม่มีความลาดชัน
 * บทเรียนเสริม: วิเคราะห์ไม่ผ่าน → ระบบจดเกณฑ์ที่ยังไม่เต็ม (weak:<หัวข้อ>) → ครูเนมอธิบาย "เฉพาะเกณฑ์นั้น" (when ระดับบรรทัด)
 * ตัวเลขทุกตัวใช้ตัวแปร {{cfg:...}} {{try:...}} {{site:...}} ซึ่งคำนวณจากข้อมูลด่านและแผนที่จริง
 *
 * เรื่องเมืองโบราณเป็นสถานการณ์จำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติศาสตร์จริงของตำบลโป่งน้ำร้อน
 */
const NEM = 'ครูเนม';
const SON = 'ลุงสอน';
const CHAN = 'ป้าจันทร์ (ผู้ดูแลแหล่งน้ำ)';
const KHIAO = 'พี่เขียว (นักสำรวจภาคสนาม)';

/** เงื่อนไขของบทเรียนเสริมหัวข้อหนึ่ง: วิเคราะห์แล้วเกณฑ์นี้ยังไม่เต็ม และยังไม่ได้ทบทวน */
const weak = (t: string) => ({ flags: [`weak:${t}`], notFlags: [`relearned:${t}`] });

export const pongNamRonNpcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 9, y: 50 },
    dialogue: [
      // ---- บทเรียนเสริม (เฉพาะเกณฑ์ที่ยังพลาด) ----
      {
        when: { flags: ['pending:teacher-nem'] },
        nodes: [
          { speaker: NEM, text: 'ผลล่าสุดได้ {{try:total}}/100 ยังไม่เกิน {{cfg:pass}} ไม่เป็นไร ครูทบทวนให้เฉพาะเรื่องที่ยังพลาดนะ' },
          { speaker: NEM, text: 'ระดับความสูง: วงของเธอ {{try:explainHeight}}', when: weak('height') },
          {
            speaker: NEM,
            text: 'ให้เทียบกับลำน้ำตรงนั้น: ระดับความสูงของพื้นที่ − ระดับลำน้ำ = สูงกว่าลำน้ำกี่เมตร · ที่เหมาะคือ {{cfg:idealHeightFrom}} ม. ขึ้นไป แต่ไม่ถึง {{cfg:idealHeightBelow}} ม.',
            when: weak('height'),
          },
          { quiz: 'relearn-height', when: weak('height') },
          { speaker: NEM, text: 'ระยะจากแหล่งน้ำ: วงของเธอ {{try:explainWater}}', when: weak('water') },
          {
            speaker: NEM,
            text: 'วัดจากกลางวงถึงลำน้ำที่ใกล้ที่สุด แผนที่ 1:10,000 → 1 ซม. = 100 ม. หรือ 1 ช่อง = 10 ม. · ที่เหมาะคือ {{cfg:idealWaterFrom}} ม. ขึ้นไป แต่ไม่ถึง {{cfg:idealWaterBelow}} ม.',
            when: weak('water'),
          },
          { quiz: 'relearn-water', when: weak('water') },
          { speaker: NEM, text: 'ทบทวนครบแล้ว กลับไปเลือกพื้นที่ใหม่ได้เลย' },
        ],
      },
      // ---- ฉาก 1: มอบภารกิจ เกณฑ์ และแผนที่ ----
      {
        when: { notFlags: ['topo-received'] },
        nodes: [
          { speaker: NEM, text: 'มาแล้ว! คำพิทักษ์ "{{code:sakngam}}" กับ "{{code:level-2}}" อยู่กับเราแล้ว คำที่สามอยู่ที่ตำบลโป่งน้ำร้อน' },
          { speaker: NEM, text: 'ชาวบ้านเล่าว่า ชุมชนโบราณอาจเคยอยู่แถวนี้ แล้วถูกตะกอนจากน้ำหลากทับถมจนหายไป' },
          { speaker: NEM, text: 'เรื่องนี้เป็นสถานการณ์จำลองเพื่อการเรียนรู้ ไม่ใช่ประวัติศาสตร์จริง — เราจะฝึกคิดว่า "ถ้าตั้งหมู่บ้าน ที่ไหนเหมาะ"' },
          {
            speaker: NEM,
            text: 'เกณฑ์มี 2 ข้อ เต็ม 100: ระดับความสูง {{cfg:maxHeight}} + ระยะจากแหล่งน้ำ {{cfg:maxWater}} · ผ่านเมื่อมากกว่า {{cfg:pass}}',
            effects: [{ type: 'clue', clueId: 'clue-criteria' }],
          },
          {
            speaker: NEM,
            text: 'นี่คือแผนที่ภูมิประเทศทั้งตำบล มีเส้นชั้นความสูงทุก {{cfg:interval}} ม. เปิดดูได้เลยไม่ต้องเดินสำรวจก่อน',
            effects: [
              { type: 'clue', clueId: 'clue-topo' },
              { type: 'evidence', evidenceId: 'evidence-topo-map' },
              { type: 'flag', flag: 'got-topo-map' },
            ],
          },
          { speaker: NEM, text: 'ไปให้ลุงสอนสอนอ่านความสูงก่อน แล้วถามป้าจันทร์เรื่องแหล่งน้ำนะ', effects: [{ type: 'flag', flag: 'topo-received' }] },
        ],
      },
      {
        when: { minStep: 2, maxStep: 4 },
        ambient: true,
        nodes: [{ speaker: NEM, text: 'เกณฑ์: ระดับความสูง {{cfg:maxHeight}} + ระยะจากแหล่งน้ำ {{cfg:maxWater}} ผ่านเมื่อมากกว่า {{cfg:pass}} — ดูซ้ำได้ในสมุด หน้าเบาะแส' }],
      },
      {
        when: { minStep: 5, notFlags: ['mission-complete'] },
        ambient: true,
        nodes: [{ speaker: NEM, text: 'ไปสำรวจพื้นที่ที่เลือกกับพี่เขียวนะ ผลวิเคราะห์ยังไม่ใช่หลักฐาน ต้องไปดูของจริงก่อน' }],
      },
      {
        ambient: true,
        nodes: [{ speaker: NEM, text: 'คำพิทักษ์คำที่สามอยู่กับเราแล้ว เก่งมาก!' }],
      },
    ],
  },
  {
    id: 'villager-son',
    name: 'ลุงสอน',
    appearance: 'villager',
    at: { x: 35, y: 43 },
    dialogue: [
      {
        when: { maxStep: 1 },
        ambient: true,
        nodes: [{ speaker: SON, text: 'ไปรับเอกสารจากครูเนมที่โรงเรียนก่อนนะ แล้วมาหาลุง' }],
      },
      // ---- ฉาก 2: อ่านระดับความสูงจากเส้นชั้นความสูง ----
      {
        when: { minStep: 2, notFlags: ['learned-contour'] },
        nodes: [
          { speaker: SON, text: 'มาเรียนอ่านความสูงจากแผนที่ใช่ไหม ลุงสอนสั้น ๆ นะ' },
          {
            speaker: SON,
            text: 'เส้นชั้นความสูงลากผ่านจุดที่สูงเท่ากัน แต่ละเส้นห่างกัน {{cfg:interval}} ม. ในแนวตั้ง ตัวเลขบนแผนที่บอกความสูงเป็นเมตร',
            effects: [{ type: 'clue', clueId: 'clue-contour' }],
          },
          { speaker: SON, text: 'ลำน้ำไหลจากเหนือลงใต้ ผิวน้ำทางเหนือจึงสูงกว่าทางใต้ ต้องดูว่าพื้นที่ "สูงกว่าลำน้ำตรงนั้น" กี่เมตร' },
          { quiz: 'contour-read' },
          { speaker: SON, text: 'เก่งมาก! ไปถามป้าจันทร์เรื่องแหล่งน้ำต่อนะ', effects: [{ type: 'flag', flag: 'learned-contour' }] },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: SON, text: 'ความสูงของพื้นที่ − ความสูงของลำน้ำตรงนั้น = สูงกว่าลำน้ำกี่เมตร จำไว้นะ' }],
      },
    ],
  },
  {
    id: 'water-keeper',
    name: 'ป้าจันทร์',
    appearance: 'headman',
    at: { x: 31, y: 47 },
    dialogue: [
      {
        when: { maxStep: 1 },
        ambient: true,
        nodes: [{ speaker: CHAN, text: 'ไปรับเอกสารจากครูเนมก่อนนะจ๊ะ แล้วค่อยมาคุยกัน' }],
      },
      // ---- ฉาก 2: น้ำท่วมและระยะใช้น้ำ ----
      {
        when: { minStep: 2, notFlags: ['water-info'] },
        nodes: [
          {
            speaker: CHAN,
            text: 'ปีน้ำหลาก ที่ที่สูงกว่าลำน้ำไม่ถึง {{cfg:flood}} ม. น้ำท่วมทุกที ที่เหมาะต้องสูงกว่าลำน้ำ {{cfg:idealHeightFrom}} ม. ขึ้นไป แต่สูงถึง {{cfg:idealHeightBelow}} ม. ก็ลงไปตักน้ำลำบากแล้ว',
            effects: [{ type: 'clue', clueId: 'clue-flood' }],
          },
          {
            speaker: CHAN,
            text: 'อยู่ห่างลำน้ำ {{cfg:idealWaterFrom}} ม. ขึ้นไป แต่ไม่ถึง {{cfg:idealWaterBelow}} ม. กำลังดี ติดน้ำเกินไปตลิ่งพังน้ำท่วม ไกลเกินไปก็แบกน้ำไม่ไหว',
            effects: [{ type: 'clue', clueId: 'clue-water' }, { type: 'flag', flag: 'water-info' }],
          },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: CHAN, text: 'สูงกว่าลำน้ำ {{cfg:idealHeightFrom}}–{{cfg:idealHeightBelow}} ม. · ห่างลำน้ำ {{cfg:idealWaterFrom}}–{{cfg:idealWaterBelow}} ม. จำไว้นะจ๊ะ' }],
      },
    ],
  },
  {
    id: 'explorer-khiao',
    name: 'พี่เขียว',
    appearance: 'villager',
    at: { x: 58, y: 31 },
    dialogue: [
      {
        when: { maxStep: 4 },
        ambient: true,
        nodes: [{ speaker: KHIAO, text: 'พี่เขียวเป็นนักสำรวจภาคสนาม วิเคราะห์ผ่านแล้วค่อยมาสำรวจด้วยกันนะ' }],
      },
      // ---- ฉาก 5: ก่อนออกสำรวจ ----
      {
        when: { minStep: 5, notFlags: ['explorer-briefed'] },
        nodes: [
          { speaker: KHIAO, text: 'วิเคราะห์ผ่านแล้วใช่ไหม แต่คะแนนบนแผนที่ยังไม่ใช่หลักฐาน ต้องไปดูของจริง' },
          { speaker: KHIAO, text: 'เดินไปที่วงสีเขียว (พื้นที่ที่เลือก) แล้วกดปุ่มตรวจสอบ เสร็จแล้วกลับมาหาพี่', effects: [{ type: 'flag', flag: 'explorer-briefed' }] },
        ],
      },
      // ---- ฉาก 5: ยืนยันหลักฐาน ----
      {
        when: { flags: ['field-checked'], notFlags: ['evidence-verified'] },
        nodes: [
          { speaker: KHIAO, text: 'ดูบันทึกภาคสนามที่ {{grid:chosen}}: ระดับความสูง {{site:heightScore}}/{{cfg:maxHeight}} · ระยะจากแหล่งน้ำ {{site:waterScore}}/{{cfg:maxWater}} รวม {{site:total}}/100' },
          { speaker: KHIAO, text: 'ค่าที่วัดจริงตรงกับแผนที่ และพบหลักฐานจำลองครบ พี่ยืนยันการค้นพบแล้ว ส่งรายงานให้ครูเนมนะ', effects: [{ type: 'flag', flag: 'evidence-verified' }] },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: KHIAO, text: 'ไปที่วงสีเขียวแล้วกดปุ่มตรวจสอบนะ' }],
      },
    ],
  },
];
