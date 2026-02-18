"use strict";
/**
 * YouTube Studio Browser Helpers
 *
 * Functions that return injectable JavaScript strings for page.evaluate().
 * These run in the BROWSER context (not Node.js) and handle YouTube Studio's
 * Lit/Polymer Shadow DOM architecture.
 *
 * @author Barrios A2I
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.litClickByTextScript = exports.litClickScript = exports.litTagInputScript = exports.litTextInputScript = exports.waitForTextScript = exports.waitForDeepElementScript = exports.deepQueryScript = void 0;
/**
 * Returns JS that recursively walks all shadow roots to find the first
 * element matching the given CSS selector.
 * Returns: HTMLElement | null
 */
function deepQueryScript(selector) {
    const escaped = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepQuery(root, sel) {
    var el = root.querySelector(sel);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = deepQuery(all[i].shadowRoot, sel);
        if (found) return found;
      }
    }
    return null;
  }
  var result = deepQuery(document, '${escaped}');
  return result ? result.outerHTML.slice(0, 200) : null;
})()`;
}
exports.deepQueryScript = deepQueryScript;
/**
 * Returns JS that polls for an element (piercing shadow DOM) until found or timeout.
 * Returns: Promise<string> — element outerHTML snippet or 'TIMEOUT'
 */
function waitForDeepElementScript(selector, timeoutMs = 10000) {
    const escaped = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepQuery(root, sel) {
    var el = root.querySelector(sel);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = deepQuery(all[i].shadowRoot, sel);
        if (found) return found;
      }
    }
    return null;
  }
  return new Promise(function(resolve) {
    var deadline = Date.now() + ${timeoutMs};
    function check() {
      var el = deepQuery(document, '${escaped}');
      if (el) return resolve(el.outerHTML.slice(0, 200));
      if (Date.now() > deadline) return resolve('TIMEOUT');
      setTimeout(check, 500);
    }
    check();
  });
})()`;
}
exports.waitForDeepElementScript = waitForDeepElementScript;
/**
 * Returns JS that finds a visible element containing the given text,
 * piercing all shadow roots. Useful for finding buttons by label.
 * Returns: { found: boolean, tag: string, text: string } | null
 */
function waitForTextScript(text, timeoutMs = 10000) {
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepTextSearch(root, searchText) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    var node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        var found = deepTextSearch(node.shadowRoot, searchText);
        if (found) return found;
      }
      var directText = '';
      for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeType === 3) directText += node.childNodes[i].textContent;
      }
      if (directText.trim().toLowerCase().includes(searchText.toLowerCase())) {
        var rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return { found: true, tag: node.tagName, text: directText.trim().slice(0, 100) };
        }
      }
    }
    return null;
  }
  return new Promise(function(resolve) {
    var deadline = Date.now() + ${timeoutMs};
    function check() {
      var result = deepTextSearch(document, '${escaped}');
      if (result) return resolve(JSON.stringify(result));
      if (Date.now() > deadline) return resolve(JSON.stringify({ found: false, text: 'TIMEOUT' }));
      setTimeout(check, 500);
    }
    check();
  });
})()`;
}
exports.waitForTextScript = waitForTextScript;
/**
 * Returns JS that properly types text into a Lit/Polymer input element.
 * Fires the full event chain that Lit's two-way data binding requires.
 * Returns: { success: boolean, message: string }
 */
function litTextInputScript(selector, text) {
    const escapedSel = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedText = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepQuery(root, sel) {
    var el = root.querySelector(sel);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = deepQuery(all[i].shadowRoot, sel);
        if (found) return found;
      }
    }
    return null;
  }
  var el = deepQuery(document, '${escapedSel}');
  if (!el) return JSON.stringify({ success: false, message: 'Element not found: ${escapedSel}' });

  // Focus
  el.focus();
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

  // Clear existing value
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));

  // Type each character
  var text = '${escapedText}';
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: 'Key' + ch.toUpperCase(), bubbles: true, composed: true }));
    el.dispatchEvent(new InputEvent('beforeinput', { data: ch, inputType: 'insertText', bubbles: true, composed: true }));
    el.value += ch;
    el.dispatchEvent(new InputEvent('input', { data: ch, inputType: 'insertText', bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, code: 'Key' + ch.toUpperCase(), bubbles: true, composed: true }));
  }

  // Blur to trigger change
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

  return JSON.stringify({ success: true, message: 'Typed ' + text.length + ' characters' });
})()`;
}
exports.litTextInputScript = litTextInputScript;
/**
 * Returns JS that types a tag string and presses Enter to create a chip/token.
 * Used for YouTube Studio's tag input fields.
 * Returns: { success: boolean, message: string }
 */
