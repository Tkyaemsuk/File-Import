import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import * as tar from 'tar'
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'))
const schema = JSON.parse(await fs.readFile('schema.json', 'utf8'))
schema.version = pkg.version
schema.hash = crypto.createHash('sha1').update(await fs.readFile('dist/plugin.min.js')).digest('hex')
await fs.writeFile('dist/schema.json', JSON.stringify(schema, null, 2))
await fs.copyFile('package.json', 'dist/package.json')
await tar.c({ gzip: true, cwd: 'dist', file: `dist/${pkg.name}-${pkg.version}.tar.gz` }, ['plugin.min.js', 'schema.json', 'package.json'])
