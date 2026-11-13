import { useEffect, useState } from 'react'

export function useStoredState<T>(key:string, initial:T):[T,(value:T|((old:T)=>T))=>void,boolean] {
  const [value,setValue]=useState<T>(initial)
  const [ready,setReady]=useState(false)
  useEffect(()=>{try{const raw=localStorage.getItem('thrive:'+key);if(raw)setValue(JSON.parse(raw))}catch{}setReady(true)},[key])
  useEffect(()=>{if(ready)try{localStorage.setItem('thrive:'+key,JSON.stringify(value))}catch{}},[key,value,ready])
  return [value,setValue,ready]
}

/** The teaching-context shape every page reads through `useStoredState('profile', …)`.
 *
 *  It is deliberately blank: no pre-filled state, board, grades or subjects.
 *  A first-time teacher must never be shown someone else's (or a seeded
 *  example's) classroom as if it were theirs — empty fields are the honest
 *  starting point, and Guided setup / My profile fill them in for real. */
export const EMPTY_PROFILE = {
  name: '', email: '', state: '', board: '', medium: '',
  grades: '', subjects: '', school: '', language: 'English',
}

export const curriculumUpdates = [
  {id:'u1',category:'Training',title:'NISHTHA: Foundational Literacy and Numeracy',org:'Ministry of Education · DIKSHA',date:'Ongoing',summary:'Self-paced modules on foundational literacy, numeracy and classroom practice. Check DIKSHA for the current course availability in your state.',url:'https://diksha.gov.in/'} ,
  {id:'u2',category:'Policy',title:'National Education Policy 2020',org:'Ministry of Education, Government of India',date:'29 July 2020',summary:'The national policy sets direction for school education, foundational learning, teacher development and competency-based teaching.',url:'https://www.education.gov.in/nep/about-nep'},
  {id:'u3',category:'Resources',title:'NCERT ePathshala learning resources',org:'NCERT',date:'Resource library',summary:'Access textbooks and supplementary materials published by NCERT. Confirm the applicable edition and state curriculum before classroom use.',url:'https://epathshala.nic.in/'},
]

export const trainingCourses = [
 {id:'c1',title:'Teaching in a multi-grade classroom',topic:'Pedagogy',length:'35 min',level:'Foundational',color:'',desc:'Plan teacher-led time and meaningful independent work across grade groups.',lesson:['Start with a shared anchor','Give each group a clear independent task','Use short teacher check-ins','Close with a quick learning check']},
 {id:'c2',title:'Foundational literacy: daily routines',topic:'Language',length:'28 min',level:'Practice',color:'orange',desc:'Build short, repeatable routines for reading fluency and comprehension.',lesson:['Model fluent reading','Use paired reading','Ask one literal and one inferential question','Note who needs another practice round']},
 {id:'c3',title:'Low-cost materials for mathematics',topic:'Mathematics',length:'22 min',level:'Foundational',color:'blue',desc:'Use familiar classroom materials to make number and shape ideas visible.',lesson:['Choose one concept','Select safe local materials','Let learners explain their strategy','Check understanding individually']},
 {id:'c4',title:'Inclusive classroom participation',topic:'Inclusion',length:'31 min',level:'Practice',color:'',desc:'Offer more than one way for learners to participate and show what they know.',lesson:['Make instructions short and visible','Allow think time','Use pairs before whole class','Offer oral, written or drawn responses']},
]