function litTagInputScript(selector, tag) {
    const escapedSel = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const escapedTag = tag.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepQuery(root, sel) {
    var el = root.querySelector(sel);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = deepQuery(all[i].shadowRoot, sel);
        if (found) return found;
      }
    }
    return null;
  }
  var el = deepQuery(document, '${escapedSel}');
  if (!el) return JSON.stringify({ success: false, message: 'Tag input not found: ${escapedSel}' });

  el.focus();
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));

  // Type the tag text
  var text = '${escapedTag}';
  el.value = text;
  el.dispatchEvent(new InputEvent('input', { data: text, inputType: 'insertText', bubbles: true, composed: true }));

  // Press Enter to create chip
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, composed: true }));
  el.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, composed: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, composed: true }));

  return JSON.stringify({ success: true, message: 'Tag created: ' + text });
})()`;
}
exports.litTagInputScript = litTagInputScript;
/**
 * Returns JS that clicks a Lit/Polymer element with the proper event chain.
 * Dispatches mousedown → mouseup → click for Polymer compatibility.
 * Returns: { success: boolean, message: string }
 */
function litClickScript(selector) {
    const escaped = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepQuery(root, sel) {
    var el = root.querySelector(sel);
    if (el) return el;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].shadowRoot) {
        var found = deepQuery(all[i].shadowRoot, sel);
        if (found) return found;
      }
    }
    return null;
  }
  var el = deepQuery(document, '${escaped}');
  if (!el) return JSON.stringify({ success: false, message: 'Element not found: ${escaped}' });

  var rect = el.getBoundingClientRect();
  var x = rect.left + rect.width / 2;
  var y = rect.top + rect.height / 2;
  var opts = { bubbles: true, composed: true, clientX: x, clientY: y };

  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));

  return JSON.stringify({ success: true, message: 'Clicked ' + el.tagName + ' at (' + Math.round(x) + ',' + Math.round(y) + ')' });
})()`;
}
exports.litClickScript = litClickScript;
/**
 * Returns JS that finds a visible element by text content (piercing shadow DOM)
 * and clicks it with the Lit/Polymer event chain.
 * Returns: { success: boolean, message: string }
 */
function litClickByTextScript(text) {
    const escaped = text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `
(function() {
  function deepTextFind(root, searchText) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    var node;
    while (node = walker.nextNode()) {
      if (node.shadowRoot) {
        var found = deepTextFind(node.shadowRoot, searchText);
        if (found) return found;
      }
      var directText = '';
      for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeType === 3) directText += node.childNodes[i].textContent;
      }
      if (directText.trim().toLowerCase().includes(searchText.toLowerCase())) {
        var rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return node;
      }
    }
    return null;
  }
  var el = deepTextFind(document, '${escaped}');
  if (!el) return JSON.stringify({ success: false, message: 'No visible element with text: ${escaped}' });

  var rect = el.getBoundingClientRect();
  var x = rect.left + rect.width / 2;
  var y = rect.top + rect.height / 2;
  var opts = { bubbles: true, composed: true, clientX: x, clientY: y };

  el.dispatchEvent(new MouseEvent('mousedown', opts));
  el.dispatchEvent(new MouseEvent('mouseup', opts));
  el.dispatchEvent(new MouseEvent('click', opts));

  return JSON.stringify({ success: true, message: 'Clicked "' + '${escaped}' + '" (' + el.tagName + ')' });
})()`;
}
exports.litClickByTextScript = litClickByTextScript;
//# sourceMappingURL=studio-browser-helpers.js.map