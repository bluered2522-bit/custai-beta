export type ProviderStatus = 'connected' | 'available' | 'coming-soon'

export type Model = {
  id: string
  name: string
  description: string
  context: string
  badge?: string
  status?: 'fast' | 'balanced' | 'reasoning'
}

export type Provider = {
  id: string
  name: string
  shortName: string
  status: ProviderStatus
  models: Model[]
  color: string
}

export const providers: Provider[] = [
  {
    id: 'anthropic', name: 'Anthropic', shortName: 'A', status: 'connected', color: 'bg-orange-500',
    models: [
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', description: 'Best for most tasks', context: '200K', badge: 'Recommended', status: 'balanced' },
      { id: 'claude-opus-4', name: 'Claude Opus 4', description: 'Deep reasoning & analysis', context: '200K', status: 'reasoning' },
      { id: 'claude-haiku-3.5', name: 'Claude 3.5 Haiku', description: 'Fast and efficient', context: '200K', status: 'fast' },
    ],
  },
  {
    id: 'openai', name: 'OpenAI', shortName: 'O', status: 'available', color: 'bg-emerald-500',
    models: [
      { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Strong all-around model', context: '1M', status: 'balanced' },
      { id: 'o3', name: 'o3', description: 'Advanced reasoning', context: '200K', status: 'reasoning' },
    ],
  },
  {
    id: 'google', name: 'Google', shortName: 'G', status: 'available', color: 'bg-blue-500',
    models: [
      { id: 'gemini-3.5-flash-lite', name: '3.5 Flash-Lite', description: 'Jawaban tercepat', context: '1M', status: 'fast' },
      { id: 'gemini-3.6-flash', name: '3.6 Flash', description: 'Bantuan serbaguna', context: '1M', status: 'balanced' },
      { id: 'gemini-3.1-pro-preview', name: '3.1 Pro', description: 'Penalaran yang canggih', context: '1M', status: 'reasoning' },
      { id: 'gemini-3.1-pro-preview-customtools', name: 'Penalaran yang diperluas', description: 'Pemecahan masalah kompleks', context: '1M', status: 'reasoning' },
    ],
  },
]

export const defaultModel = providers[0].models[0]
export const defaultProvider = providers[0]

export function getModel(modelId: string) {
  for (const provider of providers) {
    const model = provider.models.find((item) => item.id === modelId)
    if (model) return { model, provider }
  }
  return { model: defaultModel, provider: defaultProvider }
}
