'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { listSchedules, pauseSchedule, resumeSchedule, cronToHuman, triggerScheduleNow } from '@/lib/scheduler'
import type { Schedule } from '@/lib/scheduler'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  RiRobot2Line,
  RiRobot2Fill,
  RiCodeSSlashLine,
  RiCodeSSlashFill,
  RiBarChartBoxLine,
  RiBarChartBoxFill,
  RiUser3Line,
  RiUser3Fill,
  RiBookmarkLine,
  RiBookmarkFill,
  RiSearchLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiSubtractLine,
  RiRefreshLine,
  RiExternalLinkLine,
  RiCalendarLine,
  RiTimeLine,
  RiPlayLine,
  RiPauseLine,
  RiHistoryLine,
  RiCloseLine,
} from 'react-icons/ri'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_IDS = {
  AI_NEWS: '699bddd1336f11cbaf47f1db',
  CODING_NEWS: '699bddd1abc429f336b465f0',
  RANKING: '699bddd1cf61d84732195a83',
  SEARCH: '699bddd24df6471a57878996',
} as const

const SCHEDULE_IDS = {
  AI_NEWS: '699bdddf399dfadeac387715',
  CODING_NEWS: '699bdddf399dfadeac387716',
  RANKING: '699bdddf399dfadeac387717',
} as const

const BOOKMARKS_KEY = 'daily_digest_bookmarks'
const HISTORY_KEY = 'daily_digest_history'

const AGENTS_INFO = [
  { id: AGENT_IDS.AI_NEWS, name: 'AI\u65b0\u77e5Agent', purpose: '\u81ea\u52d5\u641c\u5c0b\u6bcf\u65e5AI\u9818\u57df\u65b0\u805e' },
  { id: AGENT_IDS.CODING_NEWS, name: 'Coding\u65b0\u77e5Agent', purpose: '\u81ea\u52d5\u641c\u5c0b\u6bcf\u65e5\u7a0b\u5f0f\u958b\u767c\u65b0\u805e' },
  { id: AGENT_IDS.RANKING, name: 'Ranking\u7814\u7a76Agent', purpose: '\u7814\u7a76AI\u61c9\u7528\u5de5\u5177\u6392\u884c\u699c' },
  { id: AGENT_IDS.SEARCH, name: '\u5167\u5bb9\u641c\u5c0bAgent', purpose: '\u641c\u5c0bAI\u8207\u7a0b\u5f0f\u76f8\u95dc\u5167\u5bb9' },
]

const RANKING_CATEGORIES = [
  '\u5168\u90e8', 'AI\u804a\u5929', 'AI\u5716\u50cf', 'AI\u7de8\u7a0b', 'AI\u5beb\u4f5c',
  'AI\u5f71\u7247', 'AI\u97f3\u6a02', 'AI\u641c\u5c0b', '\u5176\u4ed6AI\u5de5\u5177',
]

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface ArticleItem {
  title: string
  summary: string
  source: string
  url: string
  tags: string[]
  publishedAt: string
}

interface NewsResponse {
  date: string
  category: string
  articles: ArticleItem[]
  totalCount: number
}

interface RankingItem {
  rank: number
  name: string
  description: string
  category: string
  score: number
  trend: string
  features: string[]
}

interface RankingResponse {
  updatedAt: string
  rankings: RankingItem[]
  totalCount: number
}

interface SearchResultItem {
  title: string
  summary: string
  source: string
  url: string
  relevance: string
  category: string
}

interface SearchResponse {
  query: string
  results: SearchResultItem[]
  totalResults: number
}

interface BookmarkItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  tags: string[]
  category: string
  bookmarkedAt: string
}

