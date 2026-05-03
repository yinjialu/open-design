import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  FileViewer,
  SvgViewer,
  applyInspectOverridesToSource,
  parseInspectOverridesFromSource,
  serializeInspectOverrides,
  updateInspectOverride,
} from './FileViewer';
import type { InspectOverrideMap } from './FileViewer';
import type { ProjectFile } from '../types';

function baseFile(overrides: Partial<ProjectFile>): ProjectFile {
  return {
    name: 'asset.png',
    path: 'asset.png',
    type: 'file',
    size: 1024,
    mtime: 1710000000,
    kind: 'image',
    mime: 'image/png',
    ...overrides,
  };
}

describe('FileViewer SVG artifacts', () => {
  it('routes SVG artifacts to the SVG viewer instead of the generic image viewer', () => {
    const file = baseFile({
      name: 'diagram.svg',
      path: 'diagram.svg',
      mime: 'image/svg+xml',
      artifactManifest: {
        version: 1,
        kind: 'svg',
        title: 'Diagram',
        entry: 'diagram.svg',
        renderer: 'svg',
        exports: ['svg'],
      },
    });

    const markup = renderToStaticMarkup(<FileViewer projectId="project-1" file={file} />);

    expect(markup).toContain('class="viewer svg-viewer"');
    expect(markup).not.toContain('class="viewer image-viewer"');
    expect(markup).toContain('Preview');
    expect(markup).toContain('Source');
    expect(markup).toContain('src="/api/projects/project-1/raw/diagram.svg?v=1710000000&amp;r=0"');
  });

  it('keeps normal image artifacts on the existing image viewer path', () => {
    const file = baseFile({ name: 'photo.png', path: 'photo.png' });

    const markup = renderToStaticMarkup(<FileViewer projectId="project-1" file={file} />);

    expect(markup).toContain('class="viewer image-viewer"');
    expect(markup).not.toContain('class="viewer svg-viewer"');
    expect(markup).not.toContain('class="viewer-tabs"');
  });

  it('marks preview and source modes through the SVG viewer toggle controls', () => {
    const file = baseFile({ name: 'diagram.svg', path: 'diagram.svg', mime: 'image/svg+xml' });

    const previewMarkup = renderToStaticMarkup(
      <SvgViewer projectId="project-1" file={file} initialMode="preview" />,
    );
    const sourceMarkup = renderToStaticMarkup(
      <SvgViewer
        projectId="project-1"
        file={file}
        initialMode="source"
        initialSource="<svg><title>Diagram</title></svg>"
      />,
    );

    expect(previewMarkup).toContain('class="viewer-tab active" aria-pressed="true">Preview</button>');
    expect(previewMarkup).toContain('aria-pressed="false">Source</button>');
    expect(previewMarkup).toContain('<img');

    expect(sourceMarkup).toContain('aria-pressed="false">Preview</button>');
    expect(sourceMarkup).toContain('class="viewer-tab active" aria-pressed="true">Source</button>');
    expect(sourceMarkup).toContain('class="viewer-source"');
    expect(sourceMarkup).not.toContain('<img');
  });

  it('renders unsafe SVG source as escaped text instead of executable markup', () => {
    const file = baseFile({ name: 'unsafe.svg', path: 'unsafe.svg', mime: 'image/svg+xml' });
    const unsafeSource = [
      '<svg onload="alert(1)"><script>alert(2)</script><text>Logo</text></svg>',
      '<svg><![CDATA[<script>alert(3)</script>]]></svg>',
    ].join('\n');

    const markup = renderToStaticMarkup(
      <SvgViewer
        projectId="project-1"
        file={file}
        initialMode="source"
        initialSource={unsafeSource}
      />,
    );

    expect(markup).toContain('&lt;svg onload=&quot;alert(1)&quot;&gt;');
    expect(markup).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(markup).toContain('&lt;![CDATA[&lt;script&gt;alert(3)&lt;/script&gt;]]&gt;');
    expect(markup).not.toContain('<svg onload');
    expect(markup).not.toContain('<script>');
    expect(markup).not.toContain('<![CDATA[');
    expect(markup).not.toContain('dangerouslySetInnerHTML');
  });
});

