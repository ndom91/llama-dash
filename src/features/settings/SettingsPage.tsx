import { Monitor } from 'lucide-react'
import { PageHeader } from '../../components/PageHeader'
import { ThemeToggle } from '../../components/ThemeToggle'
import { TopBar } from '../../components/TopBar'
import { cn } from '../../lib/cn'
import { useColorTheme } from '../../lib/use-color-theme'

function SettingsPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="panel !rounded-none !border-x-0 border-t-1 first:border-t-0 !bg-surface-1">
      <div className="panel-head bg-transparent px-6 max-md:px-4">
        <span className="panel-title">{title}</span>
        <span className="panel-sub">· {subtitle}</span>
      </div>
      <div className="px-6 py-5 max-md:px-4">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const colorTheme = useColorTheme()
  const activeTheme = colorTheme.themes.find((theme) => theme.id === colorTheme.themeId) ?? colorTheme.themes[0]

  return (
    <div className="main-col">
      <TopBar />
      <div className="content">
        <div className="page min-h-full px-0">
          <PageHeader
            kicker="cfg · settings"
            title="Settings"
            subtitle="application preferences and global proxy defaults"
            variant="integrated"
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <SettingsPanel title="Appearance" subtitle="theme and display mode">
              <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
                <div className="flex flex-col flex-1 items-stretch">
                  <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">
                    <Monitor className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                    Active theme
                  </div>
                  <div className="font-mono text-lg font-semibold text-accent">{activeTheme.name}</div>
                  <div className="mt-1 font-mono text-xs text-fg-dim">Accent and semantic status colors.</div>
                  <div className="mt-4 space-y-2 flex-1 flex flex-col justify-end">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">mode</div>
                    <ThemeToggle variant="segmented" />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {colorTheme.themes.map((theme) => {
                    const selected = theme.id === colorTheme.themeId
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        className={cn(
                          'group min-h-20 cursor-pointer rounded border border-border bg-surface-2 p-3 text-left transition-[border-color,background-color,box-shadow] duration-150 hover:border-border-strong hover:bg-surface-3',
                          selected && 'border-accent shadow-[inset_2px_0_0_var(--accent)]',
                        )}
                        onClick={() => colorTheme.select(theme.id)}
                      >
                        <div className="mb-3 flex items-center gap-1.5">
                          {(['300', '500', '700'] as const).map((step) => (
                            <span
                              key={step}
                              className="size-3 rounded-pill border border-border"
                              style={{ background: theme.accent[step] }}
                            />
                          ))}
                        </div>
                        <div className="font-mono text-xs font-semibold text-fg">{theme.name}</div>
                        <div className="mt-1 font-mono text-[10px] text-fg-faint">
                          {selected ? 'selected' : 'available'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel title="Logging & Privacy" subtitle="global proxy capture policy">
              <div className="max-w-3xl font-mono text-xs leading-relaxed text-fg-dim">
                Body capture controls will live here next: global capture mode, max stored body bytes, and future
                redaction rules. Current behavior remains unchanged until those settings are added.
              </div>
            </SettingsPanel>
          </div>
        </div>
      </div>
    </div>
  )
}
