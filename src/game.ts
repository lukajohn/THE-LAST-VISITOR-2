import { EVIDENCE, DEDUCTIONS } from './data';
import type { Evidence } from './data';

type Scene = 'menu' | 'bedroom' | 'office' | 'talk' | 'end';
interface Save { v: 1; scene: Scene; found: string[]; ded: string[]; flags: string[]; presence: number }
interface Act { x: number; y: number; w: number; h: number; fn: () => void }

const KEY = 'tlv2-save';
const W = 320;
const H = 180;
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d') as CanvasRenderingContext2D;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let scene: Scene = 'menu';
let found: string[] = [];
let ded: string[] = [];
let flags = new Set<string>();
let presence = 0;
let overlay: 'none' | 'board' | 'credits' = 'none';
let msg: string | null = null;
let sel: string[] = [];
let detail = '';
let picking = false;
let talkLine = '';
let hasSave = false;
let sound = false;
let mx = -1;
let my = -1;
let focus = -1;
let acts: Act[] = [];
let live = true;
let tip = '';
let t = 0;
const rain = Array.from({ length: 45 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 60 + Math.random() * 60 }));

// ---------- save ----------
function save(): void {
  if (scene === 'menu') return;
  try {
    const s: Save = { v: 1, scene, found, ded, flags: [...flags], presence };
    localStorage.setItem(KEY, JSON.stringify(s));
    hasSave = true;
  } catch { /* storage unavailable */ }
}
function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Save>;
    const strs = (a: unknown): a is string[] => Array.isArray(a) && a.every((x) => typeof x === 'string');
    const ok = s.scene === 'bedroom' || s.scene === 'office' || s.scene === 'talk' || s.scene === 'end';
    if (s.v !== 1 || !ok || !strs(s.found) || !strs(s.ded) || !strs(s.flags) || typeof s.presence !== 'number') return null;
    return s as Save;
  } catch { return null; }
}

// ---------- audio (off until the player turns it on) ----------
let ac: AudioContext | null = null;
let rainGain: GainNode | null = null;
function toggleSound(): void {
  sound = !sound;
  if (!sound) { if (rainGain) rainGain.gain.value = 0; return; }
  try {
    if (!ac) {
      ac = new AudioContext();
      const len = ac.sampleRate * 2;
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ac.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      rainGain = ac.createGain();
      src.connect(lp); lp.connect(rainGain); rainGain.connect(ac.destination);
      src.start();
    }
    void ac.resume();
    if (rainGain) rainGain.gain.value = 0.05;
  } catch { sound = false; }
}
function ring(): void {
  if (!sound || !ac) return;
  for (let i = 0; i < 4; i++) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square'; o.frequency.value = i % 2 ? 480 : 440; g.gain.value = 0.02;
    o.connect(g); g.connect(ac.destination);
    const s = ac.currentTime + i * 0.25;
    o.start(s); o.stop(s + 0.2);
  }
}

