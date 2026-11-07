import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

const FAVICON = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="14" fill="#2E5940"/>
    <path d="M32 38 C 24 31.5, 15 31, 8 33.5 L8 52.5 C 15 50, 24 50.5, 32 57 C 39 50.5, 48 50, 55 52.5 L55 33.5 C 48 31, 39 31.5, 32 38 Z" fill="#FAF7F1"/>
    <path d="M32 36 C 30 28, 25.5 21.5, 18.5 18.5 C 18.8 27.5, 23.5 33.5, 32 36 Z" fill="#7FA08B"/>
    <path d="M32 36 C 34.5 27, 39.5 20.5, 46.5 18 C 46 27.5, 41.5 33.5, 32 36 Z" fill="#C89021"/>
    <circle cx="32" cy="36" r="2.4" fill="#FAF7F1"/>
  </svg>`
)}`

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <link rel="icon" href={FAVICON} />
        <link rel="apple-touch-icon" href={FAVICON} />
        <meta name="theme-color" content="#2E5940" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
