import type { NpcDefinition } from '../../types';

/**
 * NPC ของด่านสักงาม — บทพูดเลือกตามฉากปัจจุบัน (when) และให้ "เบาะแส" โดยไม่เฉลยเส้นทาง
 * ตัวเลขระยะ/ทิศทั้งหมดใช้ตัวแปร {{...}} ซึ่งคำนวณจากแผนที่จริง
 *
 * หมายเหตุ: ข้อมูลภูมิปัญญาผ้าปักเป็นข้อความทั่วไปเพื่อใช้ในต้นแบบ
 * ต้องตรวจสอบรายละเอียด (ลวดลาย ความหมาย ประวัติ) กับชุมชนบ้านไหนเจียวก่อนใช้สอนจริง
 */
const NEM = 'ครูเนม';
const HEADMAN = 'ผู้ใหญ่บ้าน';
const KHAM = 'ลุงคำ';
const SRI = 'ป้าศรี';
const NUAN = 'ป้านวล (ช่างผ้าปัก)';

export const sakNgamNpcs: NpcDefinition[] = [
  {
    id: 'teacher-nem',
    name: 'ครูเนม',
    appearance: 'teacher',
    at: { x: 12, y: 40 },
    dialogue: [
      {
        when: { maxStep: 1 },
        nodes: [
          { speaker: NEM, text: 'สวัสดีจ้ะ นักสืบภูมิศาสตร์! วันนี้ครูมีภารกิจพิเศษให้' },
          { speaker: NEM, text: 'ผู้ใหญ่บ้านมีปริศนาเกี่ยวกับภูมิปัญญาของชุมชน ท่านรออยู่ที่ศาลาชุมชน' },
          {
            speaker: NEM,
            text: 'ศาลาชุมชนอยู่ทาง{{dir:school>sala}}ของเสาธง ห่างเป็นเส้นตรงประมาณ {{dist:school>sala}} เมตร',
            effects: [{ type: 'clue', clueId: 'clue-sala' }],
          },
          {
            speaker: NEM,
            text: 'แต่ทางเดินจริงไม่ได้เป็นเส้นตรงเสมอไป ลองกด R เริ่มวัดระยะ แล้วเทียบดูว่าเดินจริงไกลกว่ากี่เมตร',
          },
          {
            speaker: NEM,
            text: 'จำไว้นะ 1 ช่อง = 10 เมตร (กด G ดูตาราง) เบาะแสทุกอย่างจะถูกจดในสมุดภาคสนาม กด N เปิดอ่านได้',
          },
        ],
      },
      {
        when: { minStep: 2, notFlags: ['mission-complete'] },
        ambient: true,
        nodes: [{ speaker: NEM, text: 'ภารกิจอยู่ที่ศาลาชุมชนจ้ะ ถ้าลืมเบาะแส กด N เปิดสมุดภาคสนามอ่านได้เลย' }],
      },
      {
        ambient: true,
        nodes: [{ speaker: NEM, text: 'เก่งมาก! ภารกิจที่สักงามสำเร็จแล้ว เตรียมตัวสำหรับภารกิจตำบลถัดไปนะ' }],
      },
    ],
  },
  {
    id: 'headman',
    name: 'ผู้ใหญ่บ้าน',
    appearance: 'headman',
    at: { x: 48, y: 46 },
    dialogue: [
      {
        when: { maxStep: 1 },
        ambient: true,
        nodes: [{ speaker: HEADMAN, text: 'สวัสดีหลาน ไปพบครูเนมที่โรงเรียนก่อนนะ ครูมีภารกิจให้' }],
      },
      {
        when: { minStep: 2, maxStep: 3 },
        nodes: [
          {
            speaker: HEADMAN,
            text: 'มาถึงศาลาชุมชนแล้วหรือหลาน ครูเนมบอกไว้แล้วว่าจะมีนักสืบมาช่วย',
            effects: [{ type: 'flag', flag: 'met-headman' }],
          },
          { speaker: HEADMAN, text: 'ชุมชนเรามีภูมิปัญญาที่ส่งต่อกันมาหลายรุ่น ลุงขอทายเป็นปริศนาก่อน' },
          { quiz: 'wisdom' },
          {
            speaker: HEADMAN,
            text: 'แหล่งผ้าปักอยู่ที่บ้านไหนเจียว ทาง{{dir:sala>nai-chiao}}ของศาลาชุมชนนี้',
            effects: [{ type: 'clue', clueId: 'clue-direction' }],
          },
          {
            speaker: HEADMAN,
            text: 'ลุงเคยวัดบนแผนที่มาตราส่วน 1:10,000 จากศาลาถึงแหล่งผ้าปักเป็นเส้นตรง ได้ {{mapcm:sala>nai-chiao}} เซนติเมตร',
            effects: [{ type: 'clue', clueId: 'clue-distance' }],
          },
          { quiz: 'scale' },
          {
            speaker: HEADMAN,
            text: 'แต่ทางเดินจริงมีทางแยกหลายทาง ลองถามลุงคำที่ริมลำห้วย กับป้าศรีที่ต้นสักใหญ่ แล้วนำเบาะแสมาวิเคราะห์ในสมุดภาคสนาม',
          },
        ],
      },
      {
        when: { minStep: 4, maxStep: 4 },
        ambient: true,
        nodes: [
          {
            speaker: HEADMAN,
            text: 'เบาะแสต้องครบ 3 อย่าง คือ ทิศทาง ระยะทาง และจุดสังเกต แล้วเลือกเส้นทางที่สอดคล้องกับทุกข้อในสมุดภาคสนาม (N)',
          },
        ],
      },
      {
        ambient: true,
        nodes: [{ speaker: HEADMAN, text: 'ขอบใจมากหลาน เรื่องราวของผ้าปักจะได้ถูกบันทึกไว้' }],
      },
    ],
  },
  {
    id: 'fisher-kham',
    name: 'ลุงคำ',
    appearance: 'villager',
    at: { x: 34, y: 46 },
    dialogue: [
      {
        nodes: [
          { speaker: KHAM, text: 'ลุงหาปลาอยู่ริมลำห้วยใหญ่นี้ทุกวัน สะพานบนถนนหลักตรงนี้ข้ามลำห้วยใหญ่' },
          {
            speaker: KHAM,
            text: 'ทางตอนเหนือมีห้วยสาขาแยกออกไปทางตะวันออก ข้ามได้ที่สะพานไม้เพียงแห่งเดียว',
          },
          {
            speaker: KHAM,
            text: 'ช่างผ้าปักบ้านไหนเจียวต้องข้ามสะพานไม้นั้นทุกครั้งที่นำผ้ามาที่ศาลา',
            effects: [{ type: 'clue', clueId: 'clue-bridge' }],
          },
        ],
      },
    ],
  },
  {
    id: 'villager-sri',
    name: 'ป้าศรี',
    appearance: 'villager',
    at: { x: 58, y: 32 },
    dialogue: [
      {
        nodes: [
          { speaker: SRI, text: 'ต้นไม้ใหญ่ข้างป้าคือต้นสักใหญ่ จุดสังเกตของทางแยกนี้' },
          {
            speaker: SRI,
            text: 'จากตรงนี้ถนนแยกเป็นสองทาง ทางหนึ่งตรงขึ้นทิศเหนือ อีกทางเลี้ยวไปทิศตะวันออก',
            effects: [{ type: 'clue', clueId: 'clue-fork' }],
          },
          { speaker: SRI, text: 'ป้าเคยเดินทั้งสองทาง ระยะเดินพอ ๆ กัน แต่มีทางเดียวที่ข้ามห้วยสาขา' },
        ],
      },
    ],
  },
  {
    id: 'embroiderer-nuan',
    name: 'ป้านวล',
    appearance: 'villager',
    at: { x: 71, y: 12 },
    dialogue: [
      {
        when: { maxStep: 4 },
        nodes: [
          { speaker: NUAN, text: 'ยินดีต้อนรับสู่บ้านไหนเจียวจ้ะ' },
          {
            speaker: NUAN,
            text: 'ก่อนป้าจะเล่าเรื่องลวดลาย ช่วยบันทึกการวิเคราะห์เส้นทางในสมุดภาคสนาม (N) ก่อนนะ ว่าเส้นทางไหนสอดคล้องกับเบาะแสทั้งหมด',
          },
        ],
      },
      {
        when: { minStep: 5, maxStep: 5 },
        nodes: [
          {
            speaker: NUAN,
            text: 'ป้าเป็นช่างผ้าปักของบ้านไหนเจียว ผ้าปักคือการใช้เข็มกับด้ายสีปักลงบนผืนผ้าให้เกิดเป็นลวดลาย',
          },
          { speaker: NUAN, text: 'ลวดลายสืบทอดกันในครอบครัว ผู้เรียนจะค่อย ๆ ฝึกจากผู้ใหญ่ทีละฝีเข็ม' },
          {
            speaker: NUAN,
            text: 'ป้าวาดภาพร่างลวดลายให้ เก็บไว้เป็นหลักฐานการสำรวจนะ',
            effects: [
              { type: 'evidence', evidenceId: 'evidence-pattern' },
              { type: 'flag', flag: 'evidence-collected' },
            ],
          },
          {
            speaker: NUAN,
            text: 'ต่อไปเปิดแผนที่ (M) แล้วปักหมุดตำแหน่งแหล่งผ้าปักนี้ด้วยตัวเอง ครูเนมจะได้รับข้อมูลผ่านสมุดภาคสนาม',
          },
          {
            speaker: NUAN,
            text: 'อีกเรื่องหนึ่ง ผ้าปักผืนแรกของหมู่บ้านมีลายบอกทางซ่อนอยู่ ป้าจดความหมายลงสมุดให้แล้ว ถ้าอยากรู้ลองตามไปดูนะ',
            effects: [{ type: 'clue', clueId: 'clue-old-cloth' }],
          },
        ],
      },
      {
        when: { flags: ['mystery-found'], notFlags: ['told-nuan-mystery'] },
        nodes: [
          {
            speaker: NUAN,
            text: 'หลานเจอเศษผ้าใต้ต้นไม้ใหญ่จริง ๆ หรือ! ลายนั้นคือลายที่บรรพบุรุษปักไว้ ขอบใจที่ช่วยตามหานะ',
            effects: [{ type: 'flag', flag: 'told-nuan-mystery' }],
          },
        ],
      },
      {
        when: { notFlags: ['mission-complete'] },
        ambient: true,
        nodes: [{ speaker: NUAN, text: 'อย่าลืมเปิดแผนที่ (M) ปักหมุดตำแหน่งแหล่งผ้าปักนะจ๊ะ' }],
      },
      {
        ambient: true,
        nodes: [{ speaker: NUAN, text: 'ขอบใจที่มาเรียนรู้เรื่องผ้าปักนะจ๊ะ' }],
      },
    ],
  },
];