// ---------- game logic ----------
function go(s: Scene): void {
  scene = s; overlay = 'none'; msg = null; focus = -1; sel = [];
  if (s === 'talk') {
    picking = false;
    talkLine = "Dr. W. Archer does not stand. 'Detective. A terrible business. I did everything a man could for her.'";
  }
  if (s === 'office' && presence >= 4 && !flags.has('phone')) {
    flags.add('phone'); ring();
    msg = 'The telephone rings. You lift it. Someone is breathing, patient and close. Then the line goes dead.';
  }
  save();
}
function newGame(): void {
  found = []; ded = []; flags = new Set(); presence = 0; detail = '';
  go('bedroom');
  msg = 'California, 1964. A bedroom kept exactly as it was left.\n\nClick objects to inspect them. Arrow keys + E also work. B opens the evidence board.';
}
function cont(): void {
  const s = readSave();
  if (!s) { hasSave = false; return; }
  found = s.found.filter((id) => EVIDENCE.some((e) => e.id === id));
  ded = s.ded.filter((id) => DEDUCTIONS.some((d) => d.id === id));
  flags = new Set(s.flags); presence = s.presence; detail = '';
  go(s.scene);
}
function descOf(e: Evidence): string {
  if (e.id === 'photo' && flags.has('phone')) return e.desc + ' You are almost certain the man at the back was standing farther from the camera before.';
  return e.desc;
}
function inspect(e: Evidence): void {
  if (!found.includes(e.id)) { found.push(e.id); presence++; }
  let m = '[' + e.cat + '] ' + e.name + '\n' + descOf(e);
  if (found.length >= 3 && !flags.has('door')) {
    flags.add('door');
    m += '\n\nBehind you, the bedroom door stands open. You are sure you closed it.';
  }
  msg = m; save();
}
function tryConnect(a: string, b: string): void {
  const d = DEDUCTIONS.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  const na = EVIDENCE.find((e) => e.id === a)?.name ?? a;
  const nb = EVIDENCE.find((e) => e.id === b)?.name ?? b;
  if (d) {
    if (ded.includes(d.id)) msg = 'Already established: ' + d.text;
    else { ded.push(d.id); presence++; msg = 'DEDUCTION: ' + d.text; }
  } else {
    msg = 'Nothing ties the ' + na + ' to the ' + nb + ' directly. Ask what each one proves: motive, timing, or a pattern.';
  }
  sel = []; save();
}
function pick(id: string): void {
  const e = EVIDENCE.find((v) => v.id === id);
  if (e) detail = '[' + e.cat + '] ' + e.name + ': ' + descOf(e);
  if (sel.includes(id)) { sel = sel.filter((x) => x !== id); return; }
  sel.push(id);
  if (sel.length === 2) tryConnect(sel[0], sel[1]);
}
function present(id: string): void {
  picking = false;
  if (id === 'chart' || id === 'statement') {
    if (!flags.has('asked')) talkLine = "'What am I looking at?' You should hear his version of Thursday first.";
    else if (!ded.includes('d2')) talkLine = 'You sense a contradiction but cannot state it yet. Connect these on the board first.';
    else {
      flags.add('won'); presence++;
      talkLine = "His smile slips. 'The hour on the certificate... I may have been mistaken. I was tired.' The room goes quiet. He does not look at you again.";
    }
  } else if (id === 'ring') {
    flags.add('ringSeen');
    talkLine = "He goes very still. 'Never seen it.' He answers too fast, and you both know it.";
  } else {
    talkLine = "'Sentiment and paperwork, Detective. None of it proves anything.'";
  }
  save();
}
function journal(): void {
  const l = DEDUCTIONS.filter((d) => ded.includes(d.id)).map((d) => '- ' + d.text);
  msg = 'CASE JOURNAL\n' + (l.length ? l.join('\n') : 'Nothing established yet. Pin related evidence together on the board.');
}

