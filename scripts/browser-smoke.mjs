import { rollup } from 'rollup'
import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import { chromium } from '@playwright/test'
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const bundle = await rollup({input:'test/browser/entry.js',plugins:[svelte({emitCss:false}),resolve({browser:true})]})
const {output} = await bundle.generate({format:'iife'})
await bundle.close()
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']})
try {
  const page = await browser.newPage({viewport:{width:1000,height:950}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.setContent('<!doctype html><html><head><meta charset="UTF-8"></head><body style="font-family:Arial;padding:30px;background:#eef2f7"></body></html>')
  await page.addScriptTag({content:output[0].code})
  await page.addScriptTag({content:await fs.readFile('dist/plugin.min.js','utf8')})
  await page.evaluate(()=>window.mountPlugin())
  const upload=page.locator('input[type=file]')
  await upload.setInputFiles('examples/people.csv')
  await page.getByText('สมชาย ใจดี',{exact:true}).waitFor()
  const button=page.getByRole('button',{name:'Import records',exact:true})
  assert.equal(await button.isDisabled(),true)
  await page.getByRole('checkbox').check()
  await button.click()
  await page.getByText('2 succeeded · 0 failed · 0 remaining',{exact:true}).waitFor()
  assert.deepEqual(await page.evaluate(()=>window.calls),[
    {id:'query_test',parameters:{name:'สมชาย ใจดี',email:'somchai@example.com'}},
    {id:'query_test',parameters:{name:'Jane Doe',email:'jane@example.com'}}
  ])
  assert.equal(await button.isDisabled(),true)
  await fs.mkdir('dist',{recursive:true})
  await page.screenshot({path:'dist/browser-smoke.png',fullPage:true})
  await upload.setInputFiles({name:'bad.csv',mimeType:'text/csv',buffer:Buffer.from('full_name,full_name\na,b')})
  await page.getByRole('alert').filter({hasText:'Duplicate column headers.'}).waitFor()
  assert.equal(await page.evaluate(()=>window.calls.length),2)
  assert.deepEqual(errors,[])
  console.log('Browser smoke passed: IIFE registration, Svelte 3 SDK context, UTF-8 file, preview, confirmation, parameter payload, duplicate-submit prevention and malformed-file rejection.')
} finally { await browser.close() }
