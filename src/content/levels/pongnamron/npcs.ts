import type { NpcDefinition } from '../../types';

/**
 * NPC ด่านโป่งน้ำร้อน — ให้เบาะแสเรื่องพิกัดกริด ตำแหน่งสัมพัทธ์ และสิ่งที่ต้องพบจริง โดยไม่บอกว่าจุดใดคือคำตอบ
 * พิกัด/ทิศ/ระยะทั้งหมดใช้ตัวแปร ({{grid}} {{dir}} {{dist}} {{gridrecord}}) ที่คำนวณจากแผนที่และข้อมูลบันทึก
 *
 * หมายเหตุ: ชื่อตัวละครและเรื่องราวเป็นข้อมูลสมมติเพื่อการเรียนรู้
 */
const NEM = 'ครูเนม';
const RUAN = 'ป้าเรือน (ผู้เก็บบันทึกสำรวจ)';
const SON = 'ลุงสอน';
const KHIAO = 'พี่เขียว (เจ้าหน้าที่ป่าไม้)';

export const pongNamRonNpcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 9, y: 50 },
    dialogue: [
      {
        when: { notFlags: ['axes-ok'] },
        nodes: [
          { speaker: NEM, text: 'ยินดีต้อนรับสู่โป่งน้ำร้อน! ภารกิจนี้คือตรวจสอบบันทึกสำรวจเก่าที่ระบุตำแหน่งบ่อน้ำร้อนธรรมชาติ' },
          {
            speaker: NEM,
            text: 'ครูให้แผนที่กริดไป ทุกตำแหน่งบอกเป็นพิกัด E กับ N หน่วยเมตร (เป็นพิกัดจำลองของเกม ไม่ใช่ละติจูด/ลองจิจูดจริง)',
            effects: [
              { type: 'evidence', evidenceId: 'grid-map' },
              { type: 'clue', clueId: 'clue-grid-rule' },
            ],
          },
          {
            speaker: NEM,
            text: 'E เพิ่มขึ้นเมื่อเดินไปทางตะวันออก ส่วน N เพิ่มขึ้นเมื่อเดินไปทางเหนือ (ขึ้นด้านบนจอ) ดูพิกัดของตัวเองได้ที่มุมซ้ายบนของจอ',
          },
          { quiz: 'grid-axes' },
          {
            speaker: NEM,
            text: 'นี่คือบันทึกสำรวจเก่า ระบุว่าบ่อน้ำร้อนธรรมชาติอยู่ที่ {{gridrecord}} แต่บันทึกนี้เก่ามาก อาจมีบางอย่างผิด',
            effects: [
              { type: 'evidence', evidenceId: 'old-record' },
              { type: 'clue', clueId: 'clue-record' },
            ],
          },
          {
            speaker: NEM,
            text: 'ก่อนอื่นไปตรวจหมุดอ้างอิง (RP) 3 หมุดในชุมชน เทียบพิกัดบนหมุดกับพิกัดของเราเอง แล้วคุยกับชาวบ้านดูนะ',
            effects: [{ type: 'clue', clueId: 'clue-rps' }],
          },
        ],
      },
      {
        ambient: true,
        nodes: [
          {
            speaker: NEM,
            text: 'อย่าเชื่อตัวเลขพิกัดเพียงอย่างเดียว ต้องตรวจทิศ ระยะจากจุดอ้างอิง และสิ่งที่เห็นจริงประกอบกันเสมอ',
          },
        ],
      },
    ],
  },
  {
    id: 'villager-son',
    name: 'ลุงสอน',
    appearance: 'villager',
    at: { x: 34, y: 42 },
    dialogue: [
      {
        when: { minStep: 4, notFlags: ['heard-old-mark'] },
        nodes: [
          { speaker: SON, text: 'ได้ยินว่ากำลังตามหาบ่อน้ำร้อนจากบันทึกเก่าหรือ ปู่ของลุงก็เคยเป็นนักสำรวจรุ่นแรกนะ' },
          {
            speaker: SON,
            text: 'ปู่ฝังหมุดสำรวจไว้ จากหมุด RP-1 ไปทาง{{dir:rp-1>old-mark}} {{dist:rp-1>old-mark}} เมตร ไม่มีป้ายบอกหรอก ต้องคำนวณพิกัดแล้วเดินไปเอง',
            effects: [
              { type: 'clue', clueId: 'clue-old-mark' },
              { type: 'flag', flag: 'heard-old-mark' },
            ],
          },
        ],
      },
      {
        nodes: [
          { speaker: SON, text: 'หมุดอ้างอิงในชุมชนมีสามหมุด กรมที่ดินมาฝังไว้ บนหมุดมีตัวเลขพิกัดตอกไว้' },
          {
            speaker: SON,
            text: 'แถวนี้มีที่ที่คนเรียกว่า "บ่อน้ำร้อน" หลายแห่งนะ ทั้งบ่อแช่เท้าคอนกรีตที่ชุมชนต่อท่อน้ำอุ่นมา ซึ่งมีไอน้ำลอยขึ้นตลอด',
            effects: [{ type: 'clue', clueId: 'clue-footbath' }],
          },
          { speaker: SON, text: 'ส่วนบ่อน้ำร้อนธรรมชาติจริง ๆ ลุงไม่เคยไปเองหรอก ได้ยินแต่ว่าอยู่ทางเขา' },
        ],
      },
    ],
  },
  {
    id: 'record-keeper',
    name: 'ป้าเรือน',
    appearance: 'headman',
    at: { x: 31, y: 47 },
    dialogue: [
      {
        when: { maxStep: 2 },
        ambient: true,
        nodes: [{ speaker: RUAN, text: 'สวัสดีจ้ะ ไปตรวจหมุดอ้างอิงในชุมชนให้ครบก่อนนะ แล้วค่อยมาคุยเรื่องบันทึกกับป้า' }],
      },
      {
        when: { minStep: 3, maxStep: 3 },
        nodes: [
          { speaker: RUAN, text: 'ป้าเก็บบันทึกสำรวจของตำบลไว้ทุกเล่ม เล่มที่หลานถืออยู่เป็นของนักสำรวจรุ่นแรก' },
          {
            speaker: RUAN,
            text: 'นักสำรวจรุ่นนั้นบางคนนับค่า N จากขอบบนของแผนที่ลงมา เหมือนนับบรรทัดในสมุด ไม่ใช่นับจากขอบล่างขึ้นไปทางเหนือ',
            effects: [{ type: 'clue', clueId: 'clue-convention' }],
          },
          {
            speaker: RUAN,
            text: 'แต่ในบันทึกยังเขียนต่อไว้ว่า: "จากหมุด RP-2 ไปทาง{{dir:rp-2>site-b}} ราว {{dist:rp-2>site-b}} เมตร"',
            effects: [{ type: 'clue', clueId: 'clue-relative' }],
          },
          {
            speaker: RUAN,
            text: 'และ "ที่บ่อมีไอน้ำร้อนลอยขึ้น และมีหินปูนสีขาวล้อมรอบ" — ต้องไปดูของจริงจึงจะยืนยันได้',
            effects: [{ type: 'clue', clueId: 'clue-field' }],
          },
          { quiz: 'north-100' },
        ],
      },
      {
        when: { minStep: 4, maxStep: 4 },
        ambient: true,
        nodes: [
          {
            speaker: RUAN,
            text: 'ไปสำรวจจุด A, B, C ด้วยตัวเอง (กด E ที่จุดนั้น) แล้วกด C เปิดกระดานวิเคราะห์พิกัด เลือกจุดที่ตรงหลักฐานครบทั้งสามชนิดนะ',
          },
        ],
      },
      {
        when: { minStep: 5, maxStep: 5 },
        ambient: true,
        nodes: [
          {
            speaker: RUAN,
            text: 'วิเคราะห์ได้แล้ว! เดินไปที่จุดนั้น กด E ตรวจยืนยันทั้งพิกัด ทิศ/ระยะ และของจริง แล้วเปิดแผนที่ (M) ปักหมุด',
          },
        ],
      },
      {
        when: { minStep: 6 },
        ambient: true,
        nodes: [{ speaker: RUAN, text: 'ขอบใจมากหลาน บันทึกสำรวจของตำบลจะได้ถูกต้องเสียที' }],
      },
      {
        ambient: true,
        nodes: [
          {
            speaker: RUAN,
            text: 'พิกัดในบันทึกอ่านได้สองแบบ แบบไหนถูกต้องต้องตรวจกับทิศ ระยะจาก RP-2 และสิ่งที่พบจริงที่จุดนั้น',
          },
        ],
      },
    ],
  },
  {
    id: 'ranger-khiao',
    name: 'พี่เขียว',
    appearance: 'student',
    at: { x: 58, y: 30 },
    dialogue: [
      {
        nodes: [
          { speaker: KHIAO, text: 'พี่ดูแลป่าบนเขาทางตะวันออกเฉียงเหนือ เส้นชั้นความสูงบนแผนที่ (M) จะช่วยให้รู้ว่าตรงไหนเป็นเขา' },
          {
            speaker: KHIAO,
            text: 'อยากฝึกเดินตามพิกัดไหม? จุดชมวิวของตำบลอยู่ที่ {{grid:viewpoint}} ลองดูพิกัดบนจอแล้วเดินไปให้ถึงดูสิ',
            effects: [{ type: 'clue', clueId: 'clue-viewpoint' }],
          },
        ],
      },
    ],
  },
];
