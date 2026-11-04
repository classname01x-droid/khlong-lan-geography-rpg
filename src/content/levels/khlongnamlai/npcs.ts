import type { NpcDefinition } from '../../types';

/**
 * NPC ด่านคลองน้ำไหล — ให้ข้อมูลภูมิศาสตร์และเบาะแส โดยไม่บอกว่าจุดใดคือเป้าหมาย
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
        when: { notFlags: ['got-base-maps'] },
        nodes: [
          { speaker: NEM, text: 'ยินดีต้อนรับสู่คลองน้ำไหล! ภารกิจครั้งนี้เกี่ยวกับทรัพยากรน้ำของชุมชน' },
          {
            speaker: NEM,
            text: 'ข้อมูลแหล่งน้ำของตำบลนี้ขัดแย้งกัน แผนที่ฐานสองฉบับระบุตาน้ำต้นลำห้วยและทิศน้ำไหลไม่ตรงกัน',
            effects: [{ type: 'clue', clueId: 'clue-conflict' }],
          },
          {
            speaker: NEM,
            text: 'ครูให้แผนที่ฐานทั้งฉบับ A และฉบับ B ไป ใช้มาตราส่วน 1:10,000 เหมือนแผนที่สำรวจของเรา',
            effects: [
              { type: 'evidence', evidenceId: 'map-a' },
              { type: 'evidence', evidenceId: 'map-b' },
              { type: 'flag', flag: 'got-base-maps' },
            ],
          },
          {
            speaker: NEM,
            text: 'ฝึกอ่านสัญลักษณ์ก่อนนะ: เส้นน้ำเงินคือลำน้ำ เส้นน้ำตาลคือถนน เส้นคู่คือสะพาน ต้นข้าวคือพื้นที่เกษตร สามเหลี่ยมคือหมุดหลักฐานระดับ',
            effects: [{ type: 'clue', clueId: 'clue-symbols' }],
          },
          { speaker: NEM, text: 'กด M เปิดแผนที่ แล้วกด Tab สลับดูฉบับ A และ B ให้ครบ ดูกล่องคำอธิบายสัญลักษณ์ด้านขวาด้วย' },
          {
            speaker: NEM,
            text: 'จากนั้นไปสำรวจชุมชนริมคลอง ทาง{{dir:school>village}}ของโรงเรียน ห่างเป็นเส้นตรงประมาณ {{dist:school>village}} เมตร',
            effects: [{ type: 'clue', clueId: 'clue-village' }],
          },
        ],
      },
      {
        when: { maxStep: 1 },
        ambient: true,
        nodes: [{ speaker: NEM, text: 'กด M แล้วกด Tab ดูแผนที่ฐานทั้งฉบับ A และ B ให้ครบก่อนนะ แล้วค่อยไปสำรวจชุมชน' }],
      },
      {
        ambient: true,
        nodes: [
          { speaker: NEM, text: 'อย่าเชื่อแผนที่ฉบับใดฉบับหนึ่งทันที ตรวจกับระดับความสูงและสิ่งที่เห็นจริงก่อนเสมอ (เบาะแสอยู่ในสมุด กด N)' },
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
        when: { flags: ['flow-known'], notFlags: ['heard-jar'] },
        nodes: [
          { speaker: HOM, text: 'รู้แล้วหรือว่าน้ำไหลไปทางไหน เก่งจริง ๆ ยายมีเรื่องเล่าอีกเรื่อง' },
          {
            speaker: HOM,
            text: 'ปู่ทวดเคยฝังไหดินเผาไว้ตรงจุดที่สูงที่สุดของเนินทางตะวันออกของหมู่บ้าน ลองใช้แผนที่หาดูสิ',
            effects: [
              { type: 'clue', clueId: 'clue-jar' },
              { type: 'flag', flag: 'heard-jar' },
            ],
          },
        ],
      },
      {
        nodes: [
          { speaker: HOM, text: 'สะพานคอนกรีตกลางหมู่บ้านนี้ข้ามลำห้วยสายเดียวของตำบลเรา' },
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
  {
    id: 'farmer-phet',
    name: 'ลุงเพชร',
    appearance: 'villager',
    at: { x: 60, y: 48 },
    dialogue: [
      {
        nodes: [
          { speaker: PHET, text: 'พื้นที่เกษตรแถบนี้ปลูกข้าวกับข้าวโพด อาศัยน้ำจากลำห้วยที่ส่งผ่านฝาย' },
          {
            speaker: PHET,
            text: 'ชาวบ้านเรียกฝายว่า "ต้นน้ำของนา" เพราะน้ำทุกหยดที่เข้านาต้องผ่านฝาย ส่วนบ่อตรงนี้ลุงขุดเองไว้เก็บน้ำฝน',
            effects: [{ type: 'clue', clueId: 'clue-weir' }],
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
        when: { notFlags: ['flow-known'] },
        nodes: [
          { speaker: PHUM, text: 'พี่เป็นอาสาสมัครสำรวจแผนที่ของตำบล กำลังเก็บข้อมูลระดับความสูงอยู่' },
          {
            speaker: PHUM,
            text: 'น้ำไหลจากที่สูงไปที่ต่ำเสมอ ต้องดูระดับความสูง ไม่ใช่ดูว่าอยู่ด้านบนหรือด้านล่างของแผนที่',
            effects: [{ type: 'clue', clueId: 'clue-elev-rule' }],
          },
          {
            speaker: PHUM,
            text: 'หมุดหลักฐานระดับ (BM) มีสองหมุด อยู่ทาง{{dir:bridge>bm-north}}และทาง{{dir:bridge>bm-south}}ของสะพาน เดินไปใกล้ ๆ แล้วกด E อ่านค่าได้',
          },
        ],
      },
      {
        ambient: true,
        nodes: [
          {
            speaker: PHUM,
            text: 'บนแผนที่ (M) เส้นบาง ๆ คือเส้นชั้นความสูงทุก 10 เมตร ถ้าเป็นวงปิดซ้อนกันคือเนิน วงในสุดคือยอดเนิน',
          },
        ],
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
        when: { maxStep: 2 },
        ambient: true,
        nodes: [
          {
            speaker: CHAN,
            text: 'สวัสดีจ้ะ ลองเดินสำรวจชุมชนริมคลองก่อนนะ คุยกับชาวบ้าน แล้วไปดูสะพานกับฝายด้วยตาตัวเอง แล้วค่อยกลับมาหาป้า',
          },
        ],
      },
      {
        when: { minStep: 3, maxStep: 3 },
        nodes: [
          { speaker: CHAN, text: 'ป้าดูแลแหล่งน้ำของหมู่บ้านมาหลายสิบปี ป้าวัดระดับความสูงตามลำห้วยไว้สามจุด' },
          {
            speaker: CHAN,
            text: 'จุด A สูง {{elev:site-a}} เมตร · จุด B สูง {{elev:site-b}} เมตร · จุด C สูง {{elev:site-c}} เมตร จากระดับทะเลปานกลาง',
            effects: [{ type: 'clue', clueId: 'clue-elev-abc' }],
          },
          {
            speaker: CHAN,
            text: 'ทั้งสามจุดอยู่บนลำห้วยสายเดียวกัน ต่อเนื่องกันตามลำดับ A – B – C (ดูตำแหน่งได้บนแผนที่ฐาน)',
            effects: [{ type: 'clue', clueId: 'clue-connect' }],
          },
          { quiz: 'flow' },
          {
            speaker: CHAN,
            text: 'ต่อไปเทียบแผนที่ฐานสองฉบับ (กด C) แต่ต้องไปดูหินสามก้อนและจุด C ด้วยตัวเองก่อนนะ จะได้รู้ว่าฉบับไหนเขียนถูก',
          },
        ],
      },
      {
        when: { minStep: 4, maxStep: 4 },
        ambient: true,
        nodes: [
          {
            speaker: CHAN,
            text: 'แผนที่ที่เชื่อได้ต้องตรงทั้งสัญลักษณ์ ระดับความสูง และสิ่งที่หลานเห็นจริง กด C เพื่อเปรียบเทียบ',
          },
        ],
      },
      {
        when: { minStep: 5, maxStep: 5 },
        ambient: true,
        nodes: [
          {
            speaker: CHAN,
            text: 'ตาน้ำต้นลำห้วยอยู่ที่จุดไหนในสามจุด? เดินไปสำรวจ (กด E) แล้วปักหมุดบนแผนที่ (M) ให้ตรงจุดนะ',
          },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: CHAN, text: 'ขอบใจมากหลาน ชาวบ้านจะได้ช่วยกันดูแลตาน้ำให้ดี' }],
      },
    ],
  },
];
