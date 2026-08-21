'use client'

import { useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

type Block =
  | { type: 'paragraph'; value: string }
  | { type: 'heading'; level: 1 | 2 | 3; value: string }
  | { type: 'quote'; value: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'rule' }
  | { type: 'math'; value: string; display: boolean }
  | { type: 'code'; value: string; language?: string }

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  let paragraph: string[] = []
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', value: paragraph.join('\n').trim() })
      paragraph = []
    }
  }
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*\$\$\s*$/.test(line)) {
      flush()
      const math: string[] = []
      i += 1
      while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) math.push(lines[i++])
      if (i < lines.length) i += 1
      blocks.push({ type: 'math', value: math.join('\n'), display: true })
      continue
    }
    const fence = line.match(/^\s*```\s*([\w.+-]*)\s*$/)
    if (fence) {
      flush()
      const code: string[] = []
      i += 1
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++])
      if (i < lines.length) i += 1
      blocks.push({ type: 'code', language: fence[1] || undefined, value: code.join('\n') })
      continue
    }
    const heading = line.match(/^\s*(#{1,3})\s+(.+?)\s*#*\s*$/)
    if (heading) { flush(); blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, value: heading[2] }); i += 1; continue }
    if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})\s*$/.test(line)) { flush(); blocks.push({ type: 'rule' }); i += 1; continue }
    if (/^\s*>/.test(line)) {
      flush(); const quote: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) { quote.push(lines[i++].replace(/^\s*>\s?/, '')) }
      blocks.push({ type: 'quote', value: quote.join('\n') }); continue
    }
    const list = line.match(/^\s*([-+*])\s+(.+)$/) || line.match(/^\s*(\d+)[.)]\s+(.+)$/)
    if (list) {
      flush(); const ordered = /^\s*\d/.test(line); const items: string[] = []
      while (i < lines.length) {
        const item = ordered ? lines[i].match(/^\s*\d+[.)]\s+(.+)$/) : lines[i].match(/^\s*[-+*]\s+(.+)$/)
        if (!item) break
        items.push(item[1]); i += 1
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items }); continue
    }
    if (!line.trim()) { flush(); i += 1; continue }
    paragraph.push(line); i += 1
  }
  flush()
  return blocks
}

function copyText(value: string, done: () => void) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(done).catch(() => fallbackCopy(value, done))
  else fallbackCopy(value, done)
}

function fallbackCopy(value: string, done: () => void) {
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  try { if (document.execCommand('copy')) done() } finally { area.remove() }
}

function MathExpression({ value, display = false }: { value: string; display?: boolean }) {
  const html = katex.renderToString(value.trim(), { displayMode: display, throwOnError: false, strict: 'ignore', trust: false })
  return <span className={display ? 'my-4 block max-w-full overflow-x-auto py-2 text-center' : 'mx-0.5 inline-block max-w-full overflow-x-auto align-middle'} dangerouslySetInnerHTML={{ __html: html }} />
}

function InlineMarkdown({ value }: { value: string }) {
  const tokens = /(\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\$[^$\n]+\$|`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\((https?:\/\/[^\s)]+)\))/g
  const parts = value.split(tokens)
  return <>{parts.map((part, index) => {
    if (!part) return null
    if (/^\$\$[\s\S]+\$\$$/.test(part)) return <MathExpression key={index} value={part.slice(2, -2)} display />
    if (/^\\\([\s\S]+\\\)$/.test(part)) return <MathExpression key={index} value={part.slice(2, -2)} />
    if(/^\$[^$\n]+\$$/.test(part)) return <MathExpression key={index} value={part.slice(1, -1)} />
    if (/^`[^`\n]+`$/.test(part)) return <code key={index} className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[0.88em] text-primary">{part.slice(1, -1)}</code>
    if (/^\*\*.*\*\*$/.test(part)) return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    if (/^~~.*~~$/.test(part)) return <del key={index} className="text-muted-foreground">{part.slice(2, -2)}</del>
    if (/^\*.*\*$/.test(part) || /^_.*_$/.test(part)) return <em key={index}>{part.slice(1, -1)}</em>
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/)
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary underline underline-offset-2 hover:text-primary/80">{link[1]}<ExternalLink className="size-3" /></a>
    return <span key={index}>{part}</span>
  })}</>
}

function CodeBlock({ value, language }: { value: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const label = language || 'Code'
  return <div className="my-4 min-w-0 max-w-full overflow-hidden rounded-xl border border-border/80 bg-[#0b1014] shadow-sm">
    <div className="flex items-center justify-between border-b border-border/70 bg-secondary/40 px-3 py-2">
      <span className="font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <button type="button" aria-label={`Copy ${label} code`} onClick={() => copyText(value, () => { setCopied(true); window.setTimeout(() => setCopied(false), 1800) })} className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
    <pre className="min-w-0 max-w-full overflow-x-auto p-4 font-mono text-[12px] leading-6 text-cyan-50"><code>{value}</code></pre>
  </div>
}

function BlockView({ block }: { block: Block }) {
  if (block.type === 'math') return <MathExpression value={block.value} display />
  if (block.type === 'code') return <CodeBlock value={block.value} language={block.language} />
  if (block.type === 'rule') return <hr className="my-5 border-border" />
  if (block.type === 'heading') {
    const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3'
    return <Tag className={`${block.level === 1 ? 'text-2xl' : block.level === 2 ? 'text-xl' : 'text-lg'} mt-4 font-semibold tracking-tight text-foreground`}><InlineMarkdown value={block.value} /></Tag>
  }
  if (block.type === 'quote') return <blockquote className="my-3 border-l-2 border-primary/70 pl-4 text-muted-foreground"><InlineMarkdown value={block.value} /></blockquote>
  if (block.type === 'ul' || block.type === 'ol') {
    const Tag = block.type
    return <Tag className={`${block.type === 'ul' ? 'list-disc' : 'list-decimal'} my-3 flex flex-col gap-1 pl-6 text-sm leading-7 text-foreground/90`}>{block.items.map((item, index) => <li key={index}><InlineMarkdown value={item} /></li>)}</Tag>
  }
  if (block.type === 'paragraph') return <p className="my-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90"><InlineMarkdown value={block.value} /></p>
  return null
}

export function MarkdownRenderer({ content }: { content: string }) {
  return <div className="min-w-0 max-w-full overflow-hidden">{parseBlocks(content).map((block, index) => <BlockView key={index} block={block} />)}</div>
}

export { CodeBlock }
