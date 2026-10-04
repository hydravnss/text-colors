/**
 * Text Colors 1.0.0 - extension SillyTavern
 * Change la couleur des TEXTES du chat (jamais les fonds, les bulles ou la mise en page) :
 * texte normal des bots / de « Vous », dialogues, actions (italique), gras, citations, code, liens,
 * noms, horodatage, barre de saisie + placeholder. Surcharges par personnage et par persona.
 *
 * Les règles sont injectées dans <style id="tc-style"> (réinséré en dernier dans <head>) avec !important
 * et une spécificité volontairement très élevée pour l'emporter sur un thème CSS personnalisé
 * (ex. « iMessage Dark ») et sur d'autres extensions (ex. Bubble Colors).
 *
 * Les dialogues sont détectés par un post-traitement DOM léger (spans .tc-quote) : le texte des messages
 * et les données du chat ne sont JAMAIS modifiés.
 *
 * Vanilla ES module, aucune étape de build.
 * Chemin attendu : /scripts/extensions/third-party/text-colors/index.js
 */

import * as stScript from '../../../../script.js';
import * as stExtensions from '../../../extensions.js';

const MODULE_NAME = 'text_colors';
const LOG = '[Text Colors]';
const STYLE_ID = 'tc-style';
const SCHEMA = 1;
const VERSION = '1.0.0';
const MAX_OVERRIDES = 200;

// ---------------------------------------------------------------------------
// Emplacements de couleur
// ---------------------------------------------------------------------------

// split : la couleur peut être distincte pour « Vous » (emplacement `${key}U`)
const COLOR_DEFS = Object.freeze([
    { key: 'botText', group: 'msg', label: 'Texte normal – bots', fallback: '#ffffff', probe: ['bot', ''] },
    { key: 'userText', group: 'msg', label: 'Texte normal – Vous', fallback: '#ffffff', probe: ['user', ''] },
    { key: 'quote', group: 'msg', label: 'Dialogues (« … », "…", “…”)', fallback: '#ffffff', split: true, probe: ['bot', '.tc-quote, q'] },
    { key: 'em', group: 'msg', label: 'Actions / italique (*…*)', fallback: '#919191', split: true, probe: ['bot', 'em, i'] },
    { key: 'strong', group: 'msg', label: 'Gras (**…**)', fallback: '#ffffff', split: true, probe: ['bot', 'strong, b'] },
    { key: 'blockquote', group: 'msg', label: 'Citations (blockquote)', fallback: '#c7c7cc', split: true, probe: ['bot', 'blockquote'] },
    { key: 'code', group: 'msg', label: 'Code', fallback: '#ffd60a', split: true, probe: ['bot', 'code'] },
    { key: 'link', group: 'msg', label: 'Liens', fallback: '#64d2ff', split: true, probe: ['bot', 'a'] },
    { key: 'name', group: 'ui', label: 'Noms des personnages', fallback: '#ffffff', probe: ['name', ''] },
    { key: 'timestamp', group: 'ui', label: 'Horodatage', fallback: '#8e8e93', probe: ['time', ''] },
    { key: 'input', group: 'ui', label: 'Texte de la barre de saisie', fallback: '#ffffff', probe: ['input', ''] },
    { key: 'placeholder', group: 'ui', label: 'Placeholder de la barre de saisie', fallback: '#8e8e93', probe: null },
]);
const DEF_BY_KEY = Object.freeze(Object.fromEntries(COLOR_DEFS.map(d => [d.key, d])));
const SPLIT_KEYS = Object.freeze(COLOR_DEFS.filter(d => d.split).map(d => d.key));
const ALL_SLOTS = Object.freeze(COLOR_DEFS.flatMap(d => (d.split ? [d.key, `${d.key}U`] : [d.key])));

const DEFAULT_BG = Object.freeze({ bot: [38, 38, 40], user: [10, 132, 255], ui: [18, 18, 18] });

// ---------------------------------------------------------------------------
// Préréglages (appliqués en un tap). Valeur : '#rrggbb', '#rrggbb@alpha%' ou [bots, vous].
// ---------------------------------------------------------------------------

