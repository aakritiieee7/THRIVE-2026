/**
 * DEMO DATA — for presentations only.
 *
 * Everything here is invented for a demo run: the teacher, the two lesson
 * plans, the community posts and the training progress. Nothing in this file
 * is a real teacher's work, and nothing here is written to the backend — it is
 * applied to this browser's local storage so a fresh visitor does not land on
 * empty screens mid-presentation.
 *
 * Rules for keeping this honest:
 *   • every object carries `demo: true`;
 *   • the UI shows a "Demo data" chip wherever these appear;
 *   • `clearDemo()` removes it all, and the normal empty states come back;
 *   • the update links point at real NCERT/DIKSHA/NEP pages — those are
 *     genuine public resources, not invented ones.
 *
 * Load it from the UI ("Load demo teacher") or by visiting any page with
 * ?demo=1.
 */

export const DEMO_TEACHER = {
  name: 'Sunita Verma',
  state: 'Uttar Pradesh',
  board: 'NCERT',
  medium: 'Hindi + English',
  grades: '2,3,4',
  subjects: 'Mathematics, Environmental Studies',
  minutes: 40,
  language: 'English',
  school: 'Primary School, Barabanki',
}

/** One multi-grade maths plan and one EVS plan — the two a demo shows first. */
export const DEMO_PLANS = [
  {
    id: 'demo-plan-1',
    title: 'Place value across Grades 2, 3 and 4 — 40 minutes',
    subject: 'Mathematics',
    medium: 'Hindi + English',
    board: 'NCERT',
    minutes: 40,
    grades: [
      { grade: '2', topic: 'Tens and ones', objective: 'Group objects into tens and count on', shared: 'Bundles of sticks and a whole-class count' },
      { grade: '3', topic: 'Three-digit numbers', objective: 'Read and write numbers to 999 in expanded form', shared: 'Bundles of sticks and a whole-class count' },
      { grade: '4', topic: 'Place value to 9999', objective: 'State the value of each digit in a four-digit number', shared: 'Bundles of sticks and a whole-class count' },
    ],
    schedule: [
      { start: 0, minutes: 5, label: 'Whole-class opening', detail: 'Bundles of sticks: "How many?" — all grades count together.' },
      { start: 5, minutes: 10, label: 'Teacher-led · Grade 2', detail: 'Make bundles of ten; write tens and ones. Grades 3–4 do the board task.' },
      { start: 15, minutes: 10, label: 'Teacher-led · Grade 3', detail: 'Build 3-digit numbers; write expanded form (200 + 40 + 7).' },
      { start: 25, minutes: 10, label: 'Teacher-led · Grade 4', detail: 'Four-digit numbers; name the value of each digit.' },
      { start: 35, minutes: 5, label: 'Closing check', detail: 'Each grade writes one number and explains one digit.' },
    ],
    assessments: [
      { grade: '2', check: 'Show 24 with bundles; say how many tens.' },
      { grade: '3', check: 'Write 347 in expanded form.' },
      { grade: '4', check: 'In 4,082, what is the 8 worth?' },
    ],
    materials: 'Sticks or straws, string, chalkboard',
    demo: true,
  },
  {
    id: 'demo-plan-2',
    title: 'Water and evaporation — Grade 3 and 4',
    subject: 'Environmental Studies',
    medium: 'Hindi + English',
    board: 'NCERT',
    minutes: 40,
    grades: [
      { grade: '3', topic: 'Water changes form', objective: 'Observe and describe water drying up', shared: 'Wet slate demonstration' },
      { grade: '4', topic: 'Evaporation', objective: 'Explain evaporation using everyday examples', shared: 'Wet slate demonstration' },
    ],
    schedule: [
      { start: 0, minutes: 6, label: 'Whole-class opening', detail: 'Wipe the slate with a wet cloth. Watch it dry. Ask where the water went.' },
      { start: 6, minutes: 12, label: 'Teacher-led · Grade 3', detail: 'Sprinkle water in three spots; which dries first and why? Grades 4 record predictions.' },
      { start: 18, minutes: 12, label: 'Teacher-led · Grade 4', detail: 'Define evaporation; list three examples from home and fields.' },
      { start: 30, minutes: 10, label: 'Closing check', detail: 'Each child draws one example of water drying and labels it.' },
    ],
    assessments: [
      { grade: '3', check: 'Point to where the water went on the slate.' },
      { grade: '4', check: 'Name two places water evaporates at home.' },
    ],
    materials: 'Slate, cloth, water, chalk',
    demo: true,
  },
]

