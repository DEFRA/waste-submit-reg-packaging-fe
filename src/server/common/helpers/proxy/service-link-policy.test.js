import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const templateRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const templateDirectories = [
  path.join(templateRoot, 'templates'),
  path.join(templateRoot, 'components'),
  path.resolve(templateRoot, '../routes')
]
const rootedLinkPattern = /href\s*[:=]\s*["'`]\/(?!\/)/g

function findNunjucksTemplates(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return findNunjucksTemplates(entryPath)
    }

    return entry.name.endsWith('.njk') ? [entryPath] : []
  })
}

describe('service link template policy', () => {
  test('does not contain hard-coded root-relative links', () => {
    const violations = templateDirectories.flatMap((directory) =>
      findNunjucksTemplates(directory).flatMap((templatePath) => {
        const template = readFileSync(templatePath, 'utf-8')

        return [...template.matchAll(rootedLinkPattern)].map((match) => {
          const line = template.slice(0, match.index).split('\n').length

          return `${path.relative(process.cwd(), templatePath)}:${line}`
        })
      })
    )

    expect(violations).toEqual([])
  })
})