const PRESETS = Object.freeze([
    {
        id: 'ios', label: 'Classique iMessage', sw: ['#ffffff', '#919191', '#64d2ff'],
        colors: { botText: '#ffffff', userText: '#ffffff', quote: '#ffffff', em: ['#919191', '#eef5ff'], strong: '#ffffff', blockquote: ['#c7c7cc', '#e5f0ff'], code: ['#ffd60a', '#fff3b0'], link: ['#64d2ff', '#ffffff'], name: '#ffffff', timestamp: '#8e8e93', input: '#ffffff', placeholder: '#8e8e93' },
    },
    {
        id: 'neon', label: 'Néon', sw: ['#00f0ff', '#ff2bd6', '#fff700'],
        colors: { botText: '#e6fbff', userText: '#ffffff', quote: ['#00f0ff', '#ffffff'], em: ['#ff2bd6', '#ffe6fb'], strong: ['#fff700', '#ffffff'], blockquote: ['#7df9ff', '#e6fbff'], code: ['#39ff14', '#ffffff'], link: ['#00f0ff', '#ffffff'], name: '#ff2bd6', timestamp: '#7df9ff@80', input: '#e6fbff', placeholder: '#7df9ff@60' },
        glow: { enabled: true, c: '#00f0ff', size: 6 },
    },
    {
        id: 'pastel', label: 'Pastel', sw: ['#ffc2e2', '#a6d4ff', '#fff3a8'],
        colors: { botText: '#fff5fb', userText: '#ffffff', quote: ['#a6d4ff', '#fff7c4'], em: ['#ffc2e2', '#ffe4f1'], strong: '#fff3a8', blockquote: ['#d9c7ff', '#ffffff'], code: ['#b8f2d0', '#ffffff'], link: ['#a6d4ff', '#ffffff'], name: '#ffc2e2', timestamp: '#c9b8ff', input: '#fff5fb', placeholder: '#c9b8ff@80' },
    },
    {
        id: 'romantique', label: 'Romantique', sw: ['#ff8fb1', '#ffb3c9', '#ff5c8a'],
        colors: { botText: '#ffe4ec', userText: '#fff0f5', quote: ['#ff8fb1', '#ffeaf0'], em: ['#ffb3c9', '#ffe6ef'], strong: ['#ff5c8a', '#ffffff'], blockquote: ['#ffc2d4', '#fff0f5'], code: ['#ffd1dc', '#ffffff'], link: ['#ff8fb1', '#ffffff'], name: '#ff8fb1', timestamp: '#d68aa0', input: '#ffe4ec', placeholder: '#d68aa0' },
    },
    {
        id: 'vampire', label: 'Vampire', sw: ['#ff3b4e', '#e8d5d5', '#b07a7a'],
        colors: { botText: '#e8d5d5', userText: '#fff0f0', quote: ['#ff3b4e', '#ffe3e3'], em: ['#b07a7a', '#ffe6e6'], strong: ['#ff5964', '#ffffff'], blockquote: ['#c9a0a0', '#ffe5e5'], code: ['#ff9a9a', '#ffffff'], link: ['#ff6b6b', '#ffffff'], name: '#ff4d5e', timestamp: '#8f5f5f', input: '#e8d5d5', placeholder: '#8f5f5f' },
        glow: { enabled: true, c: '#ff0022', size: 4 },
    },
    {
        id: 'or-noir', label: 'Or / Noir', sw: ['#ffd700', '#f1e6c8', '#b8a36a'],
        colors: { botText: '#f1e6c8', userText: '#ffffff', quote: ['#ffd700', '#fff6c8'], em: ['#b8a36a', '#fff1c1'], strong: ['#ffcc33', '#ffffff'], blockquote: ['#d9c58a', '#fff7d6'], code: ['#e6c35c', '#ffffff'], link: ['#ffd700', '#ffffff'], name: '#ffd700', timestamp: '#9c8a55', input: '#f1e6c8', placeholder: '#9c8a55' },
        gradient: { enabled: true, c1: '#ffb800', c2: '#fff1a8', angle: 90 },
    },
    {
        id: 'ocean', label: 'Océan', sw: ['#4dd9ff', '#7df0d8', '#5ec8ff'],
        colors: { botText: '#d6f3ff', userText: '#ffffff', quote: ['#4dd9ff', '#ffffff'], em: ['#8fd3e8', '#e0f6ff'], strong: ['#7df0d8', '#ffffff'], blockquote: ['#a8e6ff', '#e0f6ff'], code: ['#9ef0e0', '#ffffff'], link: ['#5ec8ff', '#ffffff'], name: '#4dd9ff', timestamp: '#6fa8bd', input: '#d6f3ff', placeholder: '#6fa8bd' },
    },
    {
        id: 'foret', label: 'Forêt', sw: ['#8be28b', '#c8f27a', '#a8c99a'],
        colors: { botText: '#e1f5df', userText: '#ffffff', quote: ['#8be28b', '#eaffea'], em: ['#a8c99a', '#e6f7de'], strong: ['#c8f27a', '#ffffff'], blockquote: ['#b5d9a8', '#f0ffe8'], code: ['#d9f0a0', '#ffffff'], link: ['#7ad9a0', '#ffffff'], name: '#8be28b', timestamp: '#7b9a6e', input: '#e1f5df', placeholder: '#7b9a6e' },
    },
    {
        id: 'monochrome', label: 'Monochrome', sw: ['#ffffff', '#aeaeb2', '#636366'],
        colors: { botText: '#f2f2f7', userText: '#ffffff', quote: '#ffffff', em: ['#aeaeb2', '#f2f2f7'], strong: '#ffffff', blockquote: ['#d1d1d6', '#f2f2f7'], code: ['#e5e5ea', '#ffffff'], link: ['#d1d1d6', '#ffffff'], name: '#f2f2f7', timestamp: '#8e8e93', input: '#f2f2f7', placeholder: '#8e8e93' },
    },
    {
        id: 'daltonien', label: 'Daltonien-friendly (Okabe-Ito)', sw: ['#f0e442', '#56b4e9', '#e69f00'],
        colors: { botText: '#f5f5f5', userText: '#ffffff', quote: ['#f0e442', '#fff9a8'], em: ['#56b4e9', '#e6f4ff'], strong: ['#e69f00', '#ffffff'], blockquote: ['#cc79a7', '#ffe6f2'], code: ['#e69f00', '#ffffff'], link: ['#56b4e9', '#ffffff'], name: '#f0e442', timestamp: '#a0a0a0', input: '#f5f5f5', placeholder: '#a0a0a0' },
    },
    {
        id: 'contraste', label: 'Contraste élevé', sw: ['#ffffff', '#ffff00', '#00ffff'],
        colors: { botText: '#ffffff', userText: '#ffffff', quote: ['#ffff00', '#ffffff'], em: ['#00ffff', '#ffffff'], strong: '#ffffff', blockquote: '#ffffff', code: ['#ffff00', '#ffffff'], link: ['#00ffff', '#ffffff'], name: '#ffff00', timestamp: '#ffffff', input: '#ffffff', placeholder: '#d0d0d0' },
    },
    {
        id: 'sunset', label: 'Coucher de soleil', sw: ['#ff9a44', '#ff7aa8', '#ffb347'],
        colors: { botText: '#ffe9d6', userText: '#ffffff', quote: ['#ff9a44', '#fff0d6'], em: ['#ff7aa8', '#ffeaf2'], strong: ['#ffb347', '#ffffff'], blockquote: ['#ffc08a', '#fff0e0'], code: ['#ffd29a', '#ffffff'], link: ['#ff7aa8', '#ffffff'], name: '#ff9a44', timestamp: '#b0805f', input: '#ffe9d6', placeholder: '#b0805f' },
        gradient: { enabled: true, c1: '#ff9a44', c2: '#ff5c9a', angle: 90 },
    },
]);

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function normalizeHex(v) {
    if (typeof v !== 'string') return '';
    let t = v.trim().toLowerCase();
    if (t[0] !== '#') t = `#${t}`;
    if (/^#[0-9a-f]{3}$/.test(t)) t = `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
    return /^#[0-9a-f]{6}$/.test(t) ? t : '';
}

function cleanSlot(o) {
    const src = o && typeof o === 'object' ? o : {};
    const a = Number(src.a);
    return { c: normalizeHex(src.c), a: Number.isFinite(a) ? clamp(Math.round(a), 0, 100) : 100 };
}

function emptyColors() {
    const colors = {};
    for (const k of ALL_SLOTS) colors[k] = { c: '', a: 100 };
    return colors;
}

function defaultSettings() {
    return {
        schema: SCHEMA,
        enabled: true,
        wrapQuotes: true,
        colors: emptyColors(),
        split: Object.fromEntries(SPLIT_KEYS.map(k => [k, false])),
        gradient: { enabled: false, c1: '#ffd700', c2: '#ff7a00', angle: 90 },
        glow: { enabled: false, c: '#00f0ff', size: 6 },
        autoContrast: false,
        minRatio: 4.5,
        overrides: [],
    };
}

function cleanName(v) {
    return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120) : '';
}

/** Valide / complète un objet de réglages (également utilisé pour l'import JSON). Ne lève jamais. */
function normalizeSettings(raw) {
    const s = defaultSettings();
    const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    s.enabled = src.enabled !== false;
    s.wrapQuotes = src.wrapQuotes !== false;
    s.autoContrast = src.autoContrast === true;
    const mr = Number(src.minRatio);
    s.minRatio = Number.isFinite(mr) ? clamp(mr, 1.5, 12) : 4.5;
    const sc = src.colors && typeof src.colors === 'object' ? src.colors : {};
    for (const k of ALL_SLOTS) s.colors[k] = cleanSlot(Object.prototype.hasOwnProperty.call(sc, k) ? sc[k] : null);
    const sp = src.split && typeof src.split === 'object' ? src.split : {};
    for (const k of SPLIT_KEYS) s.split[k] = sp[k] === true;
    const g = src.gradient && typeof src.gradient === 'object' ? src.gradient : {};
    s.gradient = {
        enabled: g.enabled === true,
        c1: normalizeHex(g.c1) || '#ffd700',
        c2: normalizeHex(g.c2) || '#ff7a00',
        angle: Number.isFinite(Number(g.angle)) ? clamp(Math.round(Number(g.angle)), 0, 360) : 90,
    };
    const gl = src.glow && typeof src.glow === 'object' ? src.glow : {};
    s.glow = {
        enabled: gl.enabled === true,
        c: normalizeHex(gl.c) || '#00f0ff',
        size: Number.isFinite(Number(gl.size)) ? clamp(Math.round(Number(gl.size)), 1, 24) : 6,
    };
    s.overrides = [];
    if (Array.isArray(src.overrides)) {
        for (const o of src.overrides) {
            if (!o || typeof o !== 'object') continue;
            const name = cleanName(o.name);
            const kind = o.kind === 'persona' ? 'persona' : 'char';
            if (!name || s.overrides.some(x => x.kind === kind && x.name === name)) continue;
            s.overrides.push({ kind, name, text: cleanSlot(o.text), quote: cleanSlot(o.quote) });
            if (s.overrides.length >= MAX_OVERRIDES) break;
        }
    }
    s.schema = SCHEMA;
    return s;
}

let settings = null;

function loadSettings() {
    const store = stExtensions.extension_settings;
    settings = normalizeSettings(store[MODULE_NAME]);
    store[MODULE_NAME] = settings;
    return settings;
}

function saveSettings() {
    try {
        stExtensions.extension_settings[MODULE_NAME] = settings;
        stScript.saveSettingsDebounced();
    } catch (e) {
        console.warn(LOG, 'saveSettingsDebounced a échoué', e);
    }
}

