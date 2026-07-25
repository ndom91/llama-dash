import { ChevronRight, MessageSquare, Terminal, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useMemo } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { cn } from '../../lib/cn'
import { useStickyToggle } from '../../lib/use-sticky-toggle'
import { estimateTextTokens } from './requestDetailUtils'
import { RequestJsonHighlight } from './RequestJsonHighlight'

type Props = {
  body: string
  direction: 'request' | 'response'
  baseKey: string
}

export function ParsedPayloadBlocks({ body, direction, baseKey }: Props) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(body) as Record<string, unknown>
    } catch {
      return null
    }
  }, [body])

  if (!parsed) return null

  if (direction === 'request') {
    return <ParsedRequestBlocks data={parsed} baseKey={baseKey} body={body} />
  }
  return <ParsedResponseBlocks data={parsed} baseKey={baseKey} body={body} />
}

// ----------------------------------------------------------------
// Shared collapsible section
// ----------------------------------------------------------------

function CollapsibleSection({
  label,
  icon,
  badge,
  storageKey,
  defaultOpen = false,
  copyText,
  children,
}: {
  label: string
  icon?: React.ReactNode
  badge?: string
  storageKey: string
  defaultOpen?: boolean
  copyText?: string
  children: React.ReactNode
}) {
  const [open, toggleOpen] = useStickyToggle(storageKey, defaultOpen)
  return (
    <div className="overflow-hidden border-t border-border text-xs">
      <div className="flex w-full items-center bg-surface-0">
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-dim hover:bg-surface-1"
          onClick={toggleOpen}
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
            strokeWidth={2}
          />
          {icon}
          <span>{label}</span>
          {badge ? <span className="ml-auto dim normal-case tracking-normal">{badge}</span> : null}
        </button>
        {copyText != null ? (
          <CopyButton text={copyText} variant="icon" icon="clipboard" ariaLabel={`Copy ${label}`} />
        ) : null}
      </div>
      {open ? <div className="w-full overflow-visible border-t border-border px-3 py-2.5">{children}</div> : null}
    </div>
  )
}

function JsonBlock({ data }: { data: unknown }) {
  return <RequestJsonHighlight json={JSON.stringify(data, null, 2)} />
}

// ----------------------------------------------------------------
// Request blocks
// ----------------------------------------------------------------

function ParsedRequestBlocks({
  data,
  baseKey,
  body,
}: {
  data: Record<string, unknown>
  baseKey: string
  body: string
}) {
  const messages = Array.isArray(data.messages) ? (data.messages as unknown[]) : null
  const tools = Array.isArray(data.tools) ? (data.tools as unknown[]) : null
  const functions = Array.isArray(data.functions) ? (data.functions as unknown[]) : null
  const system = typeof data.system === 'string' ? data.system : Array.isArray(data.system) ? data.system : null

  const hasAny = messages || tools || functions || system

  const parameters = useMemo(() => {
    const excluded = new Set(['messages', 'tools', 'functions', 'system'])
    const params: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (!excluded.has(key) && value != null) {
        params[key] = value
      }
    }
    return Object.keys(params).length > 0 ? params : null
  }, [data])

  if (!hasAny) {
    return (
      <CollapsibleSection
        label="raw request"
        icon={<Terminal size={12} strokeWidth={2} />}
        storageKey={`${baseKey}-raw-request-open`}
        defaultOpen
        copyText={body}
      >
        <JsonBlock data={data} />
      </CollapsibleSection>
    )
  }

  return (
    <>
      {parameters ? (
        <CollapsibleSection
          label="parsed parameters"
          icon={<Terminal size={12} strokeWidth={2} />}
          badge={`(${Object.keys(parameters).length} keys)`}
          storageKey={`${baseKey}-parameters-open`}
          defaultOpen
          copyText={JSON.stringify(parameters, null, 2)}
        >
          <JsonBlock data={parameters} />
        </CollapsibleSection>
      ) : null}
      {system ? (
        <CollapsibleSection
          label="system"
          icon={<MessageSquare size={12} strokeWidth={2} />}
          storageKey={`${baseKey}-system-open`}
          copyText={typeof system === 'string' ? system : JSON.stringify(system, null, 2)}
        >
          {typeof system === 'string' ? (
            <pre className="m-0 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
              {system}
            </pre>
          ) : (
            <JsonBlock data={system} />
          )}
        </CollapsibleSection>
      ) : null}
      {messages ? (
        <CollapsibleSection
          label="parsed messages"
          icon={<MessageSquare size={12} strokeWidth={2} />}
          badge={`(${messages.length} messages)`}
          storageKey={`${baseKey}-messages-open`}
          defaultOpen
          copyText={JSON.stringify(messages, null, 2)}
        >
          <MessagesList messages={messages} />
        </CollapsibleSection>
      ) : null}
      {tools ? (
        <CollapsibleSection
          label="parsed tools"
          icon={<Wrench size={12} strokeWidth={2} />}
          badge={`(${tools.length} tools)`}
          storageKey={`${baseKey}-tools-open`}
          copyText={JSON.stringify(tools, null, 2)}
        >
          <ToolsList tools={tools} />
        </CollapsibleSection>
      ) : null}
      {functions ? (
        <CollapsibleSection
          label="parsed functions"
          icon={<Wrench size={12} strokeWidth={2} />}
          badge={`(${functions.length} functions)`}
          storageKey={`${baseKey}-functions-open`}
          copyText={JSON.stringify(functions, null, 2)}
        >
          <FunctionsList functions={functions} />
        </CollapsibleSection>
      ) : null}
      <CollapsibleSection
        label="raw request"
        icon={<Terminal size={12} strokeWidth={2} />}
        badge={`(${body.length} chars)`}
        storageKey={`${baseKey}-raw-request-open`}
        copyText={body}
      >
        <JsonBlock data={data} />
      </CollapsibleSection>
    </>
  )
}

