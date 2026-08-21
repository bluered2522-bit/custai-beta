import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.custai.android',
  appName: 'CustAi',
  webDir: '.next',
  server: {
    url: process.env.CUSTAI_PRODUCTION_URL,
    cleartext: false,
  },
}

export default config