// ---------------------------------------------------------------------------
// Couleurs / contraste
// ---------------------------------------------------------------------------

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (rgb) => `#${rgb.slice(0, 3).map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const luminance = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
function contrastRatio(a, b) {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const blend = (fg, alpha, bg) => fg.map((v, i) => v * alpha + bg[i] * (1 - alpha));

function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h /= 6;
    }
    return [h, s, l];
}
function hslToRgb([h, s, l]) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Ratio de contraste réel d'une couleur (avec alpha %) sur un fond [r,g,b]. */
function ratioOn(hex, alphaPct, bg) {
    const fg = blend(hexToRgb(hex), clamp(alphaPct, 0, 100) / 100, bg);
    return contrastRatio(fg, bg);
}

/** Éclaircit ou assombrit (teinte conservée) jusqu'au ratio cible ; renvoie le hex ajusté. */
function adjustForContrast(hex, alphaPct, bg, target) {
    if (ratioOn(hex, alphaPct, bg) >= target) return hex;
    const hsl = rgbToHsl(hexToRgb(hex));
    const tryDir = (dir) => {
        let l = hsl[2];
        let best = { hex, ratio: ratioOn(hex, alphaPct, bg), l };
        for (let i = 0; i < 100; i++) {
            l = clamp(l + dir * 0.01, 0, 1);
            const h2 = rgbToHex(hslToRgb([hsl[0], hsl[1], l]));
            best = { hex: h2, ratio: ratioOn(h2, alphaPct, bg), l };
            if (best.ratio >= target || l === 0 || l === 1) break;
        }
        return best;
    };
    const up = tryDir(1);
    const down = tryDir(-1);
    const okUp = up.ratio >= target;
    const okDown = down.ratio >= target;
    if (okUp && okDown) return Math.abs(up.l - hsl[2]) <= Math.abs(down.l - hsl[2]) ? up.hex : down.hex;
    if (okUp) return up.hex;
    if (okDown) return down.hex;
    return up.ratio >= down.ratio ? up.hex : down.hex;
}

function parseCssColor(str) {
    const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/i.exec(String(str || ''));
    if (!m) return null;
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [+m[1], +m[2], +m[3], Number.isFinite(a) ? a : 1];
}

/** Fond réel d'un élément : couleurs (ou moyenne d'un dégradé) composées vers le haut jusqu'à un fond opaque. */
function effectiveBg(el, fallback) {
    try {
        const layers = [];
        let n = el;
        let opaque = false;
        while (n && n.nodeType === 1) {
            const cs = getComputedStyle(n);
            let c = parseCssColor(cs.backgroundColor);
            if (cs.backgroundImage && cs.backgroundImage !== 'none') {
                const cols = [...cs.backgroundImage.matchAll(/rgba?\([^)]*\)/g)].map(m => parseCssColor(m[0])).filter(Boolean);
                if (cols.length) c = [0, 1, 2, 3].map(i => cols.reduce((t, x) => t + x[i], 0) / cols.length);
            }
            if (c && c[3] > 0.01) {
                layers.push(c);
                if (c[3] >= 0.99) { opaque = true; break; }
            }
            n = n.parentElement;
        }
        let base = opaque ? layers.pop().slice(0, 3) : (fallback || DEFAULT_BG.ui).slice();
        for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i].slice(0, 3), layers[i][3], base);
        return base.map(v => Math.round(v));
    } catch {
        return (fallback || DEFAULT_BG.ui).slice();
    }
}

let bgs = { bot: DEFAULT_BG.bot.slice(), user: DEFAULT_BG.user.slice(), ui: DEFAULT_BG.ui.slice(), name: DEFAULT_BG.ui.slice(), input: DEFAULT_BG.ui.slice() };

/** Mesure les fonds réels des bulles (lecture seule : jamais modifiés par l'extension). */
function measureBgs() {
    const next = { bot: DEFAULT_BG.bot.slice(), user: DEFAULT_BG.user.slice(), ui: DEFAULT_BG.ui.slice(), name: DEFAULT_BG.ui.slice(), input: DEFAULT_BG.ui.slice() };
    try {
        const bot = document.querySelector('#chat .mes[is_user="false"] .mes_text');
        const user = document.querySelector('#chat .mes[is_user="true"] .mes_text');
        const chat = document.getElementById('chat');
        next.ui = effectiveBg(chat || document.body, DEFAULT_BG.ui);
        if (bot) next.bot = effectiveBg(bot, next.ui);
        if (user) next.user = effectiveBg(user, next.ui);
        const anyMes = document.querySelector('#chat .mes');
        next.name = anyMes ? effectiveBg(anyMes, next.ui) : next.ui;
        const ta = document.getElementById('send_textarea');
        next.input = ta ? effectiveBg(ta, next.ui) : next.ui;
    } catch (e) {
        console.warn(LOG, 'Mesure des fonds impossible', e);
    }
    bgs = next;
}

function measureBgsChanged() {
    const before = JSON.stringify(bgs);
    measureBgs();
    return before !== JSON.stringify(bgs);
}

const bgForSlot = (key, role) => {
    if (key === 'name' || key === 'timestamp') return bgs.name;
    if (key === 'input' || key === 'placeholder') return bgs.input;
    return role === 'user' ? bgs.user : bgs.bot;
};

// ---------------------------------------------------------------------------
// Génération du CSS
// ---------------------------------------------------------------------------

const cssStr = (v) => String(v).replace(/[\\"]/g, m => `\\${m}`).replace(/[\r\n\f]/g, ' ').replace(/</g, '\\3c ');

function rgbaCss(hex, alphaPct) {
    if (alphaPct >= 100) return hex;
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${+(alphaPct / 100).toFixed(2)})`;
}

/** Sélecteurs « réels » : spécificité très élevée (doit battre un thème et Bubble Colors). */
function realScopes() {
    const base = (isUser, extra = '') => `html body #chat .mes.mes.mes[is_user="${isUser}"]${extra}:not(.tc-x1):not(.tc-x2) .mes_text`;
    return {
        bot: base('false'),
        user: base('true'),
        withAttr: (role, name) => base(role === 'user' ? 'true' : 'false', `[ch_name="${cssStr(name)}"]`),
        name: 'html body #chat .mes.mes.mes:not(.tc-x1) .ch_name .name_text',
        time: 'html body #chat .mes.mes.mes:not(.tc-x1) .ch_name .timestamp',
        input: 'html body #send_textarea#send_textarea',
        ph: 'html body #send_textarea#send_textarea::placeholder',
    };
}
function previewScopes() {
    return {
        bot: '#tc_preview .tc-pv-bot',
        user: '#tc_preview .tc-pv-user',
        name: '#tc_preview .tc-pv-name',
        time: '#tc_preview .tc-pv-time',
        input: '#tc_preview .tc-pv-input',
        ph: '#tc_preview .tc-pv-input::placeholder',
    };
}

function slotValue(s, key, role) {
    const def = DEF_BY_KEY[key];
    const slot = def && def.split && role === 'user' && s.split[key] ? `${key}U` : key;
    return s.colors[slot];
}

/** Couleur CSS finale d'un emplacement (ajustement automatique du contraste si activé). */
function finalColor(s, o, bg) {
    if (!o || !o.c) return null;
    let hex = o.c;
    if (s.autoContrast && bg) hex = adjustForContrast(hex, o.a, bg, s.minRatio);
    return rgbaCss(hex, o.a);
}

function effectsDecls(s) {
    const out = [];
    if (s.gradient.enabled) {
        out.push(`background-image: linear-gradient(${s.gradient.angle}deg, ${s.gradient.c1}, ${s.gradient.c2}) !important`);
        out.push('-webkit-background-clip: text !important', 'background-clip: text !important');
        out.push('-webkit-text-fill-color: transparent !important');
        out.push('-webkit-box-decoration-break: clone !important', 'box-decoration-break: clone !important');
    }
    if (s.glow.enabled) {
        const n = s.glow.size;
        if (s.gradient.enabled) out.push(`filter: drop-shadow(0 0 ${n}px ${s.glow.c}) !important`);
        else out.push(`text-shadow: 0 0 ${n}px ${s.glow.c}, 0 0 ${Math.max(1, Math.round(n / 2))}px ${s.glow.c} !important`);
    }
    return out;
}