function SubBox({
  title,
  preview,
  tag,
  tagColor,
  children,
}: {
  title: string
  preview?: string | null
  tag?: string | null
  tagColor?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const truncatedPreview = preview ? (preview.length > 120 ? `${preview.slice(0, 117)}...` : preview) : null

  return (
    <div className="rounded-sm border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 bg-surface-0 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight
          className={cn('size-3 shrink-0 transition-transform duration-150', open && 'rotate-90')}
          strokeWidth={2}
        />
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-fg-dim">{title}</span>
        {truncatedPreview ? (
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-fg-faint">{truncatedPreview}</span>
        ) : null}
        {tag ? (
          <span className={cn('ml-auto shrink-0 pl-2 font-mono text-[10px]', tagColor || 'text-fg-dim')}>{tag}</span>
        ) : null}
      </button>
      {open ? <div className="px-2.5 py-1.5">{children}</div> : null}
    </div>
  )
}

function MessagesList({ messages }: { messages: unknown[] }) {
  return (
    <div className="space-y-1">
      {messages.map((msg, i) => {
        const msgObj = msg as Record<string, unknown> | undefined
        if (!msgObj || typeof msgObj !== 'object') {
          return (
            <SubBox key={i} title={`message ${i + 1}`}>
              <JsonBlock data={msg} />
            </SubBox>
          )
        }
        const role = typeof msgObj.role === 'string' ? msgObj.role : 'unknown'
        const content = msgObj.content
        const toolCalls = msgObj.tool_calls
        const toolResults = msgObj.tool_call_ids

        const contentPreview =
          typeof content === 'string'
            ? content.slice(0, 120)
            : Array.isArray(content)
              ? `${content.length} blocks`
              : content != null
                ? 'structured'
                : null

        const tag = Array.isArray(toolCalls) ? `${toolCalls.length} tool calls` : toolResults ? 'tool results' : null

        return (
          <SubBox
            key={i}
            title={role}
            preview={contentPreview}
            tag={tag}
            tagColor={Array.isArray(toolCalls) ? 'text-warn' : 'text-info'}
          >
            <JsonBlock data={msg} />
          </SubBox>
        )
      })}
    </div>
  )
}

function ToolsList({ tools }: { tools: unknown[] }) {
  return (
    <div className="space-y-1">
      {tools.map((tool, i) => {
        const t = tool as Record<string, unknown> | undefined
        if (!t || typeof t !== 'object') {
          return (
            <SubBox key={i} title={`tool ${i + 1}`}>
              <JsonBlock data={tool} />
            </SubBox>
          )
        }
        const fnObj =
          typeof t.function === 'object' && t.function !== null ? (t.function as Record<string, unknown>) : null
        const name = fnObj ? (typeof fnObj.name === 'string' ? fnObj.name : null) : null
        const desc = name ? (typeof fnObj?.description === 'string' ? fnObj.description : null) : null
        const preview = desc && desc.length > 0 ? desc.slice(0, 120) : null

        return (
          <SubBox key={i} title={name ?? `tool ${i + 1}`} preview={preview}>
            <JsonBlock data={t} />
          </SubBox>
        )
      })}
    </div>
  )
}

function FunctionsList({ functions }: { functions: unknown[] }) {
  return (
    <div className="space-y-1">
      {functions.map((fn, i) => {
        const f = fn as Record<string, unknown> | undefined
        if (!f || typeof f !== 'object') {
          return (
            <SubBox key={i} title={`function ${i + 1}`}>
              <JsonBlock data={fn} />
            </SubBox>
          )
        }
        const name = typeof f.name === 'string' ? f.name : null
        const desc = typeof f.description === 'string' ? f.description : null
        const preview = desc && desc.length > 0 ? desc.slice(0, 120) : null

        return (
          <SubBox key={i} title={name ?? `function ${i + 1}`} preview={preview}>
            <JsonBlock data={f} />
          </SubBox>
        )
      })}
    </div>
  )
}

// ----------------------------------------------------------------
// Response blocks
// ----------------------------------------------------------------

function ParsedResponseBlocks({
  data,
  baseKey,
  body,
}: {
  data: Record<string, unknown>
  baseKey: string
  body: string
}) {
  const { reasoning, toolCalls, content, isAnthropic, contentText } = useMemo(() => parseResponseData(data), [data])

  const hasAny = reasoning || (toolCalls && toolCalls.length > 0) || contentText

  if (!hasAny) {
    return (
      <CollapsibleSection
        label="raw response"
        icon={<Terminal size={12} strokeWidth={2} />}
        storageKey={`${baseKey}-raw-response-open`}
        defaultOpen
        copyText={body}
      >
        <JsonBlock data={data} />
      </CollapsibleSection>
    )
  }

  return (
    <>
      {reasoning ? (
        <CollapsibleSection
          label="parsed reasoning"
          badge={`(${estimateTextTokens(reasoning).toLocaleString()} tokens)`}
          storageKey={`${baseKey}-reasoning-open`}
          copyText={reasoning}
        >
          <pre className="m-0 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
            {reasoning}
          </pre>
        </CollapsibleSection>
      ) : null}
      {toolCalls && toolCalls.length > 0 ? (
        <CollapsibleSection
          label="parsed tool calls"
          icon={<Wrench size={12} strokeWidth={2} />}
          badge={`(${toolCalls.length} calls)`}
          storageKey={`${baseKey}-tool-calls-open`}
          defaultOpen
          copyText={JSON.stringify(toolCalls, null, 2)}
        >
          <ToolCallsList calls={toolCalls} />
        </CollapsibleSection>
      ) : null}
      {contentText ? (
        <CollapsibleSection
          label="parsed response"
          badge={`(${estimateTextTokens(contentText).toLocaleString()} tokens)`}
          storageKey={`${baseKey}-response-open`}
          defaultOpen
          copyText={isAnthropic ? JSON.stringify(content, null, 2) : contentText}
        >
          {isAnthropic ? (
            <JsonBlock data={content} />
          ) : (
            <pre className="m-0 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words text-fg">
              {contentText}
            </pre>
          )}
        </CollapsibleSection>
      ) : null}
      <CollapsibleSection
        label="raw response"
        icon={<Terminal size={12} strokeWidth={2} />}
        badge={`(${body.length} chars)`}
        storageKey={`${baseKey}-raw-response-open`}
        copyText={body}
      >
        <JsonBlock data={data} />
      </CollapsibleSection>
    </>
  )
}

function parseResponseData(data: Record<string, unknown>): {
  reasoning: string | null
  toolCalls: unknown[] | null
  content: unknown
  contentText: string | null
  isAnthropic: boolean
} {
  // Anthropic format: content[] array at top level
  const contentArr = data.content
  if (Array.isArray(contentArr)) {
    let reasoning: string | null = null
    const toolCalls: unknown[] = []
    const textBlocks: unknown[] = []
    for (const block of contentArr) {
      const b = block as Record<string, unknown> | undefined
      if (!b || typeof b !== 'object') continue
      const type = b.type as string | undefined
      if (type === 'thinking' && typeof b.thinking === 'string') {
        reasoning = (reasoning ?? '') + b.thinking
      } else if (type === 'tool_use') {
        toolCalls.push(b)
      } else if (type === 'text') {
        textBlocks.push(b)
      } else {
        textBlocks.push(b)
      }
    }
    const contentText = textBlocks
      .map((b: unknown) => {
        const block = b as Record<string, unknown> | undefined
        return block && typeof block === 'object' && typeof block.text === 'string' ? block.text : ''
      })
      .join('\n')
    return {
      reasoning,
      toolCalls: toolCalls.length > 0 ? toolCalls : null,
      content: textBlocks.length > 0 ? textBlocks : null,
      contentText: contentText.length > 0 ? contentText : null,
      isAnthropic: true,
    }
  }

  // OpenAI format: choices[].message
  const choices = data.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const msg = (choices[0] as Record<string, unknown>)?.message
    if (msg && typeof msg === 'object') {
      const msgObj = msg as Record<string, unknown>
      const reasoning = typeof msgObj.reasoning_content === 'string' ? msgObj.reasoning_content : null
      const toolCalls = Array.isArray(msgObj.tool_calls) ? msgObj.tool_calls : null
      const content = msgObj.content
      return {
        reasoning: reasoning && reasoning.length > 0 ? reasoning : null,
        toolCalls,
        content,
        contentText: typeof content === 'string' ? content : null,
        isAnthropic: false,
      }
    }
  }

  return { reasoning: null, toolCalls: null, content: null, contentText: null, isAnthropic: false }
}

function ToolCallsList({ calls }: { calls: unknown[] }) {
  return (
    <div className="space-y-1">
      {calls.map((call, i) => {
        const c = call as Record<string, unknown> | undefined
        if (!c || typeof c !== 'object') {
          return (
            <SubBox key={i} title={`call ${i + 1}`}>
              <JsonBlock data={call} />
            </SubBox>
          )
        }
        const name = typeof c.name === 'string' ? c.name : 'unknown'
        const id = typeof c.id === 'string' ? c.id : null
        return (
          <SubBox key={i} title={name} preview={id}>
            <JsonBlock data={c} />
          </SubBox>
        )
      })}
    </div>
  )
}
