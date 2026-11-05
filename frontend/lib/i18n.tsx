import React, { createContext, useContext, useState } from 'react'

const LangContext = createContext({ lang: 'hi', setLang: (l:string)=>{} })

export function LanguageProvider({children}:{children:React.ReactNode}){
  const [lang,setLang] = useState('hi')
  return <LangContext.Provider value={{lang,setLang}}>{children}</LangContext.Provider>
}

export function useLang(){ return useContext(LangContext) }