function buildCss(s, scopes, withOverrides) {
    const out = [];
    const rule = (sel, decls) => { if (decls.length) out.push(`${sel} {\n  ${decls.join(';\n  ')};\n}`); };
    const col = (c) => [`color: ${c} !important`];

    for (const role of ['bot', 'user']) {
        const S = scopes[role];
        const bg = bgs[role];
        const text = finalColor(s, s.colors[`${role}Text`], bg);
        if (text) rule(`${S},\n${S} p,\n${S} li`, col(text));
        const em = finalColor(s, slotValue(s, 'em', role), bg);
        if (em) rule(`${S} em,\n${S} i`, col(em));
        const strong = finalColor(s, slotValue(s, 'strong', role), bg);
        if (strong) rule(`${S} strong,\n${S} b`, col(strong));
        const bq = finalColor(s, slotValue(s, 'blockquote', role), bg);
        if (bq) rule(`${S} blockquote,\n${S} blockquote p,\n${S} blockquote li`, col(bq));
        const code = finalColor(s, slotValue(s, 'code', role), bg);
        if (code) rule(`${S} code,\n${S} pre,\n${S} pre code`, col(code));
        const link = finalColor(s, slotValue(s, 'link', role), bg);
        if (link) rule(`${S} a,\n${S} a:link,\n${S} a:visited`, col(link));
        const quote = finalColor(s, slotValue(s, 'quote', role), bg);
        const qd = [...(quote ? col(quote) : []), ...effectsDecls(s)];
        if (qd.length) rule(`${S} q,\n${S} .tc-quote`, qd);
    }

    const name = finalColor(s, s.colors.name, bgs.name);
    if (name) rule(scopes.name, col(name));
    const time = finalColor(s, s.colors.timestamp, bgs.name);
    if (time) rule(scopes.time, col(time));
    const inp = finalColor(s, s.colors.input, bgs.input);
    if (inp) rule(scopes.input, col(inp));
    const ph = finalColor(s, s.colors.placeholder, bgs.input);
    if (ph) rule(scopes.ph, col(ph));

    if (withOverrides && typeof scopes.withAttr === 'function') {
        for (const o of s.overrides) {
            const role = o.kind === 'persona' ? 'user' : 'bot';
            const S = scopes.withAttr(role, o.name);
            const bg = bgs[role];
            const text = finalColor(s, o.text, bg);
            if (text) rule(`${S},\n${S} p:not(blockquote p),\n${S} li:not(blockquote li)`, col(text));
            const quote = finalColor(s, o.quote, bg);
            if (quote) {
                const d = col(quote);
                if (s.gradient.enabled) d.push(`-webkit-text-fill-color: ${quote} !important`, 'background-image: none !important');
                rule(`${S} q,\n${S} .tc-quote`, d);
            }
        }
    }
    return out.join('\n');
}

function buildAllCss(s) {
    const parts = [];
    if (s.enabled) parts.push(buildCss(s, realScopes(), true));
    parts.push(buildCss(s, previewScopes(), false));
    return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Injection du <style> (dernier de <head>)
// ---------------------------------------------------------------------------

let headObserver = null;
let reappendTimer = null;
let headTimer = null;
let applyRaf = 0;
const rivals = new WeakSet(); // éléments <style> qui se replacent eux-mêmes en dernier (ex. Bubble Colors) : on ne se bat pas avec eux
let lastDisplacer = null;
let lastMoveAt = 0;

function ensureStyleEl() {
    if (typeof document === 'undefined') return null;
    let el = document.getElementById(STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
    }
    if (document.head && document.head.lastElementChild !== el && (!el.isConnected || !rivals.has(document.head.lastElementChild))) document.head.appendChild(el);
    return el;
}

function applyStyle() {
    try {
        const el = ensureStyleEl();
        if (!el) return;
        measureBgs();
        const css = buildAllCss(settings);
        if (el.textContent !== css) el.textContent = css;
        panelRefresh();
    } catch (e) {
        console.error(LOG, 'applyStyle a échoué', e);
    }
}

function scheduleApply() {
    if (applyRaf) return;
    applyRaf = requestAnimationFrame(() => { applyRaf = 0; applyStyle(); });
}

function reappendNow() {
    reappendTimer = null;
    const el = document.getElementById(STYLE_ID);
    const last = document.head.lastElementChild;
    if (!el || !last || last === el || rivals.has(last)) return;
    const now = Date.now();
    // Même élément qui nous déplace deux fois de suite en peu de temps => c'est un « gardien » qui se replace aussi en dernier
    // (ex. Bubble Colors). Deux gardiens se renverraient la place indéfiniment (recalculs de style en boucle) : on cède.
    // Nos règles gagnent de toute façon grâce à leur spécificité très élevée + !important.
    if (last === lastDisplacer && now - lastMoveAt < 3000) {
        rivals.add(last);
        console.info(LOG, `<style id="${last.id || '?'}"> se replace aussi en dernier dans <head> : je cesse de me replacer derrière lui (priorité assurée par la spécificité).`);
        return;
    }
    lastDisplacer = last;
    lastMoveAt = now;
    document.head.appendChild(el);
}

function watchHead() {
    try {
        if (headObserver || typeof MutationObserver === 'undefined' || !document.head) return;
        headObserver = new MutationObserver((records) => {
            try {
                const el = document.getElementById(STYLE_ID);
                const foreign = records.some(r => !(el && (r.target === el || el.contains(r.target))));
                if (!foreign) return;
                if (el && document.head.lastElementChild !== el && !rivals.has(document.head.lastElementChild) && !reappendTimer) reappendTimer = setTimeout(reappendNow, 60);
                // Un autre style a changé (ex. Bubble Colors) : les fonds mesurés ont pu bouger.
                if (!headTimer) {
                    headTimer = setTimeout(() => {
                        headTimer = null;
                        if (measureBgsChanged()) scheduleApply();
                    }, 250);
                }
            } catch { /* ignore */ }
        });
        headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
    } catch (e) {
        console.warn(LOG, 'Observation de <head> impossible', e);
    }
}

// ---------------------------------------------------------------------------
// Post-traitement DOM des dialogues  (<span class="tc-quote">)
// ---------------------------------------------------------------------------

const QUOTE_PAIRS = Object.freeze({ '"': '"', '«': '»', '“': '”', '„': '“', '「': '」', '『': '』', '＂': '＂' });
const MAX_QUOTE_LEN = 1500;
const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'HR', 'DETAILS', 'SUMMARY', 'SECTION', 'ARTICLE', 'FIGURE', 'DL', 'DT', 'DD']);
const SKIP_TAGS = new Set(['CODE', 'PRE', 'A', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'BUTTON', 'SELECT', 'Q', 'SVG', 'NOSCRIPT', 'KBD', 'SAMP', 'IMG', 'VIDEO', 'AUDIO', 'IFRAME']);
const QUOTE_CHARS = /["«»“”„「」『』＂]/;

/** Plages [début, fin[ des dialogues dans un texte. Les guillemets droits s'apparient dans l'ordre. */
function scanQuotes(text) {
    const ranges = [];
    let open = -1;
    let closer = '';
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (open < 0) {
            if (Object.prototype.hasOwnProperty.call(QUOTE_PAIRS, ch)) { open = i; closer = QUOTE_PAIRS[ch]; }
        } else if (ch === closer) {
            ranges.push([open, i + 1]);
            open = -1;
        } else if (i - open > MAX_QUOTE_LEN) {
            i = open;
            open = -1;
        }
    }
    return ranges;
}

/** Regroupe les nœuds texte par « ligne » (coupures aux <br> et aux blocs) ; ignore code, liens, spans déjà posés. */
function collectGroups(root) {
    const groups = [];
    let cur = null;
    const walk = (node) => {
        for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
            if (ch.nodeType === 3) {
                if (!ch.nodeValue) continue;
                if (!cur) { cur = { nodes: [], text: '' }; groups.push(cur); }
                cur.nodes.push(ch);
            } else if (ch.nodeType === 1) {
                const tag = ch.tagName;
                if (tag === 'BR') { cur = null; continue; }
                if (SKIP_TAGS.has(tag) || (ch.classList && ch.classList.contains('tc-quote'))) continue;
                const block = BLOCK_TAGS.has(tag);
                if (block) cur = null;
                walk(ch);
                if (block) cur = null;
            }
        }
    };
    walk(root);
    for (const g of groups) g.text = g.nodes.map(n => n.nodeValue).join('');
    return groups;
}

