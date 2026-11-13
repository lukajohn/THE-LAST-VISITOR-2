export type Cat = 'Physical' | 'Medical' | 'Financial' | 'Documentary' | 'Witness' | 'Photographic';

export interface Evidence {
  id: string;
  name: string;
  cat: Cat;
  desc: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Deduction {
  id: string;
  a: string;
  b: string;
  label: string;
  text: string;
}

export const EVIDENCE: Evidence[] = [
  { id: 'photo', name: 'Framed photograph', cat: 'Photographic', x: 40, y: 70, w: 14, h: 12,
    desc: "A garden party, 1962. She laughs at the camera; a man in a pale suit stands just behind her, a hand on her shoulder. On the back: 'With Dr. A. He looks after everything.'" },
  { id: 'letter', name: 'Dated letter', cat: 'Documentary', x: 200, y: 104, w: 14, h: 6,
    desc: "Dated the week she died. 'Dr. Archer says I need not trouble anyone else. He will see to my papers and my care himself. I feel better when he is in the room, and worse when he is gone.'" },
  { id: 'policy', name: 'Insurance policy', cat: 'Financial', x: 231, y: 93, w: 18, h: 7,
    desc: "A life insurance policy. The beneficiary line was amended two weeks before her death, in a different hand: 'W. Archer'. The witness signature is illegible." },
  { id: 'chart', name: 'Medical chart', cat: 'Medical', x: 150, y: 100, w: 16, h: 6,
    desc: 'Her chart. Cause of death: natural. Time of death: 6:00 p.m. Signed by Dr. W. Archer, the attending physician, who also certified the death himself. No second examiner.' },
  { id: 'statement', name: 'Neighbour statement', cat: 'Witness', x: 98, y: 98, w: 16, h: 5,
    desc: "Mrs. Pell, next door, to police: 'The doctor came at seven that Thursday. He left at twenty past and said she was resting. I never heard her again.'" },
  { id: 'ring', name: 'Engraved ring', cat: 'Physical', x: 172, y: 126, w: 8, h: 5,
    desc: "A plain gold ring engraved 'M.A. 1958', found beside the bed. It matches no one in this household. The same initials appear in the closed file of another death, years earlier." },
];

export const DEDUCTIONS: Deduction[] = [
  { id: 'd1', a: 'letter', b: 'policy', label: 'Motive and access',
    text: 'He steered her papers, her care and her money toward himself. Her trust was his access.' },
  { id: 'd2', a: 'chart', b: 'statement', label: 'Timeline breaks',
    text: "The chart records her death an hour BEFORE the neighbour says he arrived, yet he told her she was 'resting' as he left. One of these accounts is false." },
  { id: 'd3', a: 'photo', b: 'ring', label: 'A pattern',
    text: "The photograph and the ring place the same man near another household's grief. This is not the first time." },
];