/**
 * Verified updates. The four sources are real, stable public pages; the
 * one-line summaries are ours. Shown with a Demo chip like the rest.
 */
export const DEMO_UPDATES = [
  { id: 'demo-u1', category: 'Policy', title: 'NEP 2020 — foundational literacy and numeracy', org: 'Ministry of Education, Government of India', date: '29 July 2020', summary: 'Sets the national direction for foundational learning, teacher development and competency-based teaching.', url: 'https://www.education.gov.in/nep/about-nep', demo: true },
  { id: 'demo-u2', category: 'Training', title: 'NISHTHA — teacher training modules', org: 'NCERT', date: 'Ongoing', summary: 'Self-paced modules on pedagogy, foundational literacy and inclusive practice. Availability varies by state.', url: 'https://nishtha.ncert.gov.in/', demo: true },
  { id: 'demo-u3', category: 'Resources', title: 'DIKSHA — state and national content', org: 'Ministry of Education · DIKSHA', date: 'Resource library', summary: 'Textbooks, audio and video lessons aligned to state curricula. Confirm the edition before classroom use.', url: 'https://diksha.gov.in/', demo: true },
  { id: 'demo-u4', category: 'Resources', title: 'NCERT ePathshala textbooks', org: 'NCERT', date: 'Resource library', summary: 'Official NCERT textbooks and supplementary material for Grades 1–12.', url: 'https://epathshala.nic.in/', demo: true },
  { id: 'demo-u5', category: 'Curriculum', title: 'NCERT Class 3 Mathematics', org: 'NCERT', date: 'Current edition', summary: 'Chapter list for Class 3 mathematics — numbers, shapes, measurement and patterns.', url: 'https://ncert.nic.in/textbook.php?cemm1=0-14', demo: true },
  { id: 'demo-u6', category: 'Curriculum', title: 'NCERT Class 4 Environmental Studies', org: 'NCERT', date: 'Current edition', summary: 'Looking Around — family, water, plants and the local environment.', url: 'https://ncert.nic.in/textbook.php?ceev1=0-27', demo: true },
  { id: 'demo-u7', category: 'Assessment', title: 'NIPUN Bharat — FLN guidelines', org: 'Ministry of Education', date: '2021 onwards', summary: 'Foundational literacy and numeracy targets with grade-wise learning outcomes.', url: 'https://diksha.gov.in/', demo: true },
  { id: 'demo-u8', category: 'Training', title: 'NCF 2023 — school curriculum framework', org: 'NCERT', date: '2023', summary: 'Framework for curriculum and pedagogy across school stages.', url: 'https://ncert.nic.in/', demo: true },
  { id: 'demo-u9', category: 'Policy', title: 'RTE Act — right to education', org: 'Ministry of Education', date: '2009', summary: 'Legal basis for free and compulsory education and for multigrade primary schools.', url: 'https://www.education.gov.in/rte', demo: true },
]