function wrapSegment(node, a, b) {
    let mid = node;
    if (a > 0) mid = node.splitText(a);
    if (b - a < mid.nodeValue.length) mid.splitText(b - a);
    const span = document.createElement('span');
    span.className = 'tc-quote';
    mid.parentNode.insertBefore(span, mid);
    span.appendChild(mid);
}

function unwrapQuotes(root) {
    const spans = root.querySelectorAll('span.tc-quote');
    if (!spans.length) return 0;
    const parents = new Set();
    for (const sp of spans) {
        const p = sp.parentNode;
        if (!p) continue;
        while (sp.firstChild) p.insertBefore(sp.firstChild, sp);
        p.removeChild(sp);
        parents.add(p);
    }
    for (const p of parents) p.normalize();
    return spans.length;
}

/** Enveloppe les dialogues d'un .mes_text (idempotent : déroule puis ré-enveloppe ; DOM uniquement). */
function processMesText(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.querySelector('textarea, .edit_textarea')) return; // mode édition : on ne touche à rien
    if (!settings.enabled || !settings.wrapQuotes) { unwrapQuotes(root); return; }
    if (!root.querySelector('.tc-quote') && !QUOTE_CHARS.test(root.textContent)) return;
    try {
        const sel = window.getSelection && window.getSelection();
        if (sel && !sel.isCollapsed && sel.anchorNode && root.contains(sel.anchorNode)) {
            setTimeout(() => queueProcess(root), 1500); // sélection en cours (copier sur iOS) : on retente plus tard
            return;
        }
    } catch { /* ignore */ }
    unwrapQuotes(root);
    for (const g of collectGroups(root)) {
        const ranges = scanQuotes(g.text);
        if (!ranges.length) continue;
        const starts = [];
        let acc = 0;
        for (const n of g.nodes) { starts.push(acc); acc += n.nodeValue.length; }
        const perNode = new Map();
        for (const [rs, re] of ranges) {
            for (let i = 0; i < g.nodes.length; i++) {
                const ns = starts[i];
                const ne = ns + g.nodes[i].nodeValue.length;
                const a = Math.max(rs, ns);
                const b = Math.min(re, ne);
                if (b > a) {
                    if (!perNode.has(g.nodes[i])) perNode.set(g.nodes[i], []);
                    perNode.get(g.nodes[i]).push([a - ns, b - ns]);
                }
            }
        }
        // Plusieurs plages dans un même nœud : de la fin vers le début pour conserver les offsets.
        for (const [node, segs] of perNode) {
            segs.sort((x, y) => y[0] - x[0]);
            for (const [a, b] of segs) wrapSegment(node, a, b);
        }
    }
}

let mo = null;
const pendingEls = new Set();
let flushTimer = 0;

function takeOwnRecords() {
    try { if (mo) mo.takeRecords(); } catch { /* ignore */ }
}

function flushPending() {
    flushTimer = 0;
    const els = [...pendingEls];
    pendingEls.clear();
    const run = (list) => {
        for (const el of list) {
            try { if (el.isConnected) processMesText(el); } catch (e) { console.warn(LOG, 'Traitement des dialogues échoué', e); }
        }
        takeOwnRecords();
    };
    if (els.length <= 6) { run(els); return; }
    // Beaucoup de messages (ouverture d'un chat) : par lots pour ne pas bloquer l'interface. Les plus récents d'abord.
    const list = els.reverse();
    const step = () => {
        run(list.splice(0, 12));
        if (list.length) setTimeout(step, 0);
    };
    step();
}

function queueProcess(el) {
    pendingEls.add(el);
    if (!flushTimer) flushTimer = setTimeout(flushPending, 0);
}

function processAll() {
    document.querySelectorAll('#chat .mes_text').forEach(queueProcess);
}

function mesTextOf(node) {
    const el = node && node.nodeType === 1 ? node : node && node.parentElement;
    return el && el.closest ? el.closest('.mes_text') : null;
}

function startObserver() {
    try {
        if (mo || typeof MutationObserver === 'undefined') return;
        const chat = document.getElementById('chat');
        if (!chat) { setTimeout(startObserver, 500); return; }
        mo = new MutationObserver((records) => {
            try {
                const touched = new Set();
                for (const r of records) {
                    const own = mesTextOf(r.target);
                    if (own) touched.add(own);
                    if (r.type === 'childList' && !own) {
                        for (const n of r.addedNodes) {
                            if (n.nodeType !== 1) continue;
                            if (n.classList && n.classList.contains('mes_text')) touched.add(n);
                            else if (n.querySelectorAll) n.querySelectorAll('.mes_text').forEach(x => touched.add(x));
                        }
                    }
                }
                if (!touched.size) return;
                // Petits lots : traitement immédiat (micro-tâche, avant le rendu) => pas de scintillement en streaming.
                if (touched.size <= 6) {
                    for (const el of touched) {
                        try { processMesText(el); } catch (e) { console.warn(LOG, e); }
                    }
                    takeOwnRecords();
                } else {
                    touched.forEach(queueProcess);
                }
            } catch (e) { console.warn(LOG, e); }
        });
        mo.observe(chat, { childList: true, subtree: true, characterData: true });
        processAll();
    } catch (e) {
        console.warn(LOG, 'Observation du chat impossible', e);
    }
}

// ---------------------------------------------------------------------------
// Personnages / persona du chat courant
// ---------------------------------------------------------------------------

function getCandidates() {
    const list = [];
    const add = (kind, name) => {
        name = cleanName(name);
        if (name && !list.some(x => x.kind === kind && x.name === name)) list.push({ kind, name });
    };
    try {
        const ctx = stExtensions.getContext();
        const chars = Array.isArray(ctx.characters) ? ctx.characters : [];
        if (ctx.groupId) {
            const group = (ctx.groups || []).find(g => String(g.id) === String(ctx.groupId));
            for (const av of (group?.members || [])) {
                const c = chars.find(x => x.avatar === av);
                add('char', c ? c.name : String(av).replace(/\.[a-z0-9]+$/i, ''));
            }
        } else if (ctx.characterId !== undefined && ctx.characterId !== null && chars[ctx.characterId]) {
            add('char', chars[ctx.characterId].name);
        }
        add('persona', ctx.name1);
    } catch (e) {
        console.warn(LOG, 'Lecture du contexte impossible', e);
    }
    return list;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

const rows = new Set(); // lignes de couleur actives (rafraîchies quand les fonds changent)
let panelCtl = null;

function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
        if (v === false || v === null || v === undefined) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return el;
}

function notify(kind, msg) {
    try {
        if (globalThis.toastr && globalThis.toastr[kind]) globalThis.toastr[kind](msg, 'Text Colors');
        else console.log(LOG, msg);
    } catch { /* ignore */ }
}

function commit(opts = {}) {
    saveSettings();
    applyStyle();
    if (opts.reprocess) processAll();
}

/** Couleur actuelle du thème pour un emplacement hérité (sert de valeur de départ du sélecteur). */
function probeHex(def) {
    try {
        if (def.probe) {
            const [where, sub] = def.probe;
            let el = null;
            if (where === 'bot' || where === 'user') {
                const base = document.querySelector(`#chat .mes[is_user="${where === 'user'}"] .mes_text`);
                el = base ? (sub ? base.querySelector(sub) : base) : null;
            } else if (where === 'name') el = document.querySelector('#chat .mes .ch_name .name_text');
            else if (where === 'time') el = document.querySelector('#chat .mes .ch_name .timestamp');
            else if (where === 'input') el = document.getElementById('send_textarea');
            if (el) {
                const c = parseCssColor(getComputedStyle(el).color);
                if (c) return rgbToHex(c);
            }
        }
    } catch { /* ignore */ }
    return def.fallback;
}

/**
 * Ligne de réglage d'une couleur : sélecteur + hex + alpha + « hérité du thème » + indicateur de contraste.
 * get() renvoie l'objet vivant {c, a} ; contrast() renvoie [{key, role}] (fonds à comparer).
 */
