import { describe, expect, it } from 'vitest';
import { buildSrcdoc } from './srcdoc';

const deckHtml = `<!doctype html>
<html>
  <head><title>Deck</title></head>
  <body>
    <section class="slide active">One</section>
    <section class="slide">Two</section>
    <section class="slide">Three</section>
  </body>
</html>`;

describe('buildSrcdoc', () => {
  it('injects an initial slide index for deck previews', () => {
    const doc = buildSrcdoc(deckHtml, { deck: true, initialSlideIndex: 2 });

    expect(doc).toContain('var initialSlideIndex = 2;');
    expect(doc).toContain('setTimeout(restoreInitialSlide, 200)');
    expect(doc).toContain('setTimeout(restoreInitialSlide, 100)');
  });

  it('clamps invalid initial slide indices before injecting deck bridge script', () => {
    const doc = buildSrcdoc(deckHtml, { deck: true, initialSlideIndex: -4 });

    expect(doc).toContain('var initialSlideIndex = 0;');
  });

  it('only uses directly mutable slide conventions for setActive support', () => {
    const srcdoc = buildSrcdoc(
      '<section class="slide">One</section><section class="slide">Two</section>',
      { deck: true }
    );

    const canSetActive = srcdoc.match(/function canSetActive\(list\)\{([\s\S]*?)\n  \}/)?.[1] ?? '';

    expect(canSetActive).toContain('findActiveByClass(list) >= 0');
    expect(canSetActive).toContain("list[i].style.display === 'none'");
    expect(canSetActive).toContain("list[i].style.visibility === 'hidden'");
    expect(canSetActive).toContain("list[i].hasAttribute('hidden')");
    expect(canSetActive).not.toContain('findActiveByVisibility');
  });

  it('injects the selection bridge for comment mode', () => {
    const srcdoc = buildSrcdoc('<main data-od-id="hero">Hero</main>', {
      commentBridge: true,
    });

    expect(srcdoc).toContain('data-od-selection-bridge');
    expect(srcdoc).toContain('var commentEnabled = false;');
    expect(srcdoc).toContain('var inspectEnabled = false;');
    expect(srcdoc).toContain("type: 'od:comment-target'");
    expect(srcdoc).toContain("type: 'od:comment-hover'");
    expect(srcdoc).toContain("type: 'od:comment-leave'");
    expect(srcdoc).toContain("type: 'od:comment-targets'");
    expect(srcdoc).toContain("document.addEventListener('scroll', schedulePostTargets, true);");
    expect(srcdoc).toContain('data-od-selection-bridge-style');
  });

  it('injects the selection bridge for inspect mode and exposes override hooks', () => {
    const srcdoc = buildSrcdoc('<main data-od-id="hero">Hero</main>', {
      inspectBridge: true,
    });

    expect(srcdoc).toContain('data-od-selection-bridge');
    expect(srcdoc).toContain("type: 'od:inspect-overrides'");
    expect(srcdoc).toContain("data.type === 'od:inspect-mode'");
    expect(srcdoc).toContain("data.type === 'od:inspect-set'");
    expect(srcdoc).toContain("data.type === 'od:inspect-reset'");
    expect(srcdoc).toContain("data.type === 'od:inspect-extract'");
    expect(srcdoc).toContain("data-od-inspect-overrides");
    expect(srcdoc).toContain('html[data-od-inspect-mode]');
  });

  it('omits the selection bridge entirely when neither comment nor inspect mode is on', () => {
    const srcdoc = buildSrcdoc('<main data-od-id="hero">Hero</main>', {});
    expect(srcdoc).not.toContain('data-od-selection-bridge');
  });

  it('hardens inspect overrides with a prop allow-list, value sanitizer, and trusted selector', () => {
    const srcdoc = buildSrcdoc('<main data-od-id="hero">Hero</main>', {
      inspectBridge: true,
    });

    // Allow-list rejects anything off the InspectPanel surface — without
    // this a malicious parent could smuggle CSS via od:inspect-set.
    expect(srcdoc).toContain('var ALLOWED_PROPS');
    expect(srcdoc).toContain("'color': true");
    expect(srcdoc).toContain("'background-color': true");
    expect(srcdoc).toContain("'border-radius': true");
    expect(srcdoc).toContain("Object.prototype.hasOwnProperty.call(ALLOWED_PROPS, prop)");

    // Value sanitizer drops any character that could close the declaration,
    // the rule, or the <style> element.
    expect(srcdoc).toContain('var UNSAFE_VALUE = /[;{}<>\\n\\r]/;');
    expect(srcdoc).toContain('UNSAFE_VALUE.test(v)');

    // Selector is recomputed from elementId, not echoed back from the
    // inbound message — defends against a forged selector breaking out
    // of the override <style> block.
    expect(srcdoc).toContain('function safeSelectorFor(elementId)');
    expect(srcdoc).toContain('var safeSelector = safeSelectorFor(elementId)');
  });
});
