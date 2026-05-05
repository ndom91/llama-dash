import {
  COLOR_THEME_COOKIE,
  COLOR_THEME_STORAGE_KEY,
  DEFAULT_THEME_ID,
  DEFAULT_THEME_MODE,
  THEME_MODE_COOKIE,
  THEME_MODE_STORAGE_KEY,
  themes,
  themeStyleVars,
} from './theme'

export const THEME_INIT_SCRIPT = buildThemeInitScript()

function buildThemeInitScript() {
  const validThemeIds = JSON.stringify(themes.map((theme) => theme.id))
  const themeBranches = themes
    .map((theme) => `if(color===${JSON.stringify(theme.id)}){${themeVarsInitScript(theme)}}`)
    .join('else ')

  return `(function(){try{var root=document.documentElement;var s=root.style;var themeCookie=document.cookie.match(/(?:^|; )${COLOR_THEME_COOKIE}=([^;]*)/);var modeCookie=document.cookie.match(/(?:^|; )${THEME_MODE_COOKIE}=([^;]*)/);var color=window.localStorage.getItem('${COLOR_THEME_STORAGE_KEY}')||(themeCookie?decodeURIComponent(themeCookie[1]):'${DEFAULT_THEME_ID}');var valid=${validThemeIds};if(valid.indexOf(color)===-1){color='${DEFAULT_THEME_ID}'}var mode=window.localStorage.getItem('${THEME_MODE_STORAGE_KEY}')||(modeCookie?decodeURIComponent(modeCookie[1]):'${DEFAULT_THEME_MODE}');if(mode!=='light'&&mode!=='dark'&&mode!=='auto'){mode='${DEFAULT_THEME_MODE}'}var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;${themeBranches};window.localStorage.setItem('${COLOR_THEME_STORAGE_KEY}',color);window.localStorage.setItem('${THEME_MODE_STORAGE_KEY}',mode);document.cookie='${COLOR_THEME_COOKIE}='+encodeURIComponent(color)+'; Path=/; Max-Age=31536000; SameSite=Lax';document.cookie='${THEME_MODE_COOKIE}='+encodeURIComponent(mode)+'; Path=/; Max-Age=31536000; SameSite=Lax';}catch(e){}})();`
}

function themeVarsInitScript(theme: (typeof themes)[number]) {
  return Object.entries(themeStyleVars(theme))
    .map(([key, value]) => `s.setProperty(${JSON.stringify(key)},${JSON.stringify(value)});`)
    .join('')
}
