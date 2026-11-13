import { expect, it } from 'vitest'
import { parseCodexExec, parseClaudeTool, parseToolResult, summarizeTool } from './sessionToolSummary'

it('extracts literal exec commands and working directories without executing source', () => {
  expect(parseCodexExec('await tools.exec_command({cmd:"cat AGENTS.md", workdir:"/repo"})')).toEqual([
    { command: 'cat AGENTS.md', workdir: '/repo' },
  ])
  expect(
    parseCodexExec("Promise.allSettled([tools.exec_command({cmd:'ls'}), tools.exec_command({cmd: `git status`})])").map(
      (item) => item.command,
    ),
  ).toEqual(['ls', 'git status'])
  expect(summarizeTool('exec', 'await tools.exec_command({cmd: command})').summary).toBe(
    'await tools.exec_command({cmd: command})',
  )
})

it('summarizes Claude and MCP tool inputs', () => {
  for (const [name, key, value, label] of [
    ['Bash', 'command', 'ls', 'Bash'],
    ['Read', 'file_path', '/tmp/a', 'Read'],
    ['WebFetch', 'url', 'https://example.com', 'WebFetch'],
    ['mcp__linear__search', 'query', 'issue', 'mcp · linear'],
  ])
    expect(parseClaudeTool(name, JSON.stringify({ [key]: value }))).toEqual({ name: label, summary: value })
})

it('unwraps settled results and reports errors without inventing status', () => {
  expect(
    parseToolResult(
      JSON.stringify({
        results: [
          { status: 'fulfilled', value: { output: 'first', exit_code: 0 } },
          { status: 'fulfilled', value: { output: 'second', exit_code: 1 } },
        ],
      }),
    ),
  ).toEqual({ output: 'first\nsecond', exits: [0, 1], status: 1 })
  expect(parseToolResult('[{"type":"text","text":"failed"}]', true)).toEqual({
    output: 'failed',
    exits: [],
    status: 'error',
  })
  expect(parseToolResult('plain output')).toEqual({ output: 'plain output', exits: [], status: null })
})