// ---------- drawing helpers ----------
function r(c: string, x: number, y: number, w: number, h: number): void { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
function inside(x: number, y: number, w: number, h: number): boolean { return mx >= x && mx < x + w && my >= y && my < y + h; }
function lines(text: string, w: number): string[] {
  const out: string[] = [];
  for (const p of text.split('\n')) {
    let line = '';
    for (const wd of p.split(' ')) {
      const test = line ? line + ' ' + wd : wd;
      if (line && ctx.measureText(test).width > w) { out.push(line); line = wd; } else line = test;
    }
    out.push(line);
  }
  return out;
}
function wrapP(text: string, x: number, y: number, w: number): number {
  for (const l of lines(text, w)) { ctx.fillText(l, x, y); y += 9; }
  return y;
}
function btn(x: number, y: number, w: number, h: number, label: string, fn: () => void, on = false): void {
  const idx = acts.length;
  if (live) acts.push({ x, y, w, h, fn });
  const hv = live && (inside(x, y, w, h) || idx === focus);
  r(on ? '#5a2e2a' : hv ? '#3b342a' : '#221d17', x, y, w, h);
  ctx.strokeStyle = hv ? '#d8c58a' : '#6b5d44';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = live ? '#e6dcc2' : '#8a8272';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + 4, y + h / 2 + 0.5, w - 8);
  ctx.textBaseline = 'alphabetic';
}
function hot(x: number, y: number, w: number, h: number, label: string, fn: () => void, glint = false): void {
  const idx = acts.length;
  if (live) acts.push({ x, y, w, h, fn });
  if (live && (inside(x, y, w, h) || idx === focus)) {
    ctx.strokeStyle = '#d8c58a';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    tip = label;
  } else if (live && glint && Math.floor(t * 2) % 2 === 0) {
    r('#d8c58a', x + (w >> 1), y + (h >> 1), 1, 1);
  }
}
function win(x: number, y: number, w: number, h: number): void {
  r('#0e141a', x, y, w, h);
  const f = Math.max(0, Math.sin(t * 0.37) - 0.97) * 30;
  if (f > 0 && !reduced) { ctx.fillStyle = 'rgba(200,210,230,' + Math.min(f, 0.8) + ')'; ctx.fillRect(x, y, w, h); }
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#5f7284';
  for (const p of rain) ctx.fillRect(x + (p.x % w), y + (Math.max(p.y, 0) % h), 1, 3);
  ctx.restore();
  r('#4a3b2a', x - 2, y - 2, w + 4, 2); r('#4a3b2a', x - 2, y + h, w + 4, 2);
  r('#4a3b2a', x - 2, y, 2, h); r('#4a3b2a', x + w, y, 2, h); r('#4a3b2a', x + (w >> 1) - 1, y, 2, h);
}
function wall(): void {
  r('#26211c', 0, 0, W, 130);
  for (let x = 0; x < W; x += 8) r('#2b251f', x, 0, 2, 130);
  r('#3a2e22', 0, 130, W, 50); r('#1d160f', 0, 130, W, 2);
}
function door(): void {
  r('#201a14', 274, 40, 38, 90); r('#c9b27a', 278, 86, 2, 3);
  if (flags.has('door') && scene === 'bedroom') r('#030303', 274, 40, 12, 90);
}
function hud(boardOk: boolean): void {
  ctx.fillStyle = '#b9ad8c';
  ctx.fillText('Evidence ' + found.length + '/' + EVIDENCE.length + '  Deductions ' + ded.length + '/' + DEDUCTIONS.length, 6, 10);
  if (boardOk) btn(222, 2, 44, 11, 'Board', () => { overlay = 'board'; });
  btn(270, 2, 48, 11, sound ? 'Sound:on' : 'Sound:off', toggleSound);
}

