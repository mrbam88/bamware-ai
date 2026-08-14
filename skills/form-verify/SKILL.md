---
name: form-verify
description: Prove a web form is actually filled before submitting, defeating the React-state-versus-DOM bug where a field looks populated but the app never registered it. Use after filling any job application or multi-step web form, and whenever a submit fails validation on fields that appear complete.
---

# Form verification

A filled-looking field is not a filled field. React and similar frameworks track
state separately from the DOM. Setting `value` directly updates what you see and
not what the app submits, so the application posts blank.

## The loop

1. **Fill** by ref, never by coordinate. Coordinates drift on reflow.
2. **Verify in JS.** Read every input, select, textarea, and combobox back and
   compare to intended values.
3. **Repair by keystroke.** For each mismatch, focus the element and type, so
   the framework's own handlers fire.
4. **Re-verify LAST.** The final action before handing over is always a fresh
   read, never a repair.

## Verify snippet

```js
Array.from(document.querySelectorAll('input,select,textarea'))
  .filter(e => e.type !== 'hidden')
  .map(e => ({ name: e.name || e.id || e.getAttribute('aria-label'),
               type: e.type, value: e.value, required: e.required }))
```

## Rules

- Extend verification to selects and comboboxes, not just text inputs. This was
  the known gap after batch 2.
- Re-scan the whole form after every selection. Conditional questions appear
  late — the race question only renders after the Hispanic/Latino answer.
- A form is done only when a full top-to-bottom pass finds nothing unanswered.
- Report every field you could not verify. Silence reads as success.