interface HistoryItem {
  id: string
  title: string
  summary: string
  source: string
  url: string
  category: string
  readAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function parseAgentResult(result: any): any {
  if (!result) return null
  if (result?.response?.result) {
    const r = result.response.result
    if (typeof r === 'string') {
      try { return JSON.parse(r) } catch { return null }
    }
    return r
  }
  if (result?.response?.status === 'success' && result?.response?.result) {
    return result.response.result
  }
  if (result?.raw_response) {
    try { return JSON.parse(result.raw_response) } catch { /* noop */ }
  }
  return null
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.slice(4)}</h4>
        if (line.startsWith('## '))
          return <h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(3)}</h3>
        if (line.startsWith('# '))
          return <h2 key={i} className="font-bold text-lg mt-4 mb-2">{line.slice(2)}</h2>
        if (line.startsWith('- ') || line.startsWith('* '))
          return <li key={i} className="ml-4 list-disc text-sm">{formatInline(line.slice(2))}</li>
        if (/^\d+\.\s/.test(line))
          return <li key={i} className="ml-4 list-decimal text-sm">{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{formatInline(line)}</p>
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  )
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const SAMPLE_AI_NEWS: NewsResponse = {
  date: '2026-02-23',
  category: 'AI',
  articles: [
    {
      title: 'OpenAI \u767c\u5e03 GPT-5 \u591a\u6a21\u614b\u6a21\u578b\uff0c\u652f\u63f4\u5373\u6642\u5f71\u50cf\u7406\u89e3',
      summary: 'OpenAI \u6b63\u5f0f\u767c\u5e03 GPT-5\uff0c\u652f\u63f4\u6587\u5b57\u3001\u5716\u50cf\u3001\u5f71\u7247\u591a\u6a21\u614b\u8f38\u5165\uff0c\u5728\u63a8\u7406\u80fd\u529b\u4e0a\u6709\u986f\u8457\u63d0\u5347\u3002',
      source: 'TechCrunch',
      url: 'https://example.com/gpt5',
      tags: ['GPT-5', 'OpenAI', '\u591a\u6a21\u614b'],
      publishedAt: '2026-02-23T08:00:00Z',
    },
    {
      title: 'Google DeepMind \u65b0\u7814\u7a76\uff1aAI Agent \u53ef\u81ea\u4e3b\u5b78\u7fd2\u8907\u96dc\u4efb\u52d9\u6d41\u7a0b',
      summary: 'DeepMind \u7814\u7a76\u5718\u968a\u5c55\u793a\u4e86\u80fd\u5920\u81ea\u4e3b\u5b78\u7fd2\u591a\u6b65\u9a5f\u5de5\u4f5c\u6d41\u7a0b\u7684AI Agent\uff0c\u5728\u8fa6\u516c\u5ba4\u81ea\u52d5\u5316\u4efb\u52d9\u4e2d\u8868\u73fe\u512a\u7570\u3002',
      source: 'Ars Technica',
      url: 'https://example.com/deepmind-agents',
      tags: ['DeepMind', 'AI Agent', '\u81ea\u4e3b\u5b78\u7fd2'],
      publishedAt: '2026-02-23T06:30:00Z',
    },
    {
      title: '\u53f0\u7063AI\u65b0\u5275\u7372\u5f972\u5104\u7f8e\u5143\u878d\u8cc7\uff0c\u5c08\u653b\u91ab\u7642\u5f71\u50cf\u8fa8\u8b58',
      summary: '\u53f0\u7063\u65b0\u5275\u516c\u53f8\u300cMedVision AI\u300d\u5ba3\u5e03\u7372\u5f97B\u8f2a\u878d\u8cc7\uff0c\u5c07\u62d3\u5c55\u5176\u91ab\u7642\u5f71\u50cf AI \u8a3a\u65b7\u5e73\u53f0\u81f3\u6771\u5357\u4e9e\u5e02\u5834\u3002',
      source: '\u79d1\u6280\u65b0\u5831',
      url: 'https://example.com/medvision-funding',
      tags: ['\u91ab\u7642AI', '\u878d\u8cc7', '\u53f0\u7063'],
      publishedAt: '2026-02-23T04:15:00Z',
    },
    {
      title: 'Meta \u958b\u6e90 Llama 4 \u6a21\u578b\uff0c\u6027\u80fd\u5339\u6575\u5546\u7528\u65b9\u6848',
      summary: 'Meta \u91cb\u51fa Llama 4 \u7cfb\u5217\u6a21\u578b\uff0c\u5728\u591a\u9805\u57fa\u6e96\u6e2c\u8a66\u4e2d\u8207 GPT-4 \u8868\u73fe\u76f8\u7576\uff0c\u63a8\u52d5\u958b\u6e90AI\u751f\u614b\u7cfb\u767c\u5c55\u3002',
      source: 'The Verge',
      url: 'https://example.com/llama4',
      tags: ['Llama 4', 'Meta', '\u958b\u6e90'],
      publishedAt: '2026-02-22T22:00:00Z',
    },
  ],
  totalCount: 4,
}

const SAMPLE_CODING_NEWS: NewsResponse = {
  date: '2026-02-23',
  category: 'Coding',
  articles: [
    {
      title: 'React 20 \u6b63\u5f0f\u767c\u5e03\uff1a\u5167\u5efa Server Components \u8207\u6548\u80fd\u512a\u5316',
      summary: 'React 20 \u5e36\u4f86\u5168\u65b0\u7684\u6e32\u67d3\u5f15\u64ce\u3001\u66f4\u597d\u7684 Server Components \u652f\u63f4\u4ee5\u53ca\u986f\u8457\u7684\u6548\u80fd\u63d0\u5347\u3002',
      source: 'React Blog',
      url: 'https://example.com/react20',
      tags: ['React', 'Server Components', 'JavaScript'],
      publishedAt: '2026-02-23T09:00:00Z',
    },
    {
      title: 'Rust 2026 \u7248\u672c\u4ecb\u7d39\u975e\u540c\u6b65\u7c21\u5316\u8a9e\u6cd5',
      summary: 'Rust \u7de8\u7a0b\u8a9e\u8a00 2026 \u7248\u672c\u5c07\u5f15\u5165\u66f4\u7c21\u6f54\u7684 async/await \u8a9e\u6cd5\uff0c\u964d\u4f4e\u975e\u540c\u6b65\u7a0b\u5f0f\u958b\u767c\u7684\u9580\u6abb\u3002',
      source: 'Rust Blog',
      url: 'https://example.com/rust2026',
      tags: ['Rust', 'Async', '\u7a0b\u5f0f\u8a9e\u8a00'],
      publishedAt: '2026-02-23T07:30:00Z',
    },
    {
      title: 'Bun 2.0 \u767c\u5e03\uff0c\u5b8c\u5168\u76f8\u5bb9 Node.js \u751f\u614b\u7cfb',
      summary: 'Bun 2.0 \u5be6\u73fe\u4e86\u5c0d Node.js API \u7684\u5b8c\u6574\u76f8\u5bb9\uff0c\u540c\u6642\u4fdd\u6301\u986f\u8457\u7684\u6548\u80fd\u512a\u52e2\uff0c\u6210\u70ba JavaScript \u57f7\u884c\u74b0\u5883\u65b0\u9078\u64c7\u3002',
      source: 'Bun Blog',
      url: 'https://example.com/bun2',
      tags: ['Bun', 'Node.js', 'JavaScript'],
      publishedAt: '2026-02-23T05:00:00Z',
    },
  ],
  totalCount: 3,
}

