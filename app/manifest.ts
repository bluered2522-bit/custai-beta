import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CustAi',
    short_name: 'CustAi',
    description: 'Your private AI workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icons/custai-logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/custai-logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
