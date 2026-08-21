'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    let promptEvent: BeforeInstallPromptEvent | undefined
    const capture = (event: Event) => { event.preventDefault(); promptEvent = event as BeforeInstallPromptEvent }
    const install = async () => { if (!promptEvent) return; await promptEvent.prompt(); promptEvent = undefined }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('custai:install', install)
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('custai:install', install) }
  }, [])
  return null
}

declare global { interface WindowEventMap { 'custai:install': Event } interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> } }