const SAMPLE_RANKING: RankingResponse = {
  updatedAt: '2026-02-17',
  rankings: [
    { rank: 1, name: 'ChatGPT', description: '\u6700\u5ee3\u6cdb\u4f7f\u7528\u7684AI\u804a\u5929\u52a9\u624b\uff0c\u652f\u63f4\u591a\u6a21\u614b\u5c0d\u8a71', category: 'AI\u804a\u5929', score: 9.5, trend: 'stable', features: ['\u591a\u6a21\u614b', '\u63d2\u4ef6\u751f\u614b\u7cfb', 'GPT Store'] },
    { rank: 2, name: 'Claude', description: 'Anthropic \u958b\u767c\u7684\u9ad8\u54c1\u8cea\u5c0d\u8a71AI\uff0c\u64c5\u9577\u9577\u6587\u672c\u8655\u7406', category: 'AI\u804a\u5929', score: 9.3, trend: 'up', features: ['\u9577\u6587\u672c', '\u7a0b\u5f0f\u958b\u767c', '\u5b89\u5168\u6027'] },
    { rank: 3, name: 'Midjourney', description: '\u9802\u7d1a\u7684AI\u5716\u50cf\u751f\u6210\u5de5\u5177\uff0c\u85dd\u8853\u98a8\u683c\u7a81\u51fa', category: 'AI\u5716\u50cf', score: 9.1, trend: 'stable', features: ['\u9ad8\u54c1\u8cea\u5716\u50cf', '\u98a8\u683c\u63a7\u5236', 'V7\u6a21\u578b'] },
    { rank: 4, name: 'Cursor', description: 'AI\u7a0b\u5f0f\u7de8\u8f2f\u5668\uff0c\u6574\u5408GPT-4\u63d0\u4f9b\u667a\u80fd\u7de8\u7a0b\u8f14\u52a9', category: 'AI\u7de8\u7a0b', score: 9.0, trend: 'up', features: ['Copilot++', '\u591a\u6a94\u6848\u7de8\u8f2f', 'Agent\u6a21\u5f0f'] },
    { rank: 5, name: 'Perplexity', description: 'AI\u641c\u5c0b\u5f15\u64ce\uff0c\u63d0\u4f9b\u5373\u6642\u7db2\u8def\u641c\u5c0b\u8207\u5f15\u7528\u4f86\u6e90', category: 'AI\u641c\u5c0b', score: 8.8, trend: 'up', features: ['\u5373\u6642\u641c\u5c0b', '\u5f15\u7528\u4f86\u6e90', 'Pro\u6a21\u5f0f'] },
    { rank: 6, name: 'Suno', description: 'AI\u97f3\u6a02\u751f\u6210\u5e73\u53f0\uff0c\u53ef\u5275\u4f5c\u5b8c\u6574\u6b4c\u66f2', category: 'AI\u97f3\u6a02', score: 8.5, trend: 'up', features: ['\u5168\u66f2\u751f\u6210', '\u6b4c\u8a5e\u5275\u4f5c', '\u591a\u98a8\u683c'] },
    { rank: 7, name: 'Runway', description: 'AI\u5f71\u7247\u751f\u6210\u8207\u7de8\u8f2f\u5de5\u5177\uff0cGen-3\u6a21\u578b\u9818\u5148', category: 'AI\u5f71\u7247', score: 8.3, trend: 'stable', features: ['\u6587\u5b57\u751f\u5f71\u7247', '\u5f71\u7247\u7de8\u8f2f', '\u52d5\u4f5c\u63a7\u5236'] },
    { rank: 8, name: 'Jasper', description: 'AI\u5beb\u4f5c\u52a9\u624b\uff0c\u5c08\u6ce8\u884c\u92b7\u5167\u5bb9\u751f\u6210', category: 'AI\u5beb\u4f5c', score: 8.0, trend: 'down', features: ['\u884c\u92b7\u6587\u6848', '\u54c1\u724c\u8072\u97f3', 'SEO\u512a\u5316'] },
  ],
  totalCount: 8,
}

const SAMPLE_SEARCH: SearchResponse = {
  query: 'AI Agent \u958b\u767c\u6846\u67b6',
  results: [
    { title: 'LangChain vs CrewAI\uff1aAI Agent \u6846\u67b6\u5c0d\u6bd4\u5206\u6790', summary: '\u6df1\u5165\u5c0d\u6bd4\u5169\u5927 AI Agent \u958b\u767c\u6846\u67b6\u7684\u512a\u52e3\u52e2\u3001\u9069\u7528\u5834\u666f\u8207\u5be6\u969b\u6848\u4f8b\u3002', source: 'InfoQ', url: 'https://example.com/langchain-crewai', relevance: '\u9ad8', category: 'AI' },
    { title: '\u5982\u4f55\u7528 Python \u5efa\u7acb\u7b2c\u4e00\u500b AI Agent', summary: '\u5f9e\u96f6\u958b\u59cb\u7684 AI Agent \u958b\u767c\u6559\u7a0b\uff0c\u5305\u542b\u5de5\u5177\u8abf\u7528\u3001\u8a18\u61b6\u7ba1\u7406\u548c\u591a Agent \u5354\u4f5c\u3002', source: 'Medium', url: 'https://example.com/python-agent', relevance: '\u9ad8', category: 'Coding' },
    { title: 'Microsoft AutoGen \u6846\u67b6\u66f4\u65b0\uff1a\u652f\u63f4\u81ea\u5b9a\u7fa9\u5de5\u4f5c\u6d41', summary: 'AutoGen \u65b0\u7248\u672c\u63d0\u4f9b\u4e86\u66f4\u9748\u6d3b\u7684\u591a Agent \u5354\u4f5c\u6a5f\u5236\u8207\u5de5\u4f5c\u6d41\u5b9a\u7fa9\u65b9\u5f0f\u3002', source: 'Microsoft Blog', url: 'https://example.com/autogen', relevance: '\u4e2d', category: 'AI' },
  ],
  totalResults: 3,
}

// ---------------------------------------------------------------------------
// ErrorBoundary
// ---------------------------------------------------------------------------

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border border-border bg-card">
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="text-4xl mb-4 opacity-30">{icon}</div>
      <p className="text-sm" style={{ lineHeight: '1.7' }}>{message}</p>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <p className="text-sm mb-4 text-center text-red-400" style={{ lineHeight: '1.7' }}>{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="border-border text-foreground">
        <RiRefreshLine className="mr-2 h-4 w-4" />
        {'\u91cd\u8a66'}
      </Button>
    </div>
  )
}