// ---------- scenes ----------
function drawMenu(): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1612'); g.addColorStop(1, '#0a0908');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4f6272';
  for (const p of rain) ctx.fillRect(p.x, p.y, 1, 4);
  r('#050505', 220, 78, 90, 60); r('#050505', 214, 70, 102, 10);
  if (Math.sin(t * 3) > -0.9) r('#c9a74a', 236, 96, 8, 10);
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px serif'; ctx.fillStyle = '#7a1f1f'; ctx.fillText('THE LAST VISITOR', 161, 41);
  ctx.fillStyle = '#e6dcc2'; ctx.fillText('THE LAST VISITOR', 160, 40);
  ctx.font = 'italic 9px serif'; ctx.fillStyle = '#b9ad8c'; ctx.fillText('Some doors should never have been opened.', 160, 54);
  ctx.textAlign = 'left'; ctx.font = '9px monospace';
  btn(100, 76, 100, 12, 'New Game', newGame);
  if (hasSave) btn(100, 90, 100, 12, 'Continue', cont);
  btn(100, 104, 100, 12, sound ? 'Sound: on' : 'Sound: off', toggleSound);
  btn(100, 118, 100, 12, 'Credits', () => { overlay = 'credits'; });
  ctx.fillStyle = '#6b5d44';
  ctx.fillText('Mouse, touch, or Tab/Arrows + E', 50, 170);
}
function drawBedroom(): void {
  wall(); win(120, 24, 50, 46);
  r('#3f3022', 12, 84, 50, 46); r('#4d3b2a', 10, 82, 54, 4); r('#33271a', 16, 100, 42, 1); r('#33271a', 16, 114, 42, 1);
  r('#6b5a3c', 40, 70, 14, 12); r('#a89f8a', 42, 72, 10, 8);
  r('#4b3a2e', 92, 112, 100, 18); r('#3a2c22', 92, 104, 4, 26); r('#3a2c22', 188, 104, 4, 26);
  r('#8a8070', 96, 104, 92, 10); r('#a89f8a', 98, 100, 20, 6); r('#5a2e2a', 122, 104, 66, 10);
  r('#3f3022', 198, 108, 22, 22); r('#e8c070', 205, 98, 6, 5); r('#6b5a3c', 207, 103, 2, 5);
  r('#3a2c20', 226, 100, 42, 30); r('#4a3a28', 224, 98, 46, 3); r('#bdb59d', 232, 94, 16, 4);
  door();
  const g = ctx.createRadialGradient(208, 100, 2, 208, 100, 70);
  g.addColorStop(0, 'rgba(232,192,112,0.28)'); g.addColorStop(1, 'rgba(232,192,112,0)');
  ctx.fillStyle = g; ctx.fillRect(130, 30, 160, 140);
  for (const e of EVIDENCE) hot(e.x, e.y, e.w, e.h, e.name, () => inspect(e), !found.includes(e.id));
  hot(120, 24, 50, 46, 'The window', () => { msg = 'Rain on the glass. Somewhere below, a car idles, then stops.'; });
  hot(274, 40, 38, 90, 'Leave for the office', () => {
    if (found.length >= 3) go('office'); else msg = 'There is more in this room. You are not finished here.';
  });
  hud(true);
}
function cardPos(id: string): { x: number; y: number } {
  const i = found.indexOf(id);
  return { x: 43 + (i % 3) * 32, y: 48 + Math.floor(i / 3) * 28 };
}
function drawOffice(): void {
  wall(); win(150, 26, 50, 40);
  r('#3a2a18', 22, 28, 104, 74); r('#6b4f31', 25, 31, 98, 68);
  found.forEach((_id, i) => {
    r('#c9bfa3', 30 + (i % 3) * 32, 38 + Math.floor(i / 3) * 28, 26, 20);
    r('#7a1f1f', 41 + (i % 3) * 32, 36 + Math.floor(i / 3) * 28, 3, 3);
  });
  ctx.strokeStyle = '#8e2b2b';
  for (const d of DEDUCTIONS) {
    if (ded.includes(d.id) && found.includes(d.a) && found.includes(d.b)) {
      const a = cardPos(d.a); const b = cardPos(d.b);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  r('#4a3a28', 126, 104, 118, 5); r('#33271a', 130, 109, 110, 21); r('#bdb59d', 142, 100, 22, 4); r('#111111', 200, 99, 14, 5);
  door();
  hot(22, 28, 104, 74, 'Evidence board', () => { overlay = 'board'; });
  hot(140, 96, 28, 8, 'Case journal', journal);
  hot(198, 97, 18, 8, 'Telephone', () => {
    msg = flags.has('phone') ? 'The receiver is warm, as if someone only just set it down.' : 'Silent. For now.';
  });
  hot(274, 40, 38, 90, 'Interrogation room', () => {
    if (ded.length >= 1) go('talk'); else msg = 'You have nothing to put to him yet. Connect your evidence on the board first.';
  });
  hud(true);
}
function drawTalk(): void {
  r('#17130f', 0, 0, W, 104);
  ctx.fillStyle = 'rgba(232,200,120,0.07)';
  ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(170, 0); ctx.lineTo(240, 96); ctx.lineTo(80, 96); ctx.fill();
  r('#2a2119', 70, 80, 180, 6); r('#1f1812', 80, 86, 4, 18); r('#1f1812', 236, 86, 4, 18);
  r('#050505', 40, 52, 22, 40); r('#050505', 36, 40, 30, 3); r('#050505', 43, 34, 16, 8);
  r('#0b0a09', 250, 50, 26, 42); r('#0b0a09', 255, 36, 16, 6); r('#0b0a09', 256, 40, 14, 10);
  if (presence >= 5) { r('rgba(200,200,200,0.07)', 296, 56, 10, 44); r('rgba(200,200,200,0.07)', 297, 48, 8, 8); }
  r('#0c0a08', 6, 104, 308, 72);
  ctx.strokeStyle = '#6b5d44'; ctx.strokeRect(6.5, 104.5, 307, 71);
  ctx.fillStyle = '#e6dcc2';
  wrapP(talkLine, 12, 115, 296);
  if (!picking) {
    btn(10, 150, 150, 11, 'Ask about Thursday evening', () => {
      flags.add('asked'); save();
      talkLine = "'I sat with her until twenty past seven. She was resting when I left. Ask anyone.'";
    });
    btn(164, 150, 146, 11, 'Present evidence', () => { picking = true; talkLine = 'Show him what?'; });
    btn(10, 163, 150, 11, 'Ask about the policy', () => {
      talkLine = found.includes('policy')
        ? "'She insisted. A sick woman's wish. Would you have denied her?'"
        : "'What policy?' He smiles, a little too quickly.";
    });
    btn(164, 163, 146, 11, 'End interview', () => go('end'));
  } else {
    found.forEach((id, i) => {
      const e = EVIDENCE.find((v) => v.id === id);
      if (e) btn(10 + (i % 2) * 154, 136 + Math.floor(i / 2) * 13, 150, 11, e.name, () => present(id));
    });
    btn(268, 106, 42, 11, 'Back', () => { picking = false; talkLine = 'He waits, hands folded.'; });
  }
  hud(false);
}
function drawEnd(): void {
  const win2 = flags.has('won') && ded.length >= 2;
  r('#0a0908', 0, 0, W, H);
  ctx.fillStyle = win2 ? '#d8c58a' : '#8e2b2b';
  ctx.font = 'bold 14px serif';
  ctx.fillText(win2 ? 'CONCLUSIVE CASE' : 'INCOMPLETE CASE', 12, 26);
  ctx.font = '9px monospace'; ctx.fillStyle = '#e6dcc2';
  const text = win2
    ? 'The contradiction holds. The certificate puts her death an hour before the man who signed it says he left her side, and the paper trail leads back to his name. The district attorney reopens the file. It is not the end of what he did. It is only the first door you were able to open.'
    : 'You have pages, photographs, and a feeling that will not leave you. Without the contradiction in his own account, it remains only a feeling. The file goes back into a drawer. In the dark glass of the office window, something is still standing very still.';
  const y = wrapP(text, 12, 44, 296);
  ctx.fillStyle = '#6b5d44';
  wrapP('Inspired by the documented case of William Dale Archerd. All characters, dialogue and scenes here are dramatized fiction, not historical record.', 12, y + 8, 296);
  btn(12, 150, 90, 12, 'Play again', newGame);
  btn(108, 150, 90, 12, 'Main menu', () => go('menu'));
}
function drawBoard(): void {
  r('#14110e', 8, 8, 304, 164);
  ctx.strokeStyle = '#8a7a5a'; ctx.strokeRect(8.5, 8.5, 303, 163);
  ctx.fillStyle = '#e6dcc2'; ctx.fillText('EVIDENCE BOARD: pick two cards to connect', 14, 20);
  btn(290, 11, 18, 11, 'X', () => { overlay = 'none'; });
  found.forEach((id, i) => {
    const e = EVIDENCE.find((v) => v.id === id);
    if (e) btn(14 + (i % 2) * 100, 28 + Math.floor(i / 2) * 19, 96, 16, e.name, () => pick(id), sel.includes(id));
  });
  ctx.fillStyle = '#b9ad8c'; ctx.fillText('DEDUCTIONS', 220, 34);
  DEDUCTIONS.forEach((d, i) => {
    const k = ded.includes(d.id);
    ctx.fillStyle = k ? '#d8c58a' : '#5a5242';
    ctx.fillText((k ? '[x] ' + d.label : '[ ] ???'), 220, 48 + i * 12, 88);
  });
  ctx.fillStyle = '#e6dcc2';
  wrapP(detail || 'Collect evidence at the scene, then connect related items here.', 14, 100, 292);
}
function drawCredits(): void {
  r('#14110e', 8, 8, 304, 164);
  ctx.strokeStyle = '#8a7a5a'; ctx.strokeRect(8.5, 8.5, 303, 163);
  btn(290, 11, 18, 11, 'X', () => { overlay = 'none'; });
  ctx.fillStyle = '#e6dcc2';
  wrapP('THE LAST VISITOR (vertical slice)\nOriginal code and procedural pixel art. No external assets.\n\nInspired by the documented case of William Dale Archerd. All characters, dialogue and scenes are dramatized fiction, not historical record. No real-world methods are depicted.', 14, 28, 292);
}
function drawMsg(): void {
  const ls = lines(msg ?? '', 264);
  const h = ls.length * 9 + 22;
  const y0 = Math.max(6, Math.floor((H - h) / 2));
  const idx = acts.length;
  acts.push({ x: 0, y: 0, w: W, h: H, fn: () => { msg = null; } });
  r('rgba(0,0,0,0.55)', 0, 0, W, H);
  r('#14110e', 20, y0, 280, h);
  ctx.strokeStyle = idx === focus ? '#d8c58a' : '#8a7a5a'; ctx.strokeRect(20.5, y0 + 0.5, 279, h - 1);
  ctx.fillStyle = '#e6dcc2';
  ls.forEach((l, i) => ctx.fillText(l, 28, y0 + 12 + i * 9));
  ctx.fillStyle = '#6b5d44'; ctx.fillText('[click / E to continue]', 28, y0 + h - 4);
}

// ---------- main loop ----------
function draw(): void {
  acts = []; tip = '';
  ctx.clearRect(0, 0, W, H);
  ctx.font = '9px monospace'; ctx.textBaseline = 'alphabetic';
  live = overlay === 'none' && msg === null;
  switch (scene) {
    case 'menu': drawMenu(); break;
    case 'bedroom': drawBedroom(); break;
    case 'office': drawOffice(); break;
    case 'talk': drawTalk(); break;
    case 'end': drawEnd(); break;
  }
  const vg = ctx.createRadialGradient(160, 90, 60, 160, 90, 210);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (overlay !== 'none') {
    live = msg === null;
    if (overlay === 'board') drawBoard(); else drawCredits();
  }
  if (msg !== null) { live = true; drawMsg(); }
  if (tip && msg === null) { ctx.fillStyle = '#e6dcc2'; ctx.fillText(tip, 6, H - 5); }
}
let last = 0;
function frame(ts: number): void {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts; t += dt;
  if (!reduced) {
    for (const p of rain) { p.y += p.v * dt; if (p.y > H) { p.y = -4; p.x = Math.random() * W; } }
  }
  draw();
  requestAnimationFrame(frame);
}

function toLogical(e: PointerEvent): void {
  const b = cv.getBoundingClientRect();
  mx = (e.clientX - b.left) * W / b.width;
  my = (e.clientY - b.top) * H / b.height;
}

export function start(): void {
  cv.width = W; cv.height = H;
  ctx.imageSmoothingEnabled = false;
  hasSave = readSave() !== null;
  cv.addEventListener('pointermove', (e) => { toLogical(e); focus = -1; });
  cv.addEventListener('pointerleave', () => { mx = -1; my = -1; });
  cv.addEventListener('pointerdown', (e) => {
    toLogical(e); e.preventDefault();
    for (let i = acts.length - 1; i >= 0; i--) {
      const a = acts[i];
      if (inside(a.x, a.y, a.w, a.h)) { a.fn(); break; }
    }
  });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (msg !== null) msg = null; else overlay = 'none'; return; }
    if (k === 'm') { toggleSound(); return; }
    if ((k === 'b' || k === 'i') && (scene === 'bedroom' || scene === 'office') && msg === null) {
      overlay = overlay === 'board' ? 'none' : 'board'; focus = -1; return;
    }
    if (!acts.length) return;
    if (k === 'arrowright' || k === 'arrowdown' || k === 'tab') { e.preventDefault(); focus = (focus + 1) % acts.length; }
    else if (k === 'arrowleft' || k === 'arrowup') { e.preventDefault(); focus = (focus - 1 + acts.length) % acts.length; }
    else if (k === 'e' || k === 'enter' || k === ' ') {
      const a = acts[focus];
      if (a) { e.preventDefault(); a.fn(); }
    }
  });
  requestAnimationFrame(frame);
}
