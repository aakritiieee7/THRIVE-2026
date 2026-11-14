/**
 * Lesson content for the Training centre.
 *
 * Each lesson used to render as a single title line plus one generic
 * reflection box, so "starting a course" taught nothing. Every lesson here
 * carries the three things a teacher can actually use:
 *
 *   explain  — a short, concrete explanation of the idea
 *   activity — one thing to do in the next class
 *   reflect  — one question worth thinking about afterwards
 *
 * These are THRIVE's own practice notes, not a reproduction of any
 * government module. Where a course maps to an official programme the card
 * says so and links out (DIKSHA / NCERT) rather than claiming equivalence.
 */

export type Lesson = { title: string; explain: string; activity: string; reflect: string }

export const LESSONS: Record<string, Lesson[]> = {
  c1: [
    {
      title: 'Start with a shared anchor',
      explain:
        'When several grades share one room, the period works best if it opens as ONE class. A shared question, a story or a demonstration settles everyone at once and gives every child a way in. Keep this to five minutes — its job is to focus attention, not to teach the whole topic.',
      activity:
        'Pick next period’s opening moment. Write the question on the board and decide what you will hold up or show. Do not split the grades for these five minutes.',
      reflect: 'Did the shared opening get the quietest children speaking, or only the confident ones?',
    },
    {
      title: 'Give each group a clear independent task',
      explain:
        'While you teach one grade, the others need work they can start and finish without you. The task must be visible (written on the board), bounded (clear when it ends) and doable (no new input needed). If a child has to ask you what to do, the task was not written clearly enough.',
      activity:
        'Write the independent task for two grades in one sentence each. Put them on the board before the period starts and read them aloud once.',
      reflect: 'Which child came to ask you a question? What would have made the instruction clearer?',
    },
    {
      title: 'Use short teacher check-ins',
      explain:
        'Ten uninterrupted minutes with one grade is more than most classrooms allow. Plan two short check-ins instead — move to each group, read one answer over a shoulder, nod, and move on. This catches confusion before it becomes ten wrong answers.',
      activity:
        'During your next teacher-led turn, stand up twice and walk past the other groups. Note one thing you saw in each.',
      reflect: 'What did the walk-past tell you that you would have missed from the front?',
    },
    {
      title: 'Close with a quick learning check',
      explain:
        'Leave three minutes at the end for one question per grade about TODAY’s goal. One question, answered in a phrase or a gesture, tells you whether to revisit tomorrow. A closing check is not a test — it is information for you.',
      activity: 'Write one closing question per grade on a slip of paper now. Keep them for tomorrow’s period.',
      reflect: 'Could you tell from the answer which children needed another example?',
    },
  ],
  c2: [
    {
      title: 'Model fluent reading',
      explain:
        'Children learn what reading sounds like by hearing it. Read a short familiar passage aloud at a natural pace, with expression, while children follow with a finger. Model it once without comment, then once naming what you did as a reader.',
      activity: 'Choose four sentences. Read them aloud twice — the second time, say what you were doing (“here I slowed down because…”).',
      reflect: 'Did children copy your phrasing when they read the same passage later?',
    },
    {
      title: 'Use paired reading',
      explain:
        'Pair a stronger reader with an earlier reader, give each a job, and let them read the same text. The stronger reader reads first while the other follows; then they swap. Both get practice, and neither is left waiting.',
      activity: 'Make three pairs. Give the first reader the text and the second a card: “Mark a word your partner skipped.”',
      reflect: 'Did the second reader stay engaged, or did they drift once they were following?',
    },
    {
      title: 'Ask one literal and one inferential question',
      explain:
        'A literal question has its answer in the text (“What did the boy carry?”). An inferential one does not — the reader must connect it (“Why was he in a hurry?”). Ask the literal one first to check the text was read; then ask the inferential to check it was understood.',
      activity: 'For tomorrow’s text, write one of each. Do not plan more than two questions for the whole class.',
      reflect: 'Which question produced silence? Silence usually means the step was too large.',
    },
    {
      title: 'Note who needs another practice round',
      explain:
        'Fluency builds by rereading, not by moving on quickly. Keep a simple list: children who read the passage smoothly, those who need one more round, and those who need a shorter text. That list is your next day’s grouping.',
      activity: 'Make three short columns on a page and note two children under each. Repeat with the same children next week.',
      reflect: 'Did the children in the “shorter text” column get the support they needed, or the same text again?',
    },
  ],
  c3: [
    {
      title: 'Choose one concept',
      explain:
        'Materials only help if they point at ONE idea. Choose the idea first (place value, fraction, shape), then pick the material that makes that idea visible. Using many materials at once scatters attention and the concept gets lost among the objects.',
      activity: 'Name the single concept for your next mathematics period and write it on the board in one sentence.',
      reflect: 'Could a child in your class say what today’s idea was, in their own words?',
    },
    {
      title: 'Select safe local materials',
      explain:
        'Sticks, seeds, stones, bottle caps, paper and string are enough for most early mathematics. Check for sharp edges and choking sizes, and count out what you need before the period. A material the child can pick up and move changes what is possible.',
      activity: 'Collect one container of the same object (all caps, all sticks). Same object matters — differences distract.',
      reflect: 'Did children use the objects to think, or to play? What kept them on the idea?',
    },
    {
      title: 'Let learners explain their strategy',
      explain:
        'The moment a child explains HOW they got an answer, the thinking becomes visible to you and to the class. Ask “how did you do it?” before “is it right?”. Two different methods on the board are worth more than ten identical correct answers.',
      activity: 'For one question, ask two children with different methods to show both on the board.',
      reflect: 'Did naming the methods change how other children solved the next question?',
    },
    {
      title: 'Check understanding individually',
      explain:
        'Group answers hide individual gaps. After the shared work, ask four or five children one question each, one-to-one, about the same idea. A short individual check tells you who needs the material again.',
      activity: 'Stand by the door at the end of the period and ask one child the same question. Repeat with three children.',
      reflect: 'Did the children who spoke least in class know the idea when asked alone?',
    },
  ],
  c4: [
    {
      title: 'Make instructions short and visible',
      explain:
        'A long spoken instruction is lost halfway through for many children. Give one direction at a time, and write or draw it where everyone can see. Visibility also lets a child re-read it without asking you again.',
      activity: 'Write tomorrow’s first instruction on the board in under eight words and keep it there for the whole period.',
      reflect: 'How many children asked what to do after you had written it?',
    },
    {
      title: 'Allow think time',
      explain:
        'The quickest hand is often the most confident, not the most thoughtful. Ask a question, wait five full seconds in silence, then take answers. Wait-time noticeably widens who speaks.',
      activity: 'Count five silently after your next three questions. Take no hands before you reach five.',
      reflect: 'Did anyone new raise a hand once you waited?',
    },
    {
      title: 'Use pairs before whole class',
      explain:
        'Speaking to one partner is low-risk; speaking in front of thirty children is not. Let children rehearse an answer in a pair first, then invite one or two to say it to the class. You will hear better answers and from more children.',
      activity: 'Before the next whole-class question, say: “Tell your partner your answer. Ten seconds.” Then take responses.',
      reflect: 'Did the pair talk help a child who usually stays quiet?',
    },
    {
      title: 'Offer oral, written or drawn responses',
      explain:
        'If the only acceptable answer is written, reading and writing speed becomes the barrier rather than understanding. Accepting an answer said aloud or drawn lets more children show what they know, and tells you more about the idea.',
      activity: 'Allow one activity this week to be answered by drawing or speaking instead of writing.',
      reflect: 'Did any child show more understanding than their written work suggested?',
    },
  ],
}