function makeColorRow({ label, get, def, contrast }) {
    const picker = h('input', { type: 'color', class: 'tc-picker', 'aria-label': `${label} : sélecteur de couleur` });
    const hex = h('input', { type: 'text', class: 'text_pole tc-hex', maxlength: 7, placeholder: 'hérité', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': `${label} : code hexadécimal` });
    const alpha = h('input', { type: 'range', class: 'tc-alpha', min: 0, max: 100, step: 1, 'aria-label': `${label} : opacité` });
    const alphaVal = h('span', { class: 'tc-alpha-val' });
    const reset = h('button', { type: 'button', class: 'menu_button tc-reset', title: 'Revenir à la couleur du thème' }, 'Hérité du thème');
    const info = h('div', { class: 'tc-info' });
    const root = h('div', { class: 'tc-row' },
        h('div', { class: 'tc-row-label', text: label }),
        h('div', { class: 'tc-row-ctl' }, picker, hex, alpha, alphaVal, reset),
        info);

    const update = () => {
        const o = get();
        const inherited = !o.c;
        picker.value = o.c || probeHex(def);
        if (document.activeElement !== hex) hex.value = o.c;
        alpha.value = String(o.a);
        alphaVal.textContent = `${o.a}%`;
        root.classList.toggle('tc-inherited', inherited);
        reset.disabled = inherited;
        info.className = 'tc-info';
        if (inherited) { info.textContent = 'Couleur du thème (inchangée)'; return; }
        const infos = (contrast ? contrast() : []).map(({ key, role }) => ({ r: ratioOn(o.c, o.a, bgForSlot(key, role)) }));
        if (!infos.length) { info.textContent = 'Personnalisée'; return; }
        const worst = infos.reduce((m, x) => (x.r < m.r ? x : m), infos[0]);
        if (worst.r < settings.minRatio) {
            info.classList.add('tc-warn');
            info.textContent = settings.autoContrast
                ? `⚠ Contraste faible (${worst.r.toFixed(1)}:1) : ajusté automatiquement`
                : `⚠ Contraste faible (${worst.r.toFixed(1)}:1 sur ${infos.length > 1 ? 'une des bulles' : 'la bulle'})`;
        } else {
            info.classList.add('tc-good');
            info.textContent = `Contraste OK (${worst.r.toFixed(1)}:1)`;
        }
    };
    picker.addEventListener('input', () => { get().c = normalizeHex(picker.value); commit(); });
    hex.addEventListener('input', () => {
        const v = hex.value.trim();
        if (v === '') { get().c = ''; commit(); return; }
        const n = normalizeHex(v);
        const okLen = v[0] === '#' ? (v.length === 7 || v.length === 4) : (v.length === 6 || v.length === 3);
        if (n && okLen) { get().c = n; commit(); }
    });
    hex.addEventListener('change', () => { hex.value = get().c; });
    alpha.addEventListener('input', () => { get().a = clamp(parseInt(alpha.value, 10) || 0, 0, 100); commit(); });
    reset.addEventListener('click', () => { const o = get(); o.c = ''; o.a = 100; commit(); });
    root.__update = update;
    rows.add(root);
    update();
    return root;
}

function panelRefresh() {
    for (const r of [...rows]) {
        try { r.__update(); } catch { /* ignore */ }
    }
    updatePreviewBg();
    const t = document.getElementById('tc_toggle_hint');
    if (t) t.textContent = settings.enabled ? 'Extension active : les couleurs priment sur votre thème.' : 'Extension désactivée : le thème s\'applique tel quel.';
}

function updatePreviewBg() {
    const pv = document.getElementById('tc_preview');
    if (!pv) return;
    const css = (c) => `rgb(${c.join(',')})`;
    const bot = pv.querySelector('.tc-pv-bot');
    const user = pv.querySelector('.tc-pv-user');
    const inp = pv.querySelector('.tc-pv-input');
    if (bot) bot.style.background = css(bgs.bot);
    if (user) user.style.background = css(bgs.user);
    if (inp) inp.style.background = css(bgs.input);
    pv.style.background = css(bgs.ui);
}

function previewHtml() {
    const msg = (cls, who, body) => `
      <div class="tc-pv-msg tc-pv-msg-${cls}">
        <div class="tc-pv-head"><span class="tc-pv-name">${who}</span> <span class="tc-pv-time">12:34</span></div>
        <div class="tc-pv-bubble tc-pv-${cls}">${body}</div>
      </div>`;
    const body = (act, dia) => `Texte normal. <em>${act}</em> <span class="tc-quote">${dia}</span> <strong>Gras</strong> <a href="#" onclick="return false">lien</a> <code>code</code><blockquote>Citation</blockquote>`;
    return `
    <div id="tc_preview" class="tc-preview" aria-label="Aperçu">
      ${msg('bot', 'Seraphina', body('*Elle sourit.*', '« Bonjour ! »'))}
      ${msg('user', 'Vous', body('*Je souris.*', '"Salut !"'))}
      <input type="text" class="tc-pv-input" placeholder="Placeholder…" value="Texte saisi" readonly aria-label="Aperçu de la barre de saisie">
    </div>`;
}

function section(title, ...kids) {
    return h('div', { class: 'tc-block' }, h('b', { text: title }), ...kids);
}

function checkbox(id, label, checked, onChange) {
    const input = h('input', { type: 'checkbox', id });
    input.checked = !!checked;
    input.addEventListener('change', () => onChange(input.checked));
    return { input, el: h('label', { class: 'checkbox_label', for: id }, input, h('span', { text: label })) };
}

function addOverride(kind, name) {
    name = cleanName(name);
    if (!name || settings.overrides.length >= MAX_OVERRIDES) return;
    if (settings.overrides.some(o => o.kind === kind && o.name === name)) return;
    settings.overrides.push({ kind, name, text: { c: '', a: 100 }, quote: { c: '', a: 100 } });
    commit();
}

function buildOverridesUi() {
    const box = h('div', { class: 'tc-overrides' });
    const render = () => {
        for (const r of [...rows]) if (box.contains(r)) rows.delete(r);
        box.textContent = '';
        if (!settings.overrides.length) box.appendChild(h('div', { class: 'tc-hint', text: 'Aucune surcharge. Ajoutez un personnage (chat de groupe) ou une persona ci-dessous.' }));
        for (const o of settings.overrides) {
            const role = o.kind === 'persona' ? 'user' : 'bot';
            const del = h('button', { type: 'button', class: 'menu_button tc-del', title: 'Supprimer cette surcharge' }, 'Supprimer');
            del.addEventListener('click', () => {
                settings.overrides = settings.overrides.filter(x => x !== o);
                commit();
                render();
            });
            box.appendChild(h('div', { class: 'tc-ov', 'data-name': o.name },
                h('div', { class: 'tc-ov-head' }, h('b', { text: o.name }), h('span', { class: 'tc-tag', text: o.kind === 'persona' ? 'Persona' : 'Personnage' }), del),
                makeColorRow({ label: 'Texte', get: () => o.text, def: DEF_BY_KEY[`${role}Text`], contrast: () => [{ key: `${role}Text`, role }] }),
                makeColorRow({ label: 'Dialogues', get: () => o.quote, def: DEF_BY_KEY.quote, contrast: () => [{ key: 'quote', role }] })));
        }
        const sel = h('select', { class: 'text_pole', id: 'tc_ov_sel', 'aria-label': 'Choisir un personnage ou une persona' });
        const cands = getCandidates().filter(c => !settings.overrides.some(o => o.kind === c.kind && o.name === c.name));
        for (const c of cands) sel.appendChild(h('option', { value: JSON.stringify(c), text: `${c.kind === 'persona' ? 'Persona' : 'Personnage'} : ${c.name}` }));
        if (!cands.length) sel.appendChild(h('option', { value: '', text: '(aucun autre candidat dans ce chat)' }));
        const add = h('button', { type: 'button', class: 'menu_button', id: 'tc_ov_add' }, 'Ajouter');
        add.addEventListener('click', () => {
            try {
                if (!sel.value) return;
                const c = JSON.parse(sel.value);
                addOverride(c.kind === 'persona' ? 'persona' : 'char', c.name);
                render();
            } catch (e) { console.warn(LOG, e); }
        });
        const nameIn = h('input', { type: 'text', class: 'text_pole', id: 'tc_ov_name', placeholder: 'Autre nom exact…', maxlength: 120, autocomplete: 'off', 'aria-label': 'Nom exact' });
        const kindSel = h('select', { class: 'text_pole', id: 'tc_ov_kind', 'aria-label': 'Type' }, h('option', { value: 'char', text: 'Personnage' }), h('option', { value: 'persona', text: 'Persona' }));
        const add2 = h('button', { type: 'button', class: 'menu_button', id: 'tc_ov_add2' }, 'Ajouter ce nom');
        add2.addEventListener('click', () => {
            const n = cleanName(nameIn.value);
            if (!n) return;
            addOverride(kindSel.value === 'persona' ? 'persona' : 'char', n);
            nameIn.value = '';
            render();
        });
        box.appendChild(h('div', { class: 'tc-add' }, sel, add));
        box.appendChild(h('div', { class: 'tc-add' }, nameIn, kindSel, add2));
    };
    box.__render = render;
    render();
    return box;
}

function parsePresetValue(v) {
    if (typeof v !== 'string') return { c: '', a: 100 };
    const [hex, al] = v.split('@');
    return { c: normalizeHex(hex), a: al !== undefined ? clamp(parseInt(al, 10) || 100, 0, 100) : 100 };
}

function applyPreset(p) {
    const colors = emptyColors();
    const split = Object.fromEntries(SPLIT_KEYS.map(k => [k, false]));
    for (const [key, val] of Object.entries(p.colors)) {
        if (!DEF_BY_KEY[key]) continue;
        if (Array.isArray(val)) {
            colors[key] = parsePresetValue(val[0]);
            if (DEF_BY_KEY[key].split) { colors[`${key}U`] = parsePresetValue(val[1]); split[key] = true; }
        } else {
            colors[key] = parsePresetValue(val);
        }
    }
    settings.colors = colors;
    settings.split = split;
    settings.gradient = Object.assign({ enabled: false, c1: '#ffd700', c2: '#ff7a00', angle: 90 }, p.gradient || {});
    settings.glow = Object.assign({ enabled: false, c: '#00f0ff', size: 6 }, p.glow || {});
    commit();
}

function buildPanel() {
    const wrap = h('div', { id: 'text_colors_settings', class: 'extension_container' });
    const content = h('div', { class: 'inline-drawer-content' });
    wrap.appendChild(h('div', { class: 'inline-drawer' },
        h('div', { class: 'inline-drawer-toggle inline-drawer-header' },
            h('b', { text: 'Text Colors' }),
            h('div', { class: 'inline-drawer-icon fa-solid fa-circle-chevron-down down' })),
        content));

    // --- Activation
    const en = checkbox('tc_enabled', 'Activer Text Colors', settings.enabled, (v) => { settings.enabled = v; commit({ reprocess: true }); });
    content.appendChild(h('div', { class: 'tc-block' }, en.el,
        h('div', { class: 'tc-hint', id: 'tc_toggle_hint' }),
        h('div', { class: 'tc-hint', text: 'Seules les couleurs de texte sont modifiées : jamais les fonds, les bulles ni la mise en page.' })));

    // --- Aperçu
    const pvWrap = h('div', { class: 'tc-block' }, h('b', { text: 'Aperçu en direct' }));
    pvWrap.insertAdjacentHTML('beforeend', previewHtml());
    content.appendChild(pvWrap);

    // --- Préréglages
    const presetBox = h('div', { class: 'tc-presets' });
    for (const p of PRESETS) {
        const b = h('button', { type: 'button', class: 'menu_button tc-preset', 'data-preset': p.id, title: p.label },
            h('span', { class: 'tc-dots' }, ...p.sw.map(c => h('i', { style: `background:${c}` }))),
            h('span', { text: p.label }));
        b.addEventListener('click', () => { applyPreset(p); syncAll(); });
        presetBox.appendChild(b);
    }
    content.appendChild(section('Préréglages (un tap)', presetBox,
        h('div', { class: 'tc-hint', text: 'Palettes pensées pour un fond sombre. Un préréglage remplace les couleurs et les effets (vos surcharges par personnage sont conservées).' })));

    // --- Couleurs
    const msgBox = h('div', { class: 'tc-colors' });
    const uiBox = h('div', { class: 'tc-colors' });
    for (const def of COLOR_DEFS) {
        const target = def.group === 'msg' ? msgBox : uiBox;
        if (def.split) {
            const holder = h('div', { class: 'tc-slot', 'data-key': def.key });
            const rowBot = makeColorRow({
                label: def.label, def,
                get: () => settings.colors[def.key],
                contrast: () => (settings.split[def.key] ? [{ key: def.key, role: 'bot' }] : [{ key: def.key, role: 'bot' }, { key: def.key, role: 'user' }]),
            });
            const rowUser = makeColorRow({
                label: `${def.label} – Vous`, def,
                get: () => settings.colors[`${def.key}U`],
                contrast: () => [{ key: def.key, role: 'user' }],
            });
            const sp = checkbox(`tc_split_${def.key}`, 'Couleur distincte pour « Vous »', settings.split[def.key], (v) => {
                settings.split[def.key] = v;
                rowUser.style.display = v ? '' : 'none';
                commit();
            });
            holder.append(rowBot, sp.el, rowUser);
            holder.__sync = () => { sp.input.checked = !!settings.split[def.key]; rowUser.style.display = settings.split[def.key] ? '' : 'none'; };
            holder.__sync();
            target.appendChild(holder);
        } else {
            const role = def.key === 'userText' ? 'user' : 'bot';
            target.appendChild(makeColorRow({ label: def.label, def, get: () => settings.colors[def.key], contrast: () => [{ key: def.key, role }] }));
        }
    }
    content.appendChild(section('Messages', msgBox));
    content.appendChild(section('Interface (noms, heure, saisie)', uiBox));

    // --- Dialogues
    const wq = checkbox('tc_wrap', 'Détecter les dialogues (balises DOM « .tc-quote »)', settings.wrapQuotes, (v) => { settings.wrapQuotes = v; commit({ reprocess: true }); });
    content.appendChild(section('Dialogues', wq.el,
        h('div', { class: 'tc-hint', text: 'Repère "…", « … » et “ ” dans le texte affiché (hors code et liens), sans jamais modifier le texte du message. Les dialogues déjà balisés <q> par SillyTavern reçoivent aussi la couleur des dialogues. Désactivez si cela gêne un autre script.' })));

    // --- Effets
    const gr = checkbox('tc_grad', 'Dégradé de texte sur les dialogues', settings.gradient.enabled, (v) => { settings.gradient.enabled = v; commit(); });
    const gc1 = h('input', { type: 'color', id: 'tc_grad_c1', 'aria-label': 'Dégradé : couleur de départ' });
    const gc2 = h('input', { type: 'color', id: 'tc_grad_c2', 'aria-label': 'Dégradé : couleur d\'arrivée' });
    const gang = h('input', { type: 'range', id: 'tc_grad_angle', min: 0, max: 360, step: 5, 'aria-label': 'Dégradé : angle' });
    gc1.addEventListener('input', () => { settings.gradient.c1 = normalizeHex(gc1.value) || settings.gradient.c1; commit(); });
    gc2.addEventListener('input', () => { settings.gradient.c2 = normalizeHex(gc2.value) || settings.gradient.c2; commit(); });
    gang.addEventListener('input', () => { settings.gradient.angle = clamp(parseInt(gang.value, 10) || 0, 0, 360); commit(); });
    const gl = checkbox('tc_glow', 'Lueur (glow) sur les dialogues', settings.glow.enabled, (v) => { settings.glow.enabled = v; commit(); });
    const glc = h('input', { type: 'color', id: 'tc_glow_c', 'aria-label': 'Lueur : couleur' });
    const gls = h('input', { type: 'range', id: 'tc_glow_size', min: 1, max: 24, step: 1, 'aria-label': 'Lueur : intensité' });
    glc.addEventListener('input', () => { settings.glow.c = normalizeHex(glc.value) || settings.glow.c; commit(); });
    gls.addEventListener('input', () => { settings.glow.size = clamp(parseInt(gls.value, 10) || 1, 1, 24); commit(); });
    content.appendChild(section('Effets (facultatifs)',
        gr.el, h('div', { class: 'tc-fx' }, gc1, gc2, gang),
        gl.el, h('div', { class: 'tc-fx' }, glc, gls),
        h('div', { class: 'tc-hint', text: 'Les effets ne touchent que le texte des dialogues (jamais le fond de la bulle).' })));

    // --- Contraste
    const ac = checkbox('tc_autocontrast', 'Ajuster automatiquement les couleurs au faible contraste', settings.autoContrast, (v) => { settings.autoContrast = v; commit(); });
    const mrSel = h('select', { class: 'text_pole', id: 'tc_minratio', 'aria-label': 'Contraste minimal' },
        h('option', { value: '3', text: '3:1 (gros texte)' }), h('option', { value: '4.5', text: '4.5:1 (recommandé)' }), h('option', { value: '7', text: '7:1 (renforcé)' }));
    mrSel.addEventListener('change', () => { settings.minRatio = parseFloat(mrSel.value) || 4.5; commit(); });
    content.appendChild(section('Contraste', ac.el,
        h('div', { class: 'tc-row-ctl' }, h('label', { for: 'tc_minratio', text: 'Seuil' }), mrSel),
        h('div', { class: 'tc-hint', text: 'Le contraste est calculé avec la couleur réelle de vos bulles (lue sur le chat, sans la modifier). Un avertissement ⚠ s\'affiche sous chaque couleur trop peu lisible ; l\'ajustement automatique éclaircit ou assombrit seulement le rendu (vos réglages restent intacts).' })));

    // --- Surcharges
    const ovBox = buildOverridesUi();
    content.appendChild(section('Par personnage / par persona',
        h('div', { class: 'tc-hint', text: 'Couleur du texte et des dialogues pour un personnage précis (chats de groupe) ou une persona. Prioritaire sur les couleurs globales.' }), ovBox));

    // --- Import / export
    const ta = h('textarea', { id: 'tc_json', class: 'text_pole tc-json', rows: 5, spellcheck: 'false', placeholder: 'JSON des réglages…', 'aria-label': 'JSON des réglages' });
    const bExp = h('button', { type: 'button', class: 'menu_button', id: 'tc_export' }, 'Exporter');
    const bImp = h('button', { type: 'button', class: 'menu_button', id: 'tc_import' }, 'Importer');
    const file = h('input', { type: 'file', accept: '.json,application/json', id: 'tc_file', class: 'tc-file', 'aria-label': 'Choisir un fichier JSON' });
    bExp.addEventListener('click', async () => {
        const json = JSON.stringify({ app: 'text-colors', version: VERSION, settings }, null, 2);
        ta.value = json;
        let copied = false;
        try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(json); copied = true; } } catch { /* ignore */ }
        try {
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = 'text-colors.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch { /* ignore */ }
        notify('success', copied ? 'Réglages exportés (copiés dans le presse-papiers).' : 'Réglages exportés (JSON ci-dessus).');
    });
    bImp.addEventListener('click', () => {
        try {
            const data = JSON.parse(ta.value);
            const incoming = data && typeof data === 'object' && data.settings && typeof data.settings === 'object' ? data.settings : data;
            if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('format');
            settings = normalizeSettings(incoming);
            commit({ reprocess: true });
            syncAll();
            notify('success', 'Réglages importés.');
        } catch {
            notify('error', 'JSON invalide : import annulé.');
        }
    });
    file.addEventListener('change', () => {
        const f = file.files && file.files[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { ta.value = String(rd.result || ''); notify('info', 'Fichier chargé : touchez « Importer ».'); };
        rd.readAsText(f);
        file.value = '';
    });
    content.appendChild(section('Import / export', ta, h('div', { class: 'tc-btns' }, bExp, bImp),
        h('label', { class: 'tc-hint', for: 'tc_file' }, 'Ou charger un fichier .json : '), file));

    // --- Réinitialisation
    const bReset = h('button', { type: 'button', class: 'menu_button', id: 'tc_reset_all' }, 'Tout réinitialiser (hérité du thème)');
    bReset.addEventListener('click', () => {
        if (!window.confirm('Réinitialiser tous les réglages de Text Colors ?')) return;
        settings = defaultSettings();
        commit({ reprocess: true });
        syncAll();
    });
    content.appendChild(h('div', { class: 'tc-block' }, bReset));

    function syncAll() {
        en.input.checked = settings.enabled;
        wq.input.checked = settings.wrapQuotes;
        gr.input.checked = settings.gradient.enabled;
        gc1.value = settings.gradient.c1;
        gc2.value = settings.gradient.c2;
        gang.value = String(settings.gradient.angle);
        gl.input.checked = settings.glow.enabled;
        glc.value = settings.glow.c;
        gls.value = String(settings.glow.size);
        ac.input.checked = settings.autoContrast;
        mrSel.value = [3, 4.5, 7].includes(settings.minRatio) ? String(settings.minRatio) : '4.5';
        wrap.querySelectorAll('.tc-slot').forEach(s => s.__sync && s.__sync());
        ovBox.__render();
        panelRefresh();
    }
    panelCtl = { syncAll, renderOverrides: () => ovBox.__render() };
    syncAll();
    return wrap;
}

function mountPanel() {
    if (document.getElementById('text_colors_settings')) return;
    const host = document.getElementById('extensions_settings2') || document.getElementById('extensions_settings');
    if (!host) { console.warn(LOG, 'Conteneur des réglages introuvable.'); return; }
    host.appendChild(buildPanel());
    // À l'ouverture du tiroir : relit les fonds réels et la liste des personnages.
    const toggle = document.querySelector('#text_colors_settings .inline-drawer-toggle');
    if (toggle) toggle.addEventListener('click', () => setTimeout(() => { scheduleApply(); if (panelCtl) panelCtl.renderOverrides(); }, 60));
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

function init() {
    try {
        loadSettings();
        applyStyle();
        watchHead();
        mountPanel();
        startObserver();

        // Déroule les dialogues d'un message avant son édition (DOM uniquement ; les données du chat ne sont jamais touchées).
        document.addEventListener('click', (ev) => {
            try {
                const btn = ev.target && ev.target.closest && ev.target.closest('.mes_edit');
                if (!btn) return;
                const t = btn.closest('.mes')?.querySelector('.mes_text');
                if (t) { unwrapQuotes(t); takeOwnRecords(); }
            } catch { /* ignore */ }
        }, true);

        const { eventSource, event_types } = stScript;
        if (!eventSource || !event_types) {
            console.error(LOG, 'eventSource / event_types introuvables : seul le MutationObserver assure la mise à jour.');
            return;
        }
        const byId = (id) => {
            try {
                const el = document.querySelector(`#chat .mes[mesid="${Number(id)}"] .mes_text`);
                if (el) { queueProcess(el); return; }
            } catch { /* ignore */ }
            processAll();
        };
        for (const ev of [event_types.CHARACTER_MESSAGE_RENDERED, event_types.USER_MESSAGE_RENDERED, event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_EDITED]) {
            if (ev) eventSource.on(ev, (id) => byId(id));
        }
        eventSource.on(event_types.CHAT_CHANGED, () => {
            try {
                startObserver();
                applyStyle();
                processAll();
                if (panelCtl) panelCtl.renderOverrides();
                setTimeout(() => { if (measureBgsChanged()) scheduleApply(); }, 600); // les bulles sont rendues après CHAT_CHANGED
            } catch (e) { console.error(LOG, e); }
        });
        if (event_types.GROUP_UPDATED) eventSource.on(event_types.GROUP_UPDATED, () => panelCtl && panelCtl.renderOverrides());
        if (event_types.SETTINGS_UPDATED) eventSource.on(event_types.SETTINGS_UPDATED, () => scheduleApply());
        console.log(LOG, `chargé (${VERSION})`);
    } catch (e) {
        console.error(LOG, 'Initialisation échouée (chat non affecté)', e);
    }
}

if (globalThis.jQuery) {
    globalThis.jQuery(() => init());
} else if (typeof document !== 'undefined') {
    init();
}

export const __test = { normalizeHex, normalizeSettings, defaultSettings, scanQuotes, adjustForContrast, contrastRatio, hexToRgb, ratioOn, PRESETS, getBgs: () => bgs };
