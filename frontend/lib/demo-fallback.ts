/**
 * Pre-written answers for the demo questions, used ONLY when the assistant
 * service cannot be reached (backend down, LLM and local engine both failed,
 * or the guest quota is exhausted mid-demo).
 *
 * These are NOT generated and NOT grounded in a live corpus lookup — they are
 * hand-written teaching guidance reviewed against the NCERT syllabus. The UI
 * must label them "sample" so nobody mistakes them for a live grounded reply.
 *
 * Keep the sources honest: they point at real, stable NCERT / DIKSHA pages.
 */

export type FallbackAnswer = {
  /** Matched case-insensitively; the longest keyword wins. */
  keywords: string[]
  english: string
  hindi: string
  sources: { title: string; org: string; url?: string; why?: string }[]
}

export const DEMO_FALLBACKS: FallbackAnswer[] = [
  {
    keywords: [
      'one maths idea across grades 3 and 5',
      'maths idea across grades',
      'grades 3 and 5',
      'multi-grade maths',
    ],
    english: [
      '*One maths idea across Grades 3 and 5*',
      '',
      'Use *place value* as the shared idea — it spans both syllabi.',
      '',
      '• *Shared opening (8 min):* show 3 bundles of 10 sticks and 4 loose sticks. Ask: "How many?" Grade 3 counts by tens; Grade 5 says the number in words and names each digit\'s value.',
      '• *Grade 3 turn (12 min):* build 3-digit numbers with the sticks and write the expanded form (200 + 40 + 7).',
      '• *Grade 5 turn (12 min):* write the same number in three ways — standard, expanded, and with a decimal (e.g. 247, 200 + 40 + 7, 247.0).',
      '• *Closing check (8 min):* each child writes one number above 500 and explains the value of one digit.',
      '',
      'Same materials, same opening, different depth — one teacher can run both.',
      '',
      '*This is a SAMPLE answer written in advance — the live service was unreachable. Check it against your syllabus before use.*',
    ].join('\n'),
    hindi: [
      '*एक गणित की अवधारणा — कक्षा 3 और 5*',
      '',
      'साझा विचार: *स्थानीय मान (place value)* — दोनों कक्षाओं के पाठ्यक्रम में आता है।',
      '',
      '• *साझा शुरुआत (8 मिनट):* 10-10 की 3 गड्डियाँ और 4 अलग तीलियाँ दिखाएँ। पूछें: "कितनी?" कक्षा 3 दहाई में गिने; कक्षा 5 संख्या को शब्दों में लिखे और हर अंक का मान बताए।',
      '• *कक्षा 3 (12 मिनट):* तीलियों से 3 अंकों की संख्या बनाएँ और विस्तृत रूप लिखें (200 + 40 + 7)।',
      '• *कक्षा 5 (12 मिनट):* वही संख्या तीन तरह से — सामान्य, विस्तृत और दशमलव के साथ (247, 200 + 40 + 7, 247.0)।',
      '• *समापन जाँच (8 मिनट):* हर बच्चा 500 से बड़ी एक संख्या लिखे और किसी एक अंक का मान समझाए।',
      '',
      'वही सामग्री, वही शुरुआत, अलग गहराई — एक शिक्षक दोनों संभाल सकता है।',
      '',
      '*यह एक पहले से लिखा हुआ नमूना उत्तर है — सेवा उपलब्ध नहीं थी। उपयोग से पहले पाठ्यक्रम से जाँच लें।*',
    ].join('\n'),
    sources: [
      { title: 'Class 3 Mathematics — Chapter 2: Fun with Numbers', org: 'NCERT', url: 'https://ncert.nic.in/textbook.php?cemm1=2-14', why: 'place value, numbers to 999' },
      { title: 'Class 5 Mathematics — Chapter 1: The Fish Tale', org: 'NCERT', url: 'https://ncert.nic.in/textbook.php?cemm1=1-14', why: 'large numbers and place value' },
    ],
  },
  {
    keywords: [
      'low-cost reading activity',
      'reading activity for mixed levels',
      'reading activity',
      'reading'
    ],
    english: [
      '*Low-cost reading activity for mixed levels*',
      '',
      'Use *"three readings, three jobs"* with one short paragraph written on the board — no books needed.',
      '',
      '• *Set up (3 min):* write 4 sentences on the board. Split the class into mixed pairs.',
      '• *Reading 1 (5 min):* both read silently. Job A (younger/earlier reader) underlines every word they can read.',
      '• *Reading 2 (7 min):* partner reads aloud, the other listens. Job B (stronger reader) marks where a reader paused or struggled.',
      '• *Reading 3 (5 min):* swap. Now the earlier reader retells the paragraph in one sentence.',
      '• *Close (3 min):* two pairs share their one-sentence retellings.',
      '',
      'Every child reads three times and has a visible job each time. Pairing strong with early readers means one text serves both.',
      '',
      '*This is a SAMPLE answer written in advance — the live service was unreachable. Check it against your syllabus before use.*',
    ].join('\n'),
    hindi: [
      '*कम लागत की पठन गतिविधि — मिश्रित स्तरों के लिए*',
      '',
      '"तीन बार पढ़ो, तीन काम" — बोर्ड पर लिखा एक छोटा अनुच्छेद, किताब की ज़रूरत नहीं।',
      '',
      '• *तैयारी (3 मिनट):* बोर्ड पर 4 वाक्य लिखें। बच्चों को मिश्रित जोड़ियों में बाँटें।',
      '• *पढ़ाई 1 (5 मिनट):* दोनों चुपचाप पढ़ें। काम A (कमज़ोर पाठक) हर पढ़े जाने वाले शब्द पर रेखा खींचे।',
      '• *पढ़ाई 2 (7 मिनट):* साथी ज़ोर से पढ़े, दूसरा सुने। काम B (मज़बूत पाठक) जहाँ अटकाव हो वहाँ निशान लगाए।',
      '• *पढ़ाई 3 (5 मिनट):* जगह बदलें। अब कमज़ोर पाठक एक वाक्य में अनुच्छेद सुनाए।',
      '• *समापन (3 मिनट):* दो जोड़ियाँ अपना एक-वाक्य सारांश बताएँ।',
      '',
      'हर बच्चा तीन बार पढ़ता है और हर बार उसका एक स्पष्ट काम होता है।',
      '',
      '*यह एक पहले से लिखा हुआ नमूना उत्तर है — सेवा उपलब्ध नहीं थी। उपयोग से पहले पाठ्यक्रम से जाँच लें।*',
    ].join('\n'),
    sources: [
      { title: 'NIPUN Bharat — Foundational Literacy guidelines', org: 'DIKSHA / MoE', url: 'https://diksha.gov.in/', why: 'paired reading and oral reading fluency' },
      { title: 'NISHTHA — Pedagogy of Language', org: 'NCERT', url: 'https://nishtha.ncert.gov.in/', why: 'multi-level reading strategies' },
    ],
  },
  {
    keywords: [
      'quick check for understanding',
      'quick check',
      'check for understanding',
      'assessment'
    ],
    english: [
      '*A 3-minute check for understanding*',
      '',
      'Use *"one question, three answers"* — no marking, instant read on the whole class.',
      '',
      '• *Ask (1 min):* one question with three plausible answers written on the board, labelled A, B, C (one is right, two are common misconceptions).',
      '• *Vote (30 sec):* children hold up 1, 2 or 3 fingers — no talking, so nobody copies.',
      '• *Ask why (90 sec):* pick one child who chose each option and ask them to explain. You hear the misconception out loud.',
      '• *Decide:* if most chose the right answer and can say why, move on. If not, re-teach with one concrete example before continuing.',
      '',
      'Wrong answers are the useful part — you get the reason, not just a score.',
      '',
      '*This is a SAMPLE answer written in advance — the live service was unreachable. Check it against your syllabus before use.*',
    ].join('\n'),
    hindi: [
      '*समझने की 3 मिनट की जाँच*',
      '',
      '"एक प्रश्न, तीन उत्तर" — जाँच-पड़ताल का समय नहीं, पूरी कक्षा का तुरंत पता।',
      '',
      '• *पूछें (1 मिनट):* बोर्ड पर तीन संभावित उत्तर A, B, C लिखें (एक सही, दो सामान्य भ्रांतियाँ)।',
      '• *मत (30 सेकंड):* बच्चे 1, 2 या 3 उँगली दिखाएँ — चुपचाप, ताकि कोई नकल न करे।',
      '• *कारण पूछें (90 सेकंड):* हर विकल्प चुनने वाले एक बच्चे से पूछें "क्यों?" — भ्रांति ज़ोर से सुनाई देगी।',
      '• *निर्णय:* अगर अधिकांश सही हैं और कारण बता सकते हैं, आगे बढ़ें। वरना एक ठोस उदाहरण से दोबारा पढ़ाएँ।',
      '',
      'ग़लत उत्तर ही सबसे उपयोगी हैं — आपको कारण मिलता है, केवल अंक नहीं।',
      '',
      '*यह एक पहले से लिखा हुआ नमूना उत्तर है — सेवा उपलब्ध नहीं थी। उपयोग से पहले पाठ्यक्रम से जाँच लें।*',
    ].join('\n'),
    sources: [
      { title: 'NISHTHA — Assessment for Learning', org: 'NCERT', url: 'https://nishtha.ncert.gov.in/', why: 'formative assessment techniques' },
      { title: 'NEP 2020 — Chapter 4, Assessment Reforms', org: 'Ministry of Education', url: 'https://www.education.gov.in/sites/upload_files/mhrd/files/NEP_Final_English_0.pdf', why: 'shift to formative, competency-based assessment' },
    ],
  },
]

/**
 * Find a pre-written answer whose keywords appear in the question.
 * Returns null when nothing matches — callers should then show a plain retry
 * rather than inventing an answer.
 */
export function findFallback(query: string, language = 'English'): {
  text: string
  sources: FallbackAnswer['sources']
} | null {
  const q = query.toLowerCase()
  let best: FallbackAnswer | null = null
  let bestLen = 0
  for (const f of DEMO_FALLBACKS) {
    for (const k of f.keywords) {
      if (q.includes(k) && k.length > bestLen) { best = f; bestLen = k.length }
    }
  }
  if (!best) return null
  const hindi = /^hi/i.test(language) || /[ऀ-ॿ]/.test(query)
  return { text: hindi ? best.hindi : best.english, sources: best.sources }
}
