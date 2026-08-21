export type ChatRole = 'system' | 'user' | 'assistant'

export type ChatMessage = { role: ChatRole; content: string }
export type ChatRequest = { provider: string; model: string; messages: ChatMessage[]; signal?: AbortSignal; credential?: string }
export type ChatResponse = { content: string; model: string; provider: string }
export type ModelMetadata = { id: string; name: string; provider: string; available: boolean; description?: string }
export type ProviderStatus = 'connected' | 'not-configured' | 'error'
export type ProviderMetadata = { id: string; name: string; envKey?: string; models: ModelMetadata[]; status: ProviderStatus }

export interface AIProvider {
  readonly id: string
  readonly name: string
  readonly envKey?: string
  getModels(): ModelMetadata[]
  chat(request: ChatRequest): Promise<ChatResponse>
}

export class ProviderError extends Error {
  constructor(public code: 'not-configured' | 'auth' | 'rate-limit' | 'unavailable' | 'temporary', message: string) { super(message) }
}

export function safeProviderMessage(error: unknown) {
  if (error instanceof ProviderError) {
    if (error.code === 'not-configured') return 'Please configure this provider first.'
    if (error.code === 'auth') return 'Provider authentication failed.'
    if (error.code === 'rate-limit') return 'Provider rate limit reached.'
    if (error.code === 'unavailable') return 'Model is unavailable.'
  }
  return 'Temporary provider error.'
}

export function requireCredential(envKey: string) {
  const value = process.env[envKey]
  if (!value) throw new ProviderError('not-configured', 'Missing provider credential')
  return value
}

export function classifyProviderError(status: number) {
  if (status === 401 || status === 403) return new ProviderError('auth', 'Authentication failed')
  if (status === 429) return new ProviderError('rate-limit', 'Rate limit reached')
  if (status === 404) return new ProviderError('unavailable', 'Model unavailable')
  return new ProviderError('temporary', 'Provider request failed')
}

export function extractText(data: any): string {
  return data?.choices?.[0]?.message?.content ?? data?.output_text ?? data?.content?.[0]?.text ?? data?.candidates?.[0]?.content?.parts?.map((part: any) => part.text).join('') ?? ''
}

export function models(provider: string, entries: ReadonlyArray<readonly [string, string, string?]>): ModelMetadata[] {
  return entries.map(([id, name, description]) => ({ id, name, provider, available: true, description }))
}

export function envStatus(envKey?: string): ProviderStatus {
  return envKey && process.env[envKey] ? 'connected' : 'not-configured'
}

export async function postJson(url: string, init: RequestInit, provider: string, model: string): Promise<any> {
  const response = await fetch(url, init)
  if (!response.ok) throw classifyProviderError(response.status)
  return response.json()
}

