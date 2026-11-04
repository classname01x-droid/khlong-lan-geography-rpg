import type { LevelDefinition } from '../../types';
import { sakNgamMap } from './map';

/**
 * ด่านที่ 1: ปริศนาลวดลายแห่งสักงาม
 * ไฟล์นี้มีแต่ "เนื้อหา" — ไม่มีโค้ดระบบเกม
 */
export const sakNgamLevel: LevelDefinition = {
  id: 'sakngam',
  tambon: 'ตำบลสักงาม',
  title: 'ปริศนาลวดลายแห่งสักงาม',
  map: sakNgamMap,
  spawn: { x: 14, y: 43 },
  fog: { revealRadiusTiles: 5 },

  landmarks: [
    { id: 'school', name: 'โรงเรียนสักงาม (เสาธง)', at: { x: 15, y: 40 }, showLabel: true },
    { id: 'bridge', name: 'สะพานข้ามลำห้วย', at: { x: 32, y: 48 }, showLabel: true },
    { id: 'sala', name: 'ศาลาชุมชน', at: { x: 46, y: 45 }, showLabel: true },
    { id: 'headman-house', name: 'บ้านผู้ใหญ่บ้าน', at: { x: 54, y: 43 }, showLabel: true },
    { id: 'pond', name: 'สระน้ำ', at: { x: 40, y: 19 }, showLabel: true },
    { id: 'big-teak', name: 'ต้นสักใหญ่', at: { x: 58, y: 30 }, showLabel: true },
    { id: 'rock-field', name: 'ทุ่งหิน', at: { x: 74, y: 30 }, showLabel: true },
    { id: 'nai-chiao', name: 'แหล่งผ้าปักบ้านไหนเจียว', at: { x: 64, y: 15 }, showLabel: true },
  ],

  npcs: [
    {
      id: 'teacher-nem',
      name: 'ครูเนม',
      appearance: 'teacher',
      at: { x: 12, y: 40 },
      dialogue: [
        { speaker: 'ครูเนม', text: 'สวัสดีจ้ะ นักสืบภูมิศาสตร์! วันนี้ครูมีภารกิจพิเศษให้' },
        { speaker: 'ครูเนม', text: 'ผู้ใหญ่บ้านมีปริศนาเกี่ยวกับลวดลายผ้าปักของชุมชน ท่านรออยู่ที่ศาลาชุมชน' },
        {
          speaker: 'ครูเนม',
          text: 'ศาลาชุมชนอยู่ทาง{{dir:school>sala}}ของเสาธง ห่างเป็นเส้นตรงประมาณ {{dist:school>sala}} เมตร',
        },
        {
          speaker: 'ครูเนม',
          text: 'แต่ทางเดินจริงไม่ได้เป็นเส้นตรงเสมอไป ลองกด R เริ่มวัดระยะ แล้วเทียบดูว่าเดินจริงไกลกว่ากี่เมตร',
        },
        {
          speaker: 'ครูเนม',
          text: 'จำไว้นะ 1 ช่อง = 10 เมตร (กด G ดูตาราง) และสังเกตจุดสังเกตระหว่างทางด้วย เช่น สะพาน',
        },
      ],
    },
    {
      id: 'headman',
      name: 'ผู้ใหญ่บ้าน',
      appearance: 'headman',
      at: { x: 48, y: 46 },
      dialogue: [
        { speaker: 'ผู้ใหญ่บ้าน', text: 'มาถึงแล้วหรือหลาน ครูเนมบอกไว้แล้วว่าจะมีนักสืบมาช่วย' },
        {
          speaker: 'ผู้ใหญ่บ้าน',
          text: 'ลวดลายผ้าปักของเราซ่อนเรื่องราวไว้ ต้นทางอยู่ที่แหล่งผ้าปักบ้านไหนเจียว ทาง{{dir:sala>nai-chiao}}ของศาลา',
        },
        {
          speaker: 'ผู้ใหญ่บ้าน',
          text: 'ห่างจากศาลาเป็นเส้นตรงราว {{dist:sala>nai-chiao}} เมตร แต่ทางแยกขึ้นเหนือมีหลายทาง บางทางก็ไปตัน',
        },
        { speaker: 'ผู้ใหญ่บ้าน', text: '(ต้นแบบ) ปริศนาผ้าปักฉบับเต็มจะเปิดในเวอร์ชันถัดไป' },
      ],
    },
  ],

  story: [
    {
      order: 1,
      title: 'ครูเนมมอบภารกิจที่โรงเรียนสักงาม',
      objective: 'คุยกับครูเนมเพื่อรับภารกิจ',
      landmarkId: 'school',
      status: 'prototype',
      completeWhen: { type: 'talk', npcId: 'teacher-nem' },
    },
    {
      order: 2,
      title: 'เดินทางไปศาลาชุมชน',
      objective: 'ใช้ทิศและระยะทางจากครูเนมเดินไปศาลาชุมชน แล้วคุยกับผู้ใหญ่บ้าน',
      landmarkId: 'sala',
      status: 'prototype',
      completeWhen: { type: 'talk', npcId: 'headman' },
    },
    {
      order: 3,
      title: 'ผู้ใหญ่บ้านเปิดเผยปริศนาผ้าปัก',
      objective: 'ฟังปริศนาจากผู้ใหญ่บ้าน',
      landmarkId: 'sala',
      status: 'planned',
    },
    {
      order: 4,
      title: 'รวบรวมเบาะแสและเปรียบเทียบเส้นทาง',
      objective: 'เปรียบเทียบเส้นทางทั้ง 3 เส้นด้วยระยะทาง ทิศ และจุดสังเกต',
      landmarkId: 'big-teak',
      status: 'planned',
    },
    {
      order: 5,
      title: 'สำรวจแหล่งผ้าปักบ้านไหนเจียว',
      objective: 'ค้นหาลวดลายที่ตรงกับปริศนา',
      landmarkId: 'nai-chiao',
      status: 'planned',
    },
    {
      order: 6,
      title: 'บันทึกตำแหน่ง รับรหัส และจบภารกิจ',
      objective: 'บันทึกพิกัดลงแผนที่และรับรหัสลับของตำบลสักงาม',
      landmarkId: 'nai-chiao',
      status: 'planned',
    },
  ],
};