describe('applyInspectOverridesToSource', () => {
  const base = `<!doctype html><html><head><title>X</title></head><body><main data-od-id="hero">Hi</main></body></html>`;
  const css = `[data-od-id="hero"] { color: #ff0000 !important }`;

  it('inserts the overrides block before </head>', () => {
    const next = applyInspectOverridesToSource(base, css);
    expect(next).toContain('<style data-od-inspect-overrides>');
    expect(next).toContain('color: #ff0000');
    expect(next.indexOf('<style data-od-inspect-overrides>')).toBeLessThan(next.indexOf('</head>'));
  });

  it('replaces an existing overrides block instead of duplicating', () => {
    const once = applyInspectOverridesToSource(base, css);
    const twice = applyInspectOverridesToSource(once, `[data-od-id="hero"] { color: #00ff00 !important }`);
    const matches = twice.match(/<style data-od-inspect-overrides>/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(twice).toContain('color: #00ff00');
    expect(twice).not.toContain('color: #ff0000');
  });

  it('strips the overrides block when called with empty css', () => {
    const once = applyInspectOverridesToSource(base, css);
    const stripped = applyInspectOverridesToSource(once, '');
    expect(stripped).not.toContain('data-od-inspect-overrides');
  });

  it('handles fragments without an explicit <head>', () => {
    const next = applyInspectOverridesToSource('<main data-od-id="x">x</main>', css);
    expect(next).toContain('<style data-od-inspect-overrides>');
    expect(next.indexOf('<style data-od-inspect-overrides>')).toBeLessThan(next.indexOf('<main'));
  });

  // Regression for nexu-io/open-design#362: if a source file has more than
  // one inspect override block (manual edit, or an earlier buggy save), the
  // splicer must drop them all before inserting the new block. A non-global
  // regex would only strip the first, so save-then-reload could resurrect an
  // override the user just cleared.
  it('removes every existing overrides block, not just the first', () => {
    const dup = `<!doctype html><html><head>` +
      `<style data-od-inspect-overrides>[data-od-id="hero"] { color: #ff0000 !important }</style>` +
      `<style data-od-inspect-overrides>[data-od-id="hero"] { color: #00ff00 !important }</style>` +
      `<title>X</title></head><body><main data-od-id="hero">Hi</main></body></html>`;
    const replaced = applyInspectOverridesToSource(dup, `[data-od-id="hero"] { color: #0000ff !important }`);
    const matches = replaced.match(/<style data-od-inspect-overrides>/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(replaced).toContain('color: #0000ff');
    expect(replaced).not.toContain('color: #ff0000');
    expect(replaced).not.toContain('color: #00ff00');

    const cleared = applyInspectOverridesToSource(dup, '');
    expect(cleared).not.toContain('data-od-inspect-overrides');
  });

  // Regression for nexu-io/open-design#362: the splicer must be HTML-aware
  // when locating its own override block and the head insertion point.
  // Generated artifacts commonly carry inline scripts/styles that mention
  // `</head>` or `<style data-od-inspect-overrides>` as text, e.g. a
  // template literal that builds HTML at runtime or a CSS rule that
  // documents the override block. A regex-only splicer would happily
  // splice into the middle of the script body or strip the literal string,
  // corrupting user code on Save to source.
  it('ignores </head> literals inside inline <script> and <style>', () => {
    const sourceWithLiteral =
      `<!doctype html><html><head>` +
      // Script body contains a quoted "</head>" string that must NOT be
      // treated as the real head close.
      `<script>const tpl = "<head>\\n</head>";</script>` +
      `<style>/* sentinel: </head> appears in this CSS comment */</style>` +
      `<title>X</title></head><body><main data-od-id="hero">Hi</main></body></html>`;
    const next = applyInspectOverridesToSource(sourceWithLiteral, css);
    // The override block must land exactly once, before the real </head>,
    // and after the inline <script> and <style> that contain `</head>`
    // text. Without HTML-aware scanning the regex would splice before the
    // first textual `</head>`, which sits inside the script body.
    const blockIdx = next.indexOf('<style data-od-inspect-overrides>');
    const realHeadEndIdx = next.indexOf('</head>', next.indexOf('<title>'));
    const scriptOpenIdx = next.indexOf('<script>');
    const scriptCloseIdx = next.indexOf('</script>');
    expect(blockIdx).toBeGreaterThan(-1);
    expect(realHeadEndIdx).toBeGreaterThan(-1);
    expect(scriptOpenIdx).toBeGreaterThan(-1);
    expect(scriptCloseIdx).toBeGreaterThan(-1);
    // Override block sits BEFORE the real </head>, AFTER the script body.
    expect(blockIdx).toBeLessThan(realHeadEndIdx);
    expect(blockIdx).toBeGreaterThan(scriptCloseIdx);
    // The script's `</head>` literal still survives in the output —
    // the splicer must not have hijacked it as the head insertion point.
    expect(next).toContain('const tpl = "<head>\\n</head>";');
    // The CSS comment's `</head>` token also survives untouched.
    expect(next).toContain('/* sentinel: </head> appears in this CSS comment */');
    // Only one override block in total.
    const blockMatches = next.match(/<style data-od-inspect-overrides>/g) ?? [];
    expect(blockMatches).toHaveLength(1);
  });

  it('ignores `<style data-od-inspect-overrides>` literals inside <script>', () => {
    // A sentinel string literal in an inline script that mentions the
    // override block by name. A regex-only splicer would strip the
    // literal as if it were a real block, mangling the script.
    const sourceWithLiteral =
      `<!doctype html><html><head>` +
      `<script>const banner = "<style data-od-inspect-overrides>color: red</style>";</script>` +
      `<title>X</title></head><body><main data-od-id="hero">Hi</main></body></html>`;
    const next = applyInspectOverridesToSource(sourceWithLiteral, css);
    // The literal must survive verbatim inside the script body.
    expect(next).toContain('const banner = "<style data-od-inspect-overrides>color: red</style>";');
    // The output still gains exactly one real override block.
    const blockMatches = next.match(/<style data-od-inspect-overrides>\n\[data-od-id="hero"\]/g) ?? [];
    expect(blockMatches).toHaveLength(1);
    // Stripping with empty css must NOT touch the script literal.
    const stripped = applyInspectOverridesToSource(sourceWithLiteral, '');
    expect(stripped).toContain('const banner = "<style data-od-inspect-overrides>color: red</style>";');
    // The script-internal literal is the only mention of the marker after
    // stripping — the splicer must not have inserted or kept any real
    // override block.
    const allMatches = stripped.match(/data-od-inspect-overrides/g) ?? [];
    expect(allMatches).toHaveLength(1);
  });

  it('ignores </head> inside <textarea> and <title> raw-text elements', () => {
    // <textarea> and <title> are escapable raw-text elements; their
    // contents are text, not markup, so a literal `</head>` inside them
    // must not be treated as a tag boundary.
    const sourceWithTextarea =
      `<!doctype html><html><head><title>Has </head> in title</title></head>` +
      `<body><textarea>literal </head> goes here</textarea>` +
      `<main data-od-id="hero">Hi</main></body></html>`;
    const next = applyInspectOverridesToSource(sourceWithTextarea, css);
    // Override block lands before the REAL </head>, which is after the
    // </title>'s close. The title-internal `</head>` must not be the
    // chosen insertion point.
    const blockIdx = next.indexOf('<style data-od-inspect-overrides>');
    const titleCloseIdx = next.indexOf('</title>');
    const realHeadCloseIdx = next.indexOf('</head>', titleCloseIdx);
    expect(blockIdx).toBeGreaterThan(titleCloseIdx);
    expect(blockIdx).toBeLessThan(realHeadCloseIdx);
    // Both literals survive untouched.
    expect(next).toContain('Has </head> in title');
    expect(next).toContain('literal </head> goes here');
  });
});

describe('serializeInspectOverrides', () => {
  it('emits validated declarations for legitimate overrides', () => {
    const out = serializeInspectOverrides({
      hero: { selector: '[data-od-id="hero"]', props: { color: '#ff0000', 'font-size': '18px' } },
    });
    expect(out).toContain('[data-od-id="hero"]');
    expect(out).toContain('color: #ff0000 !important');
    expect(out).toContain('font-size: 18px !important');
  });

  it('honours data-screen-label entries the bridge tagged that way', () => {
    const out = serializeInspectOverrides({
      hero: { selector: '[data-screen-label="hero"]', props: { color: '#0f0' } },
    });
    expect(out).toContain('[data-screen-label="hero"]');
    expect(out).not.toContain('[data-od-id="hero"]');
  });

  // Regression for nexu-io/open-design#362: standard deck slides ship as
  // `<section data-screen-label="01 Cover">`. The bridge keys overrides by
  // the raw label and posts a CSS.escape'd selector, so the host must
  // accept whitespace/leading-digit ids and detect the selector kind by
  // prefix instead of full equality. Otherwise the override is dropped
  // outright (or silently rewritten to `[data-od-id="..."]`) and reload
  // erases the user's edit.
  it('preserves data-screen-label values with whitespace and leading digits', () => {
    const out = serializeInspectOverrides({
      '01 Cover': {
        selector: '[data-screen-label="\\30 1\\20 Cover"]',
        props: { color: '#ff0000', 'font-size': '20px' },
      },
    });
    expect(out).toContain('[data-screen-label="01 Cover"]');
    expect(out).not.toContain('[data-od-id="01 Cover"]');
    expect(out).toContain('color: #ff0000 !important');
    expect(out).toContain('font-size: 20px !important');
  });

  it('rejects non-allow-listed properties', () => {
    const out = serializeInspectOverrides({
      hero: { selector: '[data-od-id="hero"]', props: { position: 'absolute', color: '#fff' } },
    });
    expect(out).not.toContain('position');
    expect(out).toContain('color: #fff !important');
  });

  it('drops values that try to break out of a `prop: value` declaration', () => {
    const out = serializeInspectOverrides({
      hero: {
        selector: '[data-od-id="hero"]',
        // semicolon, brace, angle bracket, and newline are all rejected.
        props: {
          color: 'red; background: url(x)',
          'font-size': '16px } [body] { color: red',
          'font-family': 'Arial</style><script>alert(1)</script>',
          'line-height': '1\n.evil',
        },
      },
    });
    expect(out).toBe('');
  });

  // The vulnerability we're regression-testing: artifact code rendered with
  // scripts enabled can call window.parent.postMessage({ type:
  // 'od:inspect-overrides', overrides, css: '</style><script>...</script>' })
  // — ev.source still matches iframe.contentWindow, so the host listener
  // accepts it. The fix is that the host re-derives CSS from the structured
  // `overrides` field under its own allow-list and ignores the inbound `css`
  // entirely. This test covers that the serializer never lets a forged
  // payload reach the persisted style block.
  it('refuses to surface a forged </style><script> payload', () => {
    const forged = {
      // Hostile selector string: re-derived from elementId, never trusted.
      hero: {
        selector: '} </style><script>alert(1)</script><style>{',
        props: { color: '#fff' },
      },
      // Hostile elementId: rejected outright by the safe-id check.
      '"></style><script>alert(2)</script>': {
        selector: '[data-od-id="x"]',
        props: { color: '#fff' },
      },
      // Hostile value: rejected by UNSAFE_VALUE.
      villain: {
        selector: '[data-od-id="villain"]',
        props: { color: '</style><script>alert(3)</script>' },
      },
    };
    const out = serializeInspectOverrides(forged);
    expect(out).not.toContain('</style>');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('alert(');
    // The legitimate-looking entry still serializes — but with a re-derived
    // selector, not the attacker-supplied one.
    expect(out).toContain('[data-od-id="hero"] { color: #fff !important }');
    expect(out).not.toContain('villain');

    // And the spliced source must not contain executable markup either,
    // even when the forged body is concatenated into a <style> block.
    const spliced = applyInspectOverridesToSource(
      '<!doctype html><html><head></head><body></body></html>',
      out,
    );
    expect(spliced).not.toContain('</style><script>');
    expect(spliced).not.toContain('alert(');
  });

  it('returns empty string for non-object payloads', () => {
    expect(serializeInspectOverrides(null)).toBe('');
    expect(serializeInspectOverrides(undefined)).toBe('');
    expect(serializeInspectOverrides('</style><script>alert(1)</script>')).toBe('');
    expect(serializeInspectOverrides(42)).toBe('');
  });
});

// Regression for nexu-io/open-design#362: the host owns the inspect override
// map authoritatively. Hydration parses the artifact source on load so an
// initial Save-to-source preserves prior rules even when the user edits a
// different element, and forging the iframe's od:inspect-overrides reply
// cannot inject overrides — the host never ingests it.
describe('parseInspectOverridesFromSource', () => {
  it('returns an empty map when the source has no override block', () => {
    expect(parseInspectOverridesFromSource('')).toEqual({});
    expect(parseInspectOverridesFromSource('<!doctype html><html><body>x</body></html>')).toEqual({});
  });

  it('parses an existing override block into the host map', () => {
    const source =
      `<!doctype html><html><head>` +
      `<style data-od-inspect-overrides>` +
      `[data-od-id="hero"] { color: #ff0000 !important; font-size: 18px !important }` +
      `\n[data-screen-label="01 Cover"] { background-color: #000 !important }` +
      `</style></head><body></body></html>`;
    const map = parseInspectOverridesFromSource(source);
    expect(map.hero?.props).toEqual({ color: '#ff0000', 'font-size': '18px' });
    expect(map.hero?.selector).toBe('[data-od-id="hero"]');
    expect(map['01 Cover']?.props).toEqual({ 'background-color': '#000' });
    expect(map['01 Cover']?.selector).toBe('[data-screen-label="01 Cover"]');
  });

  it('aggregates rules across multiple persisted blocks', () => {
    const source =
      `<style data-od-inspect-overrides>[data-od-id="a"] { color: #111 !important }</style>` +
      `<style data-od-inspect-overrides>[data-od-id="b"] { color: #222 !important }</style>`;
    const map = parseInspectOverridesFromSource(source);
    expect(Object.keys(map).sort()).toEqual(['a', 'b']);
  });

  it('drops disallowed properties and rules whose only declarations are unsafe', () => {
    const source =
      `<style data-od-inspect-overrides>` +
      `[data-od-id="hero"] { position: absolute !important; color: #fff !important }` +
      `[data-od-id="bad"] { background: red } ` +
      `</style>`;
    const map = parseInspectOverridesFromSource(source);
    expect(map.hero?.props).toEqual({ color: '#fff' });
    expect(map.bad).toBeUndefined();
  });

  it('refuses elementIds whose characters could break out of the attr value', () => {
    const hostile =
      `<style data-od-inspect-overrides>` +
      `[data-od-id="\"><script>alert(1)</script>"] { color: #fff !important }` +
      `</style>`;
    expect(parseInspectOverridesFromSource(hostile)).toEqual({});
  });
});

describe('updateInspectOverride', () => {
  const base: InspectOverrideMap = {
    hero: { selector: '[data-od-id="hero"]', props: { color: '#ff0000' } },
  };

  it('adds a new property to an existing entry', () => {
    const next = updateInspectOverride(base, 'hero', '[data-od-id="hero"]', 'font-size', '18px');
    expect(next).not.toBe(base);
    expect(next.hero?.props).toEqual({ color: '#ff0000', 'font-size': '18px' });
  });

  it('creates a new entry for a previously untouched element', () => {
    const next = updateInspectOverride(base, 'cta', '[data-od-id="cta"]', 'color', '#00ff00');
    expect(next.cta?.props).toEqual({ color: '#00ff00' });
    expect(next.hero?.props).toEqual({ color: '#ff0000' });
  });

  it('clears a single property when given an empty value', () => {
    const seeded = updateInspectOverride(base, 'hero', '[data-od-id="hero"]', 'font-size', '18px');
    const cleared = updateInspectOverride(seeded, 'hero', '[data-od-id="hero"]', 'font-size', '');
    expect(cleared.hero?.props).toEqual({ color: '#ff0000' });
  });

  it('drops the entry once the last property is cleared', () => {
    const cleared = updateInspectOverride(base, 'hero', '[data-od-id="hero"]', 'color', '');
    expect(cleared.hero).toBeUndefined();
  });

  it('returns the same map reference when the change is a no-op', () => {
    const same = updateInspectOverride(base, 'hero', '[data-od-id="hero"]', 'color', '#ff0000');
    expect(same).toBe(base);
    const noClear = updateInspectOverride(base, 'hero', '[data-od-id="hero"]', 'font-size', '');
    expect(noClear).toBe(base);
  });

  it('rejects properties off the host allow-list', () => {
    const ignored = updateInspectOverride(base, 'hero', '[data-od-id="hero"]', 'position', 'absolute');
    expect(ignored).toBe(base);
  });

  it('rejects values that could break out of `prop: value`', () => {
    const ignored = updateInspectOverride(
      base,
      'hero',
      '[data-od-id="hero"]',
      'color',
      'red; background: url(x)',
    );
    expect(ignored).toBe(base);
  });

  it('rejects elementIds whose characters could break out of the attr value', () => {
    const ignored = updateInspectOverride(
      base,
      '"><script>alert(1)</script>',
      '[data-od-id="x"]',
      'color',
      '#fff',
    );
    expect(ignored).toBe(base);
  });
});
