/**
 * THRIVE icon set — inline SVG (no new dependencies).
 * Consistent 24×24 outline grid, `stroke="currentColor"`, 1.7 weight.
 */
import React from 'react'

type P = React.SVGProps<SVGSVGElement> & { size?: number }

function svg(children: React.ReactNode, { size = 20, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}>{children}</svg>
  )
}

export const IconHome = (p: P) => svg(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5" /><path d="M9.5 21v-6h5v6" /></>, p)
export const IconStudio = (p: P) => svg(<><rect x="3.5" y="4.5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v3M16 3v3" /><path d="M8.5 14l2.2 2.2L15.5 12" /></>, p)
export const IconSparkle = (p: P) => svg(<><path d="M12 3.5l1.7 4.6L18.5 10l-4.8 1.9L12 16.5l-1.7-4.6L5.5 10l4.8-1.9L12 3.5Z" /><path d="M18.5 16.5l.9 2.3 2.1.9-2.1.9-.9 2.3-.9-2.3-2.1-.9 2.1-.9.9-2.3Z" /></>, p)
export const IconChat = (p: P) => svg(<><path d="M21 12a8.5 8.5 0 0 1-8.5 8.5H4l2.2-3.1A8.5 8.5 0 1 1 21 12Z" /><path d="M8.5 11.5h7M8.5 14.5h4.5" /></>, p)
export const IconBook = (p: P) => svg(<><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5Z" /></>, p)
export const IconUsers = (p: P) => svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.3a3.2 3.2 0 0 1 0 5.4M17.5 14.6A5.5 5.5 0 0 1 20.5 20" /></>, p)
export const IconFolder = (p: P) => svg(<><path d="M3.5 7a2 2 0 0 1 2-2h3.6l2 2.5h7.4a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7Z" /></>, p)
export const IconBell = (p: P) => svg(<><path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>, p)
export const IconMic = (p: P) => svg(<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" /></>, p)
export const IconSend = (p: P) => svg(<><path d="M4 12 20.5 4l-4 16.5-4.5-6.5L4 12Z" /><path d="m12 14 8.5-10" /></>, p)
export const IconPlus = (p: P) => svg(<><path d="M12 5v14M5 12h14" /></>, p)
export const IconX = (p: P) => svg(<><path d="M6 6l12 12M18 6 6 18" /></>, p)
export const IconCheck = (p: P) => svg(<><path d="m4.5 12.5 5 5L19.5 7" /></>, p)
export const IconAlert = (p: P) => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" /></>, p)
export const IconArrow = (p: P) => svg(<><path d="M5 12h13M13 6.5 18.5 12 13 17.5" /></>, p)
export const IconClock = (p: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>, p)
export const IconLayers = (p: P) => svg(<><path d="m12 3.5 8.5 4.5L12 12.5 3.5 8l8.5-4.5Z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5l8.5 4.5 8.5-4.5" /></>, p)
export const IconPrint = (p: P) => svg(<><path d="M7 8.5V4h10v4.5" /><rect x="4" y="8.5" width="16" height="8" rx="2" /><path d="M7 14h10v6H7v-6Z" /></>, p)
export const IconDownload = (p: P) => svg(<><path d="M12 4v10.5M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>, p)
export const IconCopy = (p: P) => svg(<><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9" /></>, p)
export const IconSave = (p: P) => svg(<><path d="M5 4.5h11l3.5 3.5V19a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5Z" /><path d="M8.5 4.5v5h7v-5M8 19.5v-5.5h8v5.5" /></>, p)
export const IconRefresh = (p: P) => svg(<><path d="M4.5 12a7.5 7.5 0 0 1 12.9-5.2L20 9.5" /><path d="M20 4.5v5h-5" /><path d="M19.5 12a7.5 7.5 0 0 1-12.9 5.2L4 14.5" /><path d="M4 19.5v-5h5" /></>, p)
export const IconEdit = (p: P) => svg(<><path d="M14.5 5.5 18.5 9.5M4.5 19.5l1-4.5L16 4.5a1.8 1.8 0 0 1 2.5 0l1 1a1.8 1.8 0 0 1 0 2.5L9 18.5l-4.5 1Z" /></>, p)
export const IconTrash = (p: P) => svg(<><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" /><path d="M10.5 11v6M13.5 11v6" /></>, p)
export const IconSearch = (p: P) => svg(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>, p)
export const IconHeart = (p: P) => svg(<><path d="M12 19.5S4.5 15 4.5 9.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8c0 5.2-7.5 9.7-7.5 9.7Z" /></>, p)
export const IconHeartFill = (p: P) => svg(<path fill="currentColor" stroke="none" d="M12 19.5S4.5 15 4.5 9.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8c0 5.2-7.5 9.7-7.5 9.7Z" />, p)
export const IconBookmark = (p: P) => svg(<path d="M6.5 4.5h11v16L12 16.5l-5.5 4v-16Z" />, p)
export const IconBookmarkFill = (p: P) => svg(<path fill="currentColor" stroke="none" d="M6.5 4.5h11v16L12 16.5l-5.5 4v-16Z" />, p)
export const IconFlag = (p: P) => svg(<><path d="M6 21V4.5M6 5c4-2 8 2 12 0v9c-4 2-8-2-12 0" /></>, p)
export const IconReply = (p: P) => svg(<><path d="M9 7 4.5 11.5 9 16" /><path d="M4.5 11.5H14a5.5 5.5 0 0 1 5.5 5.5v1.5" /></>, p)
export const IconExternal = (p: P) => svg(<><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5 11 13" /><path d="M19.5 14v4.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1H10" /></>, p)
export const IconLink = (p: P) => svg(<><path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.6-2.6a4.5 4.5 0 0 0-6.4-6.4L11.3 6.3" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0L5 12.6a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3" /></>, p)
export const IconPlay = (p: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="M10 8.5v7l5.5-3.5L10 8.5Z" fill="currentColor" /></>, p)
export const IconUser = (p: P) => svg(<><circle cx="12" cy="8.5" r="3.7" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>, p)
export const IconSettings = (p: P) => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.8l1.9 1.1M17.2 15.1l1.9 1.1M4.9 16.2l1.9-1.1M17.2 8.9l1.9-1.1" /></>, p)
export const IconList = (p: P) => svg(<><path d="M8.5 6.5h11M8.5 12h11M8.5 17.5h11" /><circle cx="4.7" cy="6.5" r="1" fill="currentColor" stroke="none" /><circle cx="4.7" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="4.7" cy="17.5" r="1" fill="currentColor" stroke="none" /></>, p)
export const IconGrid = (p: P) => svg(<><rect x="4" y="4" width="7" height="7" rx="1.6" /><rect x="13" y="4" width="7" height="7" rx="1.6" /><rect x="4" y="13" width="7" height="7" rx="1.6" /><rect x="13" y="13" width="7" height="7" rx="1.6" /></>, p)
export const IconCompass = (p: P) => svg(<><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></>, p)
export const IconLeaf = (p: P) => svg(<><path d="M5 19c0-8 5-13 14-14 1 9-4 14-12 14H5Z" /><path d="M5 19c3-5 6.5-8 11-10" /></>, p)
export const IconWand = (p: P) => svg(<><path d="m4.5 19.5 10-10" /><path d="M16.5 3.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7.7-1.9Z" /><path d="M6.5 4.5l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4L4.6 6.4l1.4-.5.5-1.4Z" /></>, p)
export const IconInbox = (p: P) => svg(<><path d="M4 13.5 6.5 5h11L20 13.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-5.5Z" /><path d="M4 13.5h4l1.5 2.5h5l1.5-2.5h4" /></>, p)
export const IconClipboard = (p: P) => svg(<><rect x="5.5" y="5" width="13" height="15.5" rx="2" /><path d="M9.5 5V3.8a.8.8 0 0 1 .8-.8h3.4a.8.8 0 0 1 .8.8V5" /><path d="M9 11h6M9 14.5h4.5" /></>, p)
export const IconGrade = (p: P) => svg(<><path d="M12 3.8 14.4 9l5.6.5-4.2 3.8 1.3 5.5L12 15.9l-5.1 2.9 1.3-5.5L4 9.5 9.6 9 12 3.8Z" /></>, p)