function ArticleCard({
  article,
  category,
  isBookmarked,
  onToggleBookmark,
  onRead,
  isExpanded,
  onToggleExpand,
}: {
  article: ArticleItem
  category: string
  isBookmarked: boolean
  onToggleBookmark: () => void
  onRead: () => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const tags = Array.isArray(article?.tags) ? article.tags : []

  const handleExpand = () => {
    onToggleExpand()
    if (!isExpanded) {
      onRead()
    }
  }

  return (
    <Card
      className="border border-border bg-card cursor-pointer transition-all duration-200 hover:border-muted-foreground/30"
      onClick={handleExpand}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3
            className="font-serif font-bold text-base text-foreground tracking-tight flex-1"
            style={{ lineHeight: '1.7', letterSpacing: '-0.02em' }}
          >
            {article?.title ?? ''}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleBookmark()
            }}
            className="shrink-0 text-muted-foreground hover:text-accent transition-colors mt-1"
          >
            {isBookmarked ? (
              <RiBookmarkFill className="h-5 w-5 text-accent" />
            ) : (
              <RiBookmarkLine className="h-5 w-5" />
            )}
          </button>
        </div>

        <p
          className={`text-sm text-muted-foreground mt-2 font-sans ${isExpanded ? '' : 'line-clamp-2'}`}
          style={{ lineHeight: '1.7', letterSpacing: '-0.02em' }}
        >
          {article?.summary ?? ''}
        </p>

        {isExpanded && article?.url && (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 mt-3 text-xs text-accent hover:underline"
          >
            <RiExternalLinkLine className="h-3.5 w-3.5" />
            {'\u95b1\u8b80\u539f\u6587'}
          </a>
        )}

        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs font-sans bg-secondary text-secondary-foreground border-0">
              {article?.source ?? ''}
            </Badge>
            {tags.slice(0, 3).map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs font-sans border-border text-muted-foreground">
                {tag}
              </Badge>
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-sans shrink-0">
            {article?.publishedAt ? formatTime(article.publishedAt) : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function formatTime(timeStr: string): string {
  if (!timeStr) return ''
  try {
    const date = new Date(timeStr)
    if (isNaN(date.getTime())) return timeStr
    const h = date.getHours().toString().padStart(2, '0')
    const m = date.getMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  } catch {
    return timeStr
  }
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up') return <RiArrowUpLine className="h-4 w-4 text-green-400" />
  if (trend === 'down') return <RiArrowDownLine className="h-4 w-4 text-red-400" />
  return <RiSubtractLine className="h-4 w-4 text-muted-foreground" />
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(Math.max((score / 10) * 100, 0), 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-none overflow-hidden">
        <div className="h-full bg-accent rounded-none" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-8 text-right">{score}</span>
    </div>
  )
}

function RelevanceBadge({ relevance }: { relevance: string }) {
  const colorMap: Record<string, string> = {
    '\u9ad8': 'bg-green-900/40 text-green-300 border-green-800/50',
    '\u4e2d': 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50',
    '\u4f4e': 'bg-red-900/40 text-red-300 border-red-800/50',
  }
  const cls = colorMap[relevance] ?? 'bg-secondary text-secondary-foreground border-border'
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {relevance}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Tab Content Components
// ---------------------------------------------------------------------------

function NewsTab({
  agentId,
  category,
  data,
  setData,
  loading,
  setLoading,
  error,
  setError,
  bookmarks,
  toggleBookmark,
  addHistory,
  showSample,
  activeAgentId,
  setActiveAgentId,
}: {
  agentId: string
  category: string
  data: NewsResponse | null
  setData: (d: NewsResponse | null) => void
  loading: boolean
  setLoading: (l: boolean) => void
  error: string | null
  setError: (e: string | null) => void
  bookmarks: BookmarkItem[]
  toggleBookmark: (article: ArticleItem, category: string) => void
  addHistory: (article: ArticleItem, category: string) => void
  showSample: boolean
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActiveAgentId(agentId)
    try {
      const result = await callAIAgent(
        `\u8acb\u641c\u5c0b\u4e26\u5f59\u6574\u4eca\u65e5\u6700\u65b0\u7684${category}\u9818\u57df\u4e2d\u6587\u8cc7\u8a0a\uff0c\u751f\u6210\u7d50\u69cb\u5316\u7684\u6bcf\u65e5\u65b0\u77e5\u6458\u8981`,
        agentId
      )
      const parsed = parseAgentResult(result)
      if (parsed && (Array.isArray(parsed?.articles) || parsed?.date)) {
        setData(parsed as NewsResponse)
      } else {
        setError('\u7121\u6cd5\u89e3\u6790\u56de\u61c9\u8cc7\u6599')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u7db2\u8def\u932f\u8aa4')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [agentId, category, setData, setLoading, setError, setActiveAgentId])

  const displayData = showSample ? (category === 'AI' ? SAMPLE_AI_NEWS : SAMPLE_CODING_NEWS) : data
  const articles = Array.isArray(displayData?.articles) ? displayData.articles : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-sans">
            {displayData?.date ? `${displayData.date}` : '\u9ede\u64ca\u4e0b\u65b9\u6309\u9215\u7372\u53d6\u4eca\u65e5\u65b0\u805e'}
          </p>
          {(displayData?.totalCount ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {'\u5171'} {displayData?.totalCount ?? articles.length} {'\u7bc7'}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchNews}
          disabled={loading}
          className="border-border text-foreground text-xs"
        >
          <RiRefreshLine className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '\u8f09\u5165\u4e2d...' : '\u7372\u53d6\u6700\u65b0'}
        </Button>
      </div>

      {loading && <SkeletonCards count={4} />}

      {!loading && error && <ErrorState message={error} onRetry={fetchNews} />}

      {!loading && !error && articles.length === 0 && (
        <EmptyState
          message={`\u5c1a\u7121${category}\u65b0\u805e\uff0c\u9ede\u64ca\u300c\u7372\u53d6\u6700\u65b0\u300d\u958b\u59cb`}
          icon={category === 'AI' ? <RiRobot2Line /> : <RiCodeSSlashLine />}
        />
      )}

      {!loading && articles.length > 0 && (
        <div className="space-y-3">
          {articles.map((article, idx) => {
            const artId = generateId(article?.title ?? `art-${idx}`)
            const isBookmarked = bookmarks.some((b) => b.id === artId)
            return (
              <ArticleCard
                key={artId}
                article={article}
                category={category}
                isBookmarked={isBookmarked}
                onToggleBookmark={() => toggleBookmark(article, category)}
                onRead={() => addHistory(article, category)}
                isExpanded={expandedId === artId}
                onToggleExpand={() => setExpandedId(expandedId === artId ? null : artId)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function RankingTab({
  data,
  setData,
  loading,
  setLoading,
  error,
  setError,
  showSample,
  activeAgentId,
  setActiveAgentId,
}: {
  data: RankingResponse | null
  setData: (d: RankingResponse | null) => void
  loading: boolean
  setLoading: (l: boolean) => void
  error: string | null
  setError: (e: string | null) => void
  showSample: boolean
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
}) {
  const [selectedCategory, setSelectedCategory] = useState('\u5168\u90e8')

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActiveAgentId(AGENT_IDS.RANKING)
    try {
      const result = await callAIAgent(
        '\u8acb\u7814\u7a76\u4e26\u6574\u7406\u7576\u524d\u6700\u65b0\u7684AI\u61c9\u7528\u5de5\u5177\u6392\u884c\u699c\uff0c\u5305\u62ec\u4f7f\u7528\u91cf\u3001\u8a55\u50f9\u3001\u529f\u80fd\u5c0d\u6bd4',
        AGENT_IDS.RANKING
      )
      const parsed = parseAgentResult(result)
      if (parsed && (Array.isArray(parsed?.rankings) || parsed?.updatedAt)) {
        setData(parsed as RankingResponse)
      } else {
        setError('\u7121\u6cd5\u89e3\u6790\u6392\u884c\u8cc7\u6599')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '\u7db2\u8def\u932f\u8aa4')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [setData, setLoading, setError, setActiveAgentId])

  const displayData = showSample ? SAMPLE_RANKING : data
  const allRankings = Array.isArray(displayData?.rankings) ? displayData.rankings : []
  const rankings =
    selectedCategory === '\u5168\u90e8'
      ? allRankings
      : allRankings.filter((r) => r?.category === selectedCategory)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif font-bold text-lg text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            AI{'\u61c9\u7528\u6392\u884c'}
          </h2>
          {displayData?.updatedAt && (
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              {'\u66f4\u65b0\u65bc'} {displayData.updatedAt}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchRankings}
          disabled={loading}
          className="border-border text-foreground text-xs"
        >
          <RiRefreshLine className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '\u8f09\u5165\u4e2d...' : '\u66f4\u65b0\u6392\u884c'}
        </Button>
      </div>

      {/* Category filters */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {RANKING_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 px-3 py-1.5 text-xs font-sans border transition-colors ${selectedCategory === cat ? 'bg-foreground text-background border-foreground' : 'bg-transparent text-muted-foreground border-border hover:border-muted-foreground'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </ScrollArea>

      {loading && <SkeletonCards count={5} />}

      {!loading && error && <ErrorState message={error} onRetry={fetchRankings} />}

      {!loading && !error && rankings.length === 0 && (
        <EmptyState
          message={'\u5c1a\u7121\u6392\u884c\u8cc7\u6599\uff0c\u9ede\u64ca\u300c\u66f4\u65b0\u6392\u884c\u300d\u958b\u59cb'}
          icon={<RiBarChartBoxLine />}
        />
      )}

      {!loading && rankings.length > 0 && (
        <div className="space-y-2">
          {rankings.map((item, idx) => {
            const features = Array.isArray(item?.features) ? item.features : []
            return (
              <Card key={`${item?.name ?? idx}-${idx}`} className="border border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Rank number */}
                    <div className="flex items-center justify-center w-8 h-8 shrink-0 bg-secondary font-mono text-sm font-bold text-foreground">
                      {item?.rank ?? idx + 1}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-serif font-bold text-sm text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                            {item?.name ?? ''}
                          </h3>
                          <TrendIcon trend={item?.trend ?? 'stable'} />
                        </div>
                        <Badge variant="secondary" className="text-xs font-sans bg-secondary text-secondary-foreground border-0 shrink-0">
                          {item?.category ?? ''}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground font-sans" style={{ lineHeight: '1.7' }}>
                        {item?.description ?? ''}
                      </p>

                      <ScoreBar score={item?.score ?? 0} />

                      {features.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {features.map((f, fi) => (
                            <Badge key={fi} variant="outline" className="text-xs font-sans border-border text-muted-foreground">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MyHistoryTab({
  bookmarks,
  history,
  removeBookmark,
  clearHistory,
  showSample,
  activeAgentId,
  setActiveAgentId,
  schedules,
  schedulesLoading,
  loadSchedules,
}: {
  bookmarks: BookmarkItem[]
  history: HistoryItem[]
  removeBookmark: (id: string) => void
  clearHistory: () => void
  showSample: boolean
  activeAgentId: string | null
  setActiveAgentId: (id: string | null) => void
  schedules: Schedule[]
  schedulesLoading: boolean
  loadSchedules: () => Promise<void>
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [subTab, setSubTab] = useState<'bookmarks' | 'history'>('bookmarks')
  const [triggeringId, setTriggeringId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setSearchLoading(true)
    setSearchError(null)
    setActiveAgentId(AGENT_IDS.SEARCH)
    try {
      const result = await callAIAgent(
        `\u641c\u5c0b\u95dc\u65bc "${searchQuery}" \u7684AI\u548c\u7a0b\u5f0f\u958b\u767c\u76f8\u95dc\u5167\u5bb9`,
        AGENT_IDS.SEARCH
      )
      const parsed = parseAgentResult(result)
      if (parsed && (Array.isArray(parsed?.results) || parsed?.query)) {
        setSearchResults(parsed as SearchResponse)
      } else {
        setSearchError('\u7121\u6cd5\u89e3\u6790\u641c\u5c0b\u7d50\u679c')
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : '\u7db2\u8def\u932f\u8aa4')
    } finally {
      setSearchLoading(false)
      setActiveAgentId(null)
    }
  }, [searchQuery, setActiveAgentId])

  const displaySearchResults = showSample ? SAMPLE_SEARCH : searchResults
  const results = Array.isArray(displaySearchResults?.results) ? displaySearchResults.results : []

  const handleToggleSchedule = async (schedule: Schedule) => {
    setTogglingId(schedule.id)
    if (schedule.is_active) {
      await pauseSchedule(schedule.id)
    } else {
      await resumeSchedule(schedule.id)
    }
    await loadSchedules()
    setTogglingId(null)
  }

  const handleTrigger = async (scheduleId: string) => {
    setTriggeringId(scheduleId)
    await triggerScheduleNow(scheduleId)
    setTriggeringId(null)
  }

  const SCHEDULE_META: Record<string, { name: string; agent: string }> = {
    [SCHEDULE_IDS.AI_NEWS]: { name: 'AI\u65b0\u805e\u6392\u7a0b', agent: 'AI\u65b0\u77e5Agent' },
    [SCHEDULE_IDS.CODING_NEWS]: { name: 'Coding\u65b0\u805e\u6392\u7a0b', agent: 'Coding\u65b0\u77e5Agent' },
    [SCHEDULE_IDS.RANKING]: { name: '\u6392\u884c\u699c\u6392\u7a0b', agent: 'Ranking\u7814\u7a76Agent' },
  }

  const knownScheduleIds = Object.values(SCHEDULE_IDS)
  const filteredSchedules = schedules.filter((s) => knownScheduleIds.includes(s.id))

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={'\u641c\u5c0b AI \u8207\u7a0b\u5f0f\u958b\u767c\u76f8\u95dc\u5167\u5bb9...'}
            className="bg-card border-border text-foreground placeholder:text-muted-foreground font-sans text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={searchLoading || !searchQuery.trim()}
            className="border-border text-foreground shrink-0 px-3"
          >
            {searchLoading ? (
              <RiRefreshLine className="h-4 w-4 animate-spin" />
            ) : (
              <RiSearchLine className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Search results */}
        {searchLoading && <div className="mt-4"><SkeletonCards count={3} /></div>}

        {searchError && (
          <div className="mt-4">
            <ErrorState message={searchError} onRetry={handleSearch} />
          </div>
        )}

        {!searchLoading && !searchError && results.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-sans">
                {'\u641c\u5c0b'} &ldquo;{displaySearchResults?.query ?? searchQuery}&rdquo; {'\u7d50\u679c'}
                {' \u00b7 '}{displaySearchResults?.totalResults ?? results.length}{' \u7b46'}
              </p>
              <button
                onClick={() => { setSearchResults(null); setSearchQuery('') }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <RiCloseLine className="h-4 w-4" />
              </button>
            </div>
            {results.map((item, idx) => (
              <Card key={idx} className="border border-border bg-card">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-serif font-bold text-sm text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                      {item?.title ?? ''}
                    </h3>
                    <RelevanceBadge relevance={item?.relevance ?? ''} />
                  </div>
                  <p className="text-xs text-muted-foreground font-sans" style={{ lineHeight: '1.7' }}>
                    {item?.summary ?? ''}
                  </p>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-sans bg-secondary text-secondary-foreground border-0">
                        {item?.source ?? ''}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-sans border-border text-muted-foreground">
                        {item?.category ?? ''}
                      </Badge>
                    </div>
                    {item?.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline inline-flex items-center gap-1"
                      >
                        <RiExternalLinkLine className="h-3 w-3" />
                        {'\u67e5\u770b'}
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Sub-tabs: Bookmarks / History */}
      <div>
        <div className="flex border-b border-border mb-4">
          <button
            onClick={() => setSubTab('bookmarks')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-sans transition-colors border-b-2 ${subTab === 'bookmarks' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <RiBookmarkLine className="h-4 w-4" />
            {'\u6536\u85cf'} ({bookmarks.length})
          </button>
          <button
            onClick={() => setSubTab('history')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-sans transition-colors border-b-2 ${subTab === 'history' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <RiHistoryLine className="h-4 w-4" />
            {'\u700f\u89bd\u6b77\u53f2'} ({history.length})
          </button>
        </div>

        {subTab === 'bookmarks' && (
          <>
            {bookmarks.length === 0 ? (
              <EmptyState
                message={'\u5c1a\u7121\u6536\u85cf\u7684\u6587\u7ae0\uff0c\u9ede\u64ca\u6587\u7ae0\u65c1\u7684\u66f8\u7c64\u5716\u793a\u4f86\u6536\u85cf'}
                icon={<RiBookmarkLine />}
              />
            ) : (
              <div className="space-y-2">
                {bookmarks.map((bm) => (
                  <Card key={bm.id} className="border border-border bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-serif font-bold text-sm text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                            {bm?.title ?? ''}
                          </h3>
                          <p className="text-xs text-muted-foreground font-sans mt-1 line-clamp-2" style={{ lineHeight: '1.7' }}>
                            {bm?.summary ?? ''}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs font-sans bg-secondary text-secondary-foreground border-0">
                              {bm?.category ?? ''}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {bm?.source ?? ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeBookmark(bm.id)}
                          className="shrink-0 text-accent hover:text-red-400 transition-colors"
                        >
                          <RiBookmarkFill className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {subTab === 'history' && (
          <>
            {history.length > 0 && (
              <div className="flex justify-end mb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {'\u6e05\u9664\u6b77\u53f2'}
                </Button>
              </div>
            )}
            {history.length === 0 ? (
              <EmptyState
                message={'\u5c1a\u7121\u700f\u89bd\u6b77\u53f2\uff0c\u9ede\u64ca\u6587\u7ae0\u5373\u53ef\u8a18\u9304'}
                icon={<RiHistoryLine />}
              />
            ) : (
              <div className="space-y-2">
                {history.map((h) => (
                  <Card key={`${h.id}-${h.readAt}`} className="border border-border bg-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-serif font-bold text-sm text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                            {h?.title ?? ''}
                          </h3>
                          <p className="text-xs text-muted-foreground font-sans mt-1 line-clamp-1" style={{ lineHeight: '1.7' }}>
                            {h?.summary ?? ''}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs font-sans bg-secondary text-secondary-foreground border-0">
                              {h?.category ?? ''}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-sans">
                              {h?.readAt ? new Date(h.readAt).toLocaleString('zh-TW') : ''}
                            </span>
                          </div>
                        </div>
                        {h?.url && (
                          <a
                            href={h.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-accent transition-colors"
                          >
                            <RiExternalLinkLine className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Separator className="bg-border" />

      {/* Schedule Management */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold text-sm text-foreground tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            <RiCalendarLine className="inline-block h-4 w-4 mr-1.5 align-text-bottom" />
            {'\u6392\u7a0b\u7ba1\u7406'}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadSchedules}
            disabled={schedulesLoading}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <RiRefreshLine className={`h-3.5 w-3.5 ${schedulesLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {schedulesLoading && filteredSchedules.length === 0 && <SkeletonCards count={3} />}

        {filteredSchedules.length > 0 ? (
          <div className="space-y-2">
            {filteredSchedules.map((schedule) => {
              const meta = SCHEDULE_META[schedule.id]
              return (
                <Card key={schedule.id} className="border border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-sans font-medium text-foreground">
                          {meta?.name ?? schedule.id}
                        </p>
                        <p className="text-xs text-muted-foreground font-sans mt-0.5">
                          {meta?.agent ?? ''}
                        </p>
                      </div>
                      <Badge
                        variant={schedule.is_active ? 'default' : 'secondary'}
                        className={`text-xs ${schedule.is_active ? 'bg-green-900/40 text-green-300 border-green-800/50' : 'bg-secondary text-secondary-foreground'}`}
                      >
                        {schedule.is_active ? '\u904b\u884c\u4e2d' : '\u5df2\u6682\u505c'}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground font-sans">
                      {schedule?.cron_expression && (
                        <p className="flex items-center gap-1.5">
                          <RiTimeLine className="h-3 w-3 shrink-0" />
                          {cronToHuman(schedule.cron_expression)}
                          {schedule?.timezone ? ` (${schedule.timezone})` : ''}
                        </p>
                      )}
                      {schedule?.next_run_time && (
                        <p className="flex items-center gap-1.5">
                          <RiCalendarLine className="h-3 w-3 shrink-0" />
                          {'\u4e0b\u6b21\u57f7\u884c'}: {new Date(schedule.next_run_time).toLocaleString('zh-TW')}
                        </p>
                      )}
                      {schedule?.last_run_at && (
                        <p className="flex items-center gap-1.5">
                          <RiHistoryLine className="h-3 w-3 shrink-0" />
                          {'\u4e0a\u6b21\u57f7\u884c'}: {new Date(schedule.last_run_at).toLocaleString('zh-TW')}
                          {schedule.last_run_success !== null && (
                            <Badge
                              variant="outline"
                              className={`text-xs ml-1 ${schedule.last_run_success ? 'border-green-800/50 text-green-300' : 'border-red-800/50 text-red-300'}`}
                            >
                              {schedule.last_run_success ? '\u6210\u529f' : '\u5931\u6557'}
                            </Badge>
                          )}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleSchedule(schedule)}
                        disabled={togglingId === schedule.id}
                        className="text-xs border-border text-foreground flex-1"
                      >
                        {togglingId === schedule.id ? (
                          <RiRefreshLine className="mr-1 h-3 w-3 animate-spin" />
                        ) : schedule.is_active ? (
                          <RiPauseLine className="mr-1 h-3 w-3" />
                        ) : (
                          <RiPlayLine className="mr-1 h-3 w-3" />
                        )}
                        {schedule.is_active ? '\u6682\u505c' : '\u6062\u5fa9'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTrigger(schedule.id)}
                        disabled={triggeringId === schedule.id}
                        className="text-xs border-border text-foreground flex-1"
                      >
                        {triggeringId === schedule.id ? (
                          <RiRefreshLine className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <RiPlayLine className="mr-1 h-3 w-3" />
                        )}
                        {'\u7acb\u5373\u57f7\u884c'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          !schedulesLoading && (
            <p className="text-xs text-muted-foreground text-center py-6 font-sans">
              {'\u7121\u6392\u7a0b\u8cc7\u6599'}
            </p>
          )
        )}
      </div>

      <Separator className="bg-border" />

      {/* Agent Info */}
      <div>
        <h3 className="font-serif font-bold text-sm text-foreground tracking-tight mb-3" style={{ letterSpacing: '-0.02em' }}>
          {'\u4ee3\u7406\u72c0\u614b'}
        </h3>
        <div className="space-y-1.5">
          {AGENTS_INFO.map((agent) => (
            <div key={agent.id} className="flex items-center justify-between py-2 px-3 border border-border bg-card">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeAgentId === agent.id ? 'bg-accent animate-pulse' : 'bg-muted-foreground/30'}`} />
                <span className="text-xs font-sans text-foreground">{agent.name}</span>
              </div>
              <span className="text-xs font-sans text-muted-foreground">{agent.purpose}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Page() {
  const [activeTab, setActiveTab] = useState<'ai' | 'coding' | 'ranking' | 'my'>('ai')
  const [showSample, setShowSample] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // News state
  const [aiData, setAiData] = useState<NewsResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const [codingData, setCodingData] = useState<NewsResponse | null>(null)
  const [codingLoading, setCodingLoading] = useState(false)
  const [codingError, setCodingError] = useState<string | null>(null)

  // Ranking state
  const [rankingData, setRankingData] = useState<RankingResponse | null>(null)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [rankingError, setRankingError] = useState<string | null>(null)

  // Bookmarks & history
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])

  // Schedules
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedulesLoading, setSchedulesLoading] = useState(false)

  // Date
  const [todayStr, setTodayStr] = useState('')

  // Load from localStorage + set date
  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = (now.getMonth() + 1).toString().padStart(2, '0')
    const d = now.getDate().toString().padStart(2, '0')
    setTodayStr(`${y}-${m}-${d}`)

    try {
      const saved = localStorage.getItem(BOOKMARKS_KEY)
      if (saved) setBookmarks(JSON.parse(saved))
    } catch { /* noop */ }

    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved))
    } catch { /* noop */ }
  }, [])

  // Save bookmarks
  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks))
    } catch { /* noop */ }
  }, [bookmarks])

  // Save history
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch { /* noop */ }
  }, [history])

  // Load schedules
  const loadSchedules = useCallback(async () => {
    setSchedulesLoading(true)
    try {
      const result = await listSchedules()
      if (result.success) {
        setSchedules(result.schedules)
      }
    } catch { /* noop */ }
    setSchedulesLoading(false)
  }, [])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  // Bookmark toggle
  const toggleBookmark = useCallback((article: ArticleItem, category: string) => {
    const artId = generateId(article?.title ?? '')
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === artId)
      if (exists) {
        return prev.filter((b) => b.id !== artId)
      }
      const newBm: BookmarkItem = {
        id: artId,
        title: article?.title ?? '',
        summary: article?.summary ?? '',
        source: article?.source ?? '',
        url: article?.url ?? '',
        tags: Array.isArray(article?.tags) ? article.tags : [],
        category,
        bookmarkedAt: new Date().toISOString(),
      }
      return [newBm, ...prev]
    })
  }, [])

  const removeBookmark = useCallback((id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id))
  }, [])

  // History
  const addHistory = useCallback((article: ArticleItem, category: string) => {
    const artId = generateId(article?.title ?? '')
    setHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((h) => h.id !== artId)
      const newH: HistoryItem = {
        id: artId,
        title: article?.title ?? '',
        summary: article?.summary ?? '',
        source: article?.source ?? '',
        url: article?.url ?? '',
        category,
        readAt: new Date().toISOString(),
      }
      return [newH, ...filtered].slice(0, 100)
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const tabs = [
    {
      key: 'ai' as const,
      label: 'AI',
      iconActive: <RiRobot2Fill className="h-5 w-5" />,
      iconInactive: <RiRobot2Line className="h-5 w-5" />,
    },
    {
      key: 'coding' as const,
      label: 'Coding',
      iconActive: <RiCodeSSlashFill className="h-5 w-5" />,
      iconInactive: <RiCodeSSlashLine className="h-5 w-5" />,
    },
    {
      key: 'ranking' as const,
      label: '\u6392\u884c\u699c',
      iconActive: <RiBarChartBoxFill className="h-5 w-5" />,
      iconInactive: <RiBarChartBoxLine className="h-5 w-5" />,
    },
    {
      key: 'my' as const,
      label: '\u6211\u7684',
      iconActive: <RiUser3Fill className="h-5 w-5" />,
      iconInactive: <RiUser3Line className="h-5 w-5" />,
    },
  ]

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex flex-col font-sans" style={{ letterSpacing: '-0.02em' }}>
        {/* Header */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="font-serif font-bold text-xl tracking-tight text-foreground" style={{ letterSpacing: '-0.02em' }}>
                {'\u6bcf\u65e5\u65b0\u77e5'}
              </h1>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{todayStr}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-sans">Sample Data</span>
              <Switch
                checked={showSample}
                onCheckedChange={setShowSample}
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto pb-20">
          <div className="max-w-2xl mx-auto px-4 py-6">
            {activeTab === 'ai' && (
              <NewsTab
                agentId={AGENT_IDS.AI_NEWS}
                category="AI"
                data={aiData}
                setData={setAiData}
                loading={aiLoading}
                setLoading={setAiLoading}
                error={aiError}
                setError={setAiError}
                bookmarks={bookmarks}
                toggleBookmark={toggleBookmark}
                addHistory={addHistory}
                showSample={showSample}
                activeAgentId={activeAgentId}
                setActiveAgentId={setActiveAgentId}
              />
            )}

            {activeTab === 'coding' && (
              <NewsTab
                agentId={AGENT_IDS.CODING_NEWS}
                category="Coding"
                data={codingData}
                setData={setCodingData}
                loading={codingLoading}
                setLoading={setCodingLoading}
                error={codingError}
                setError={setCodingError}
                bookmarks={bookmarks}
                toggleBookmark={toggleBookmark}
                addHistory={addHistory}
                showSample={showSample}
                activeAgentId={activeAgentId}
                setActiveAgentId={setActiveAgentId}
              />
            )}

            {activeTab === 'ranking' && (
              <RankingTab
                data={rankingData}
                setData={setRankingData}
                loading={rankingLoading}
                setLoading={setRankingLoading}
                error={rankingError}
                setError={setRankingError}
                showSample={showSample}
                activeAgentId={activeAgentId}
                setActiveAgentId={setActiveAgentId}
              />
            )}

            {activeTab === 'my' && (
              <MyHistoryTab
                bookmarks={bookmarks}
                history={history}
                removeBookmark={removeBookmark}
                clearHistory={clearHistory}
                showSample={showSample}
                activeAgentId={activeAgentId}
                setActiveAgentId={setActiveAgentId}
                schedules={schedules}
                schedulesLoading={schedulesLoading}
                loadSchedules={loadSchedules}
              />
            )}
          </div>
        </main>

        {/* Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border">
          <div className="max-w-2xl mx-auto flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${activeTab === tab.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/70'}`}
              >
                {activeTab === tab.key ? tab.iconActive : tab.iconInactive}
                <span className="text-xs font-sans">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </ErrorBoundary>
  )
}