/** Teacher community posts. Invented authors and content, demo-marked. */
export const DEMO_POSTS = [
  { id: 910000000001, name: 'Meena Yadav', location: 'Barabanki, Uttar Pradesh', topic: 'Multi-grade', title: 'Running three grades with one board', body: 'I split my board into three columns — one per grade — and write the independent task for each. The first ten minutes are shared. It has cut my running around a lot.', date: '2 days ago', replies: [{ name: 'Rakesh Kumar', body: 'Trying this tomorrow. Do you write the task in Hindi or English?' }], reports: 0, helpful: 14, demo: true },
  { id: 910000000002, name: 'Rakesh Kumar', location: 'Sitapur, Uttar Pradesh', topic: 'Mathematics', title: 'Sticks for place value — what worked', body: 'Bundles of ten made from old straws. Grade 2 counted, Grade 3 wrote expanded form, Grade 4 explained digit value. Same material, three levels.', date: '3 days ago', replies: [], reports: 0, helpful: 21, demo: true },
  { id: 910000000003, name: 'Farida Begum', location: 'Lucknow, Uttar Pradesh', topic: 'Language', title: 'Paired reading when the class is noisy', body: 'Pairing a stronger reader with an early reader and giving each a job kept both busy. Three readings of one paragraph, different job each time.', date: '4 days ago', replies: [{ name: 'Sunita Verma', body: 'The job cards idea is smart — do you reuse them?' }], reports: 0, helpful: 9, demo: true },
  { id: 910000000004, name: 'Deepak Singh', location: 'Kanpur, Uttar Pradesh', topic: 'EVS', title: 'Evaporation with just a slate', body: 'Wet cloth on the slate, watch it dry. Grade 3 describes, Grade 4 explains. No equipment needed and every child can see it.', date: '5 days ago', replies: [], reports: 0, helpful: 17, demo: true },
  { id: 910000000005, name: 'Anita Sharma', location: 'Varanasi, Uttar Pradesh', topic: 'Assessment', title: 'Finger voting to check understanding', body: 'One question, three answers on the board, children show 1/2/3 fingers. I ask one child per option to explain why. I hear the mistake, not just a score.', date: '6 days ago', replies: [], reports: 0, helpful: 12, demo: true },
  { id: 910000000006, name: 'Pooja Gupta', location: 'Prayagraj, Uttar Pradesh', topic: 'Classroom', title: 'What to do when a group finishes early', body: 'A written "when you finish" list on the board stopped the early finishers from disturbing the group I am teaching.', date: '1 week ago', replies: [{ name: 'Meena Yadav', body: 'I added a challenge question at the bottom of mine.' }], reports: 0, helpful: 25, demo: true },
  { id: 910000000007, name: 'Sunita Verma', location: 'Barabanki, Uttar Pradesh', topic: 'Multi-grade', title: 'Hindi and English in the same lesson', body: 'I say the key idea in Hindi, write it in English, and let children answer in either. Participation went up noticeably.', date: '1 week ago', replies: [], reports: 0, helpful: 19, demo: true },
]

/**
 * Training progress. Course ids match lib/storage.ts `trainingCourses`, and
 * the counts are below each course's lesson count, so the Home counter and the
 * Training page show the SAME number (they read one shared key).
 */
export const DEMO_PROGRESS: Record<string, number> = {
  c1: 3, // 4 lessons
  c2: 2, // 4 lessons
  c3: 1, // 4 lessons
}

/** Notifications behind the bell. */
export const DEMO_NOTIFICATIONS = [
  { id: 'demo-n1', title: 'NISHTHA module updated', body: 'Foundational literacy module revised — check DIKSHA for your state.', date: 'Today', read: false, demo: true },
  { id: 'demo-n2', title: 'New reply in the community', body: 'Rakesh Kumar replied to your post on place value.', date: 'Yesterday', read: false, demo: true },
  { id: 'demo-n3', title: 'Continue your training', body: 'You have 3 lessons left in "Teaching in a multi-grade classroom".', date: '2 days ago', read: true, demo: true },
]

/** Local-storage keys the demo writes. Used by clearDemo(). */
export const DEMO_KEYS = [
  'thrive:profile',
  'thrive:demo-plans',
  'thrive:community-posts',
  'thrive:training-progress',
  'thrive:notifications',
] as const

/**
 * Apply the demo to this browser. Never touches the backend — a demo teacher
 * is not a real account, and signing in later is unaffected.
 */
export function applyDemo(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem('thrive:profile', JSON.stringify({ ...DEMO_TEACHER, demo: true }))
    localStorage.setItem('thrive:demo-plans', JSON.stringify(DEMO_PLANS))
    localStorage.setItem('thrive:community-posts', JSON.stringify(DEMO_POSTS))
    localStorage.setItem('thrive:training-progress', JSON.stringify(DEMO_PROGRESS))
    localStorage.setItem('thrive:notifications', JSON.stringify(DEMO_NOTIFICATIONS))
    localStorage.setItem('thrive:demo-active', '1')
  } catch { /* storage unavailable — nothing to do */ }
}

/** Remove every demo write, restoring the normal empty states. */
export function clearDemo(): void {
  if (typeof window === 'undefined') return
  try {
    for (const k of DEMO_KEYS) localStorage.removeItem(k)
    localStorage.removeItem('thrive:demo-active')
  } catch { /* storage unavailable */ }
}

export function isDemoActive(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem('thrive:demo-active') === '1' } catch { return false }
}
