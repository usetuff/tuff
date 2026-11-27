import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DOC_TEMPLATES, DocTemplate, fillTemplate, templateDoc } from '../src/index.js'

/* The built-in documents. */

test('every built-in template is written in French too, block for block', () => {
  for (const key of DocTemplate.options) {
    const { en, fr } = DOC_TEMPLATES[key]
    assert.ok(en.name && fr.name && en.said && fr.said, key)
    assert.deepEqual(
      fr.blocks.map((b) => b[0]),
      en.blocks.map((b) => b[0]),
      key,
    )
    assert.notDeepEqual(fr.blocks, en.blocks, `${key} is not translated`)
  }
})

test('a template is the editor’s document, and its placeholders are filled in its words only', () => {
  const { name, body } = templateDoc('report', 'en')
  assert.equal(name, 'Client report {date}')
  const filled = fillTemplate(body, { date: '16 November 2026', project: 'Acme' })
  const text = JSON.stringify(filled)
  assert.match(text, /Acme · 16 November 2026/)
  assert.doesNotMatch(text, /\{date\}|\{project\}/)
  assert.equal(fillTemplate(name, { date: '16 November 2026', project: 'Acme' }), 'Client report 16 November 2026')
  /* An attribute is not words: a link's address is left alone. */
  const link = { type: 'text', text: '{date}', marks: [{ type: 'link', attrs: { href: 'https://x.com/{date}' } }] }
  assert.deepEqual(fillTemplate(link, { date: 'today', project: 'P' }), { ...link, text: 'today' })
  /* A project named with `$` patterns is written as its name. */
  assert.equal(fillTemplate('A {project} B', { date: 'd', project: "$& $` $' $$" }), "A $& $` $' $$ B")
  /* No text is left empty, which a document may not hold. */
  for (const key of DocTemplate.options) {
    for (const lang of ['en', 'fr'] as const) {
      assert.doesNotMatch(JSON.stringify(templateDoc(key, lang).body), /"text":""/)
    }
  }
})
