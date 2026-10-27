// Automation detection: flags direct accessibility-API value writes (the
// 'lucifergetx' vector - macOS AX kAXValueAttribute set / Windows UIA
// ValuePattern.SetValue) by the DOM fingerprints they leave behind.
//
// Fingerprints measured per engine (see the PR description for the raw data):
//   Chromium (SEB Win / CEF): an `input` event whose `inputType` is
//     undefined - human typing always carries insertText / deleteContent /
//     insertReplacementText etc. - plus an immediate `change` event while
//     the field is still focused (human `change` only fires on blur).
//   WebKit (SEB Mac / WKWebView): `input` events with perfectly normal
//     human inputTypes (deleteContent + insertText) BUT with no keystroke
//     between them. Humans always interleave keydown -> input; the direct
//     write fires its events with zero keystrokes in between.
//
// False-positive notes: browser autofill / password managers fire
// insertReplacementText (not matched here), IME composition is skipped via
// composition events, and drag-drop / cut / undo use inputTypes outside the
// human-editing match below. Synthetic CGEvent/SendInput typing (the
// 'lucifergets' vector) looks like real typing - one keydown per character -
// and is intentionally not flagged.

type Finding = {
  signal: string;
  detail: string;
  time: string;
};

const findings: Finding[] = [];
let banner: HTMLDivElement | null = null;
let counter = 0;

function editable(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

function label(el: HTMLElement): string {
  const id = el.id ? `#${el.id}` : "";
  const name = (el as HTMLInputElement).name ? `[name=${(el as HTMLInputElement).name}]` : "";
  return `${el.tagName.toLowerCase()}${id}${name}`;
}

function valueOf(el: HTMLElement): string {
  const v = (el as HTMLInputElement).value;
  const text = typeof v === "string" ? v : el.textContent || "";
  return text.slice(0, 60);
}

function record(signal: string, detail: string): void {
  counter += 1;
  findings.push({ signal, detail, time: new Date().toLocaleTimeString() });
  console.warn(`[automation-detect] #${counter} ${signal} :: ${detail}`);
  showBanner();
}

function showBanner(): void {
  if (!banner) {
    banner = document.createElement("div");
    banner.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:2147483647",
      "background:#b91c1c",
      "color:#fff",
      "padding:10px 16px",
      "font:13px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "box-shadow:0 2px 8px rgba(0,0,0,0.35)",
    ].join(";");
    document.body.appendChild(banner);
  }
  const rows = findings
    .map((f) => `<div>[${f.time}] ${f.signal} — ${f.detail}</div>`)
    .join("");
  banner.innerHTML =
    `⚠️ <b>AUTOMATION DETECTED</b> — ${counter} direct value write` +
    `${counter > 1 ? "s" : ""} (accessibility-API fingerprint)${rows}`;
}

const lastKeydownAt = new WeakMap<Element, number>();
const lastInputAt = new WeakMap<Element, number>();
const composing = new WeakSet<Element>();

document.addEventListener(
  "keydown",
  (e) => {
    if (e.target instanceof Element) {
      lastKeydownAt.set(e.target, performance.now());
    }
  },
  true
);

document.addEventListener(
  "compositionstart",
  (e) => {
    if (e.target instanceof Element) composing.add(e.target);
  },
  true
);

document.addEventListener(
  "compositionend",
  (e) => {
    if (e.target instanceof Element) composing.delete(e.target);
  },
  true
);

document.addEventListener(
  "input",
  (e) => {
    const t = e.target;
    if (!editable(t) || composing.has(t)) return;
    const inputType = (e as InputEvent).inputType;

    // Signal A - Chromium: the AX/UIA direct write dispatches an InputEvent
    // with NO inputType at all.
    if (inputType === undefined) {
      record(
        "SIGNAL A: input with inputType=undefined",
        `${label(t)} (Chromium AX/UIA direct write) value="${valueOf(t)}"`
      );
      lastInputAt.set(t, performance.now());
      return;
    }

    // Signal B - any engine: an editing-type input event with NO keydown
    // since the previous input event on the same element. A human edit
    // always has keydown -> input; the direct write does not.
    const humanEdit = /^insertText|^deleteContent/.test(inputType);
    const now = performance.now();
    const keyAt = lastKeydownAt.get(t) ?? -Infinity;
    const prevInputAt = lastInputAt.get(t) ?? -Infinity;
    if (humanEdit && keyAt <= prevInputAt) {
      record(
        "SIGNAL B: input with no keystroke since previous input",
        `${label(t)} inputType=${inputType} (AX/UIA direct write) value="${valueOf(t)}"`
      );
    }
    lastInputAt.set(t, now);
  },
  true
);

document.addEventListener(
  "change",
  (e) => {
    const t = e.target;
    if (!editable(t)) return;
    // Signal C - Chromium: the AX/UIA direct write dispatches `change`
    // immediately, while the field is still focused. A human `change` only
    // ever fires on blur.
    if (document.activeElement === t) {
      record(
        "SIGNAL C: change while field is still focused",
        `${label(t)} (Chromium AX/UIA direct write) value="${valueOf(t)}"`
      );
    }
  },
  true
);

export {};