export function asOpenAIProvider(id: string, name: string, envKey: string, baseUrl: string, modelList: ModelMetadata[]): AIProvider {
  return { id, name, envKey, getModels: () => modelList, async chat(request) { const key = request.credential ?? requireCredential(envKey); const data = await postJson(`${baseUrl}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify({ model: request.model, messages: request.messages, stream: false }), signal: request.signal }, id, request.model); return { content: extractText(data), model: request.model, provider: id } } }
}

export function asAnthropicProvider(): AIProvider { return { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', getModels: () => models('anthropic', [['claude-sonnet-4-20250514', 'Claude Sonnet 4'], ['claude-3-5-haiku-latest', 'Claude 3.5 Haiku']]), async chat(request) { const key = request.credential ?? requireCredential('ANTHROPIC_API_KEY'); const data = await postJson('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: request.model, max_tokens: 4096, messages: request.messages.filter((m) => m.role !== 'system'), system: request.messages.find((m) => m.role === 'system')?.content }), signal: request.signal }, 'anthropic', request.model); return { content: extractText(data), model: request.model, provider: 'anthropic' } } } }

export function asGoogleProvider(): AIProvider { return { id: 'google', name: 'Google Gemini', envKey: 'GOOGLE_AI_API_KEY', getModels: () => models('google', [['gemini-3.5-flash-lite', '3.5 Flash-Lite', 'Jawaban tercepat'], ['gemini-3.6-flash', '3.6 Flash', 'Bantuan serbaguna'], ['gemini-3.1-pro-preview', '3.1 Pro', 'Penalaran yang canggih'], ['gemini-3.1-pro-preview-customtools', 'Penalaran yang diperluas', 'Pemecahan masalah kompleks']]), async chat(request) { const key = request.credential ?? requireCredential('GOOGLE_AI_API_KEY'); const data = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents: request.messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) }), signal: request.signal }, 'google', request.model); return { content: extractText(data), model: request.model, provider: 'google' } } } }

export const providerSpecs = [
  ['groq', 'Groq', 'GROQ_API_KEY', 'https://api.groq.com/openai/v1', [['llama-3.3-70b-versatile', 'Llama 3.3 70B']]],
  ['mistral', 'Mistral', 'MISTRAL_API_KEY', 'https://api.mistral.ai/v1', [['mistral-large-latest', 'Mistral Large']]],
  ['deepseek', 'DeepSeek', 'DEEPSEEK_API_KEY', 'https://api.deepseek.com/v1', [['deepseek-chat', 'DeepSeek Chat']]],
  ['openrouter', 'OpenRouter', 'OPENROUTER_API_KEY', 'https://openrouter.ai/api/v1', [['openai/gpt-4o-mini', 'GPT-4o Mini']]],
  ['xai', 'xAI', 'XAI_API_KEY', 'https://api.x.ai/v1', [['grok-3-mini', 'Grok 3 Mini']]],
  ['cohere', 'Cohere', 'COHERE_API_KEY', 'https://api.cohere.com/compatibility/v1', [['command-a-03-2025', 'Command A']]],
  ['together', 'Together AI', 'TOGETHER_API_KEY', 'https://api.together.xyz/v1', [['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Llama 3.3 70B']]],
  ['fireworks', 'Fireworks AI', 'FIREWORKS_API_KEY', 'https://api.fireworks.ai/inference/v1', [['accounts/fireworks/models/llama-v3p1-70b-instruct', 'Llama 3.1 70B']]],
  ['cerebras', 'Cerebras', 'CEREBRAS_API_KEY', 'https://api.cerebras.ai/v1', [['llama-3.3-70b', 'Llama 3.3 70B']]],
  ['huggingface', 'Hugging Face', 'HUGGINGFACE_API_KEY', 'https://router.huggingface.co/v1', [['meta-llama/Llama-3.1-8B-Instruct', 'Llama 3.1 8B']]],
  ['replicate', 'Replicate', 'REPLICATE_API_TOKEN', 'https://api.replicate.com/v1', [['meta/meta-llama-3-8b-instruct', 'Llama 3 8B']]],
  ['perplexity', 'Perplexity', 'PERPLEXITY_API_KEY', 'https://api.perplexity.ai', [['sonar', 'Sonar']]],
  ['ai21', 'AI21', 'AI21_API_KEY', 'https://api.ai21.com/studio/v1', [['jamba-1.5-mini', 'Jamba 1.5 Mini']]],
  ['deepinfra', 'DeepInfra', 'DEEPINFRA_API_KEY', 'https://api.deepinfra.com/v1/openai', [['meta-llama/Meta-Llama-3.1-70B-Instruct', 'Llama 3.1 70B']]],
  ['sambanova', 'SambaNova', 'SAMBANOVA_API_KEY', 'https://api.sambanova.ai/v1', [['Meta-Llama-3.3-70B-Instruct', 'Llama 3.3 70B']]],
  ['novita', 'Novita AI', 'NOVITA_API_KEY', 'https://api.novita.ai/v3/openai', [['meta-llama/llama-3.1-8b-instruct', 'Llama 3.1 8B']]],
  ['nvidia', 'NVIDIA NIM', 'NVIDIA_API_KEY', 'https://integrate.api.nvidia.com/v1', [['meta/llama-3.1-8b-instruct', 'Llama 3.1 8B']]],
  ['qwen', 'Qwen-compatible API', 'QWEN_API_KEY', 'https://dashscope.aliyuncs.com/compatible-mode/v1', [['qwen-plus', 'Qwen Plus']]],
  ['cloudflare', 'Cloudflare Workers AI', 'CLOUDFLARE_API_TOKEN', 'https://api.cloudflare.com/client/v4', [['@cf/meta/llama-3.1-8b-instruct', 'Llama 3.1 8B']]],
] as const

export const customProviders = [
  ['custom-openai', 'Custom OpenAI-compatible API', 'CUSTOM_OPENAI_API_KEY', 'CUSTOM_OPENAI_BASE_URL'],
  ['local', 'Local OpenAI-compatible API', 'LOCAL_AI_API_KEY', 'LOCAL_AI_BASE_URL'],
  ['custom', 'Custom Provider', 'CUSTOM_PROVIDER_API_KEY', 'CUSTOM_PROVIDER_BASE_URL'],
] as const

export type { ProviderStatus as LegacyProviderStatus }
export type Model = ModelMetadata & { context?: string; badge?: string; status?: 'fast' | 'balanced' | 'reasoning' }
export type Provider = ProviderMetadata & { shortName: string; color: string }
export const defaultModel: Model = { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', available: true, context: '200K', description: 'Best for most tasks', badge: 'Recommended', status: 'balanced' }
export const defaultProvider: Provider = { id: 'anthropic', name: 'Anthropic', shortName: 'A', status: 'not-configured', envKey: 'ANTHROPIC_API_KEY', models: [defaultModel], color: 'bg-orange-500' }
export const providers: Provider[] = [defaultProvider]
export function getModel(modelId: string) { const model = providers.flatMap((p) => p.models.map((m) => ({ model: m, provider: p }))).find(({ model }) => model.id === modelId); return model ?? { model: defaultModel, provider: defaultProvider } }
export function allProviderMetadata(): ProviderMetadata[] { const base = [asAnthropicProvider(), asGoogleProvider(), asOpenAIProvider('openai', 'OpenAI', 'OPENAI_API_KEY', 'https://api.openai.com/v1', models('openai', [['gpt-4o-mini', 'GPT-4o Mini'], ['gpt-4.1', 'GPT-4.1']]))]; const rest = providerSpecs.map(([id, name, env, baseUrl, list]) => asOpenAIProvider(id, name, env, baseUrl, models(id, list))); const customs = customProviders.map(([id, name, env, urlEnv]) => asOpenAIProvider(id, name, env, process.env[urlEnv] ?? 'http://localhost:11434/v1', models(id, [['custom-model', 'Custom model']]))); return [...base, ...rest, ...customs].map((p) => ({ id: p.id, name: p.name, envKey: p.envKey, models: p.getModels(), status: envStatus(p.envKey) })) }
export function getProvider(id: string): AIProvider | undefined { const all = allProviderMetadata(); if (!all.some((p) => p.id === id)) return undefined; if (id === 'anthropic') return asAnthropicProvider(); if (id === 'google') return asGoogleProvider(); if (id === 'openai') return asOpenAIProvider('openai', 'OpenAI', 'OPENAI_API_KEY', 'https://api.openai.com/v1', models('openai', [['gpt-4o-mini', 'GPT-4o Mini'], ['gpt-4.1', 'GPT-4.1']])); const spec = providerSpecs.find((item) => item[0] === id); if (spec) return asOpenAIProvider(spec[0], spec[1], spec[2], spec[3], models(spec[0], spec[4])); const custom = customProviders.find((item) => item[0] === id); return custom ? asOpenAIProvider(custom[0], custom[1], custom[2], process.env[custom[3]] ?? 'http://localhost:11434/v1', models(custom[0], [['custom-model', 'Custom model']])) : undefined }
export const configuredEnvKeys = ['OPENAI_API_KEY','ANTHROPIC_API_KEY','GOOGLE_AI_API_KEY','GROQ_API_KEY','MISTRAL_API_KEY','DEEPSEEK_API_KEY','OPENROUTER_API_KEY','XAI_API_KEY','COHERE_API_KEY','TOGETHER_API_KEY','FIREWORKS_API_KEY','CEREBRAS_API_KEY','HUGGINGFACE_API_KEY','REPLICATE_API_TOKEN','PERPLEXITY_API_KEY','AI21_API_KEY','DEEPINFRA_API_KEY','SAMBANOVA_API_KEY','NOVITA_API_KEY','NVIDIA_API_KEY','QWEN_API_KEY','CLOUDFLARE_API_TOKEN','CUSTOM_OPENAI_API_KEY','LOCAL_AI_API_KEY','CUSTOM_PROVIDER_API_KEY'] as const
export function getSafeKeyStatuses() { return configuredEnvKeys.map((key) => ({ key, configured: Boolean(process.env[key]), masked: process.env[key] ? `••••••••${process.env[key]!.slice(-4)}` : null })) }
