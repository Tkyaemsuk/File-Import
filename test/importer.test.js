import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFile, prepareImport, runImport, MAX_BYTES } from '../src/importer.js'
const query = { datasourceId: 'ds', readable: false, parameters: [{ name: 'name' }, { name: 'email' }] }

test('CSV handles BOM, Thai, quotes, embedded newline and empty lines without type coercion', () => {
  assert.deepEqual(parseFile('\uFEFFname,email\r\n"สมชาย, ใจดี","a\nb"\r\n\r\n"001",""', 'people.csv'),
    [{name:'สมชาย, ใจดี',email:'a\nb'},{name:'001',email:''}])
})
test('TSV and JSON preserve values', () => {
  assert.deepEqual(parseFile('name\temail\nJane\ta@b', 'a.tsv'), [{ name:'Jane', email:'a@b' }])
  assert.deepEqual(parseFile('[{"id":1,"active":false,"optional":null}]','a.json'), [{id:1,active:false,optional:null}])
})
test('rejects malformed files, dangerous keys and oversized inputs', () => {
  for (const [data, name] of [['a,a\n1,2','a.csv'],['a,b\n1','a.csv'],['a\n"unterminated','a.csv'],['a,\n1,2','a.csv'],['[]','a.json'],['{}','a.json'],['[{"a":{}}]','a.json'],['[{"__proto__":"x"}]','a.json'],['a','a.xlsx']]) {
    assert.throws(() => parseFile(data, name), undefined, `${name}: ${data}`)
  }
  assert.throws(() => parseFile('a'.repeat(MAX_BYTES+1),'a.csv'), /5 MiB/)
  assert.throws(() => parseFile('a\n'+'1\n'.repeat(10001),'a.csv'), /10,000/)
})
test('mapping validates every record and only sends declared parameters', () => {
  const rows = parseFile('full_name,email,ignored\nJane,a@b,secret','a.csv')
  assert.deepEqual(prepareImport(rows,query,'{"name":"full_name"}'),[{name:'Jane',email:'a@b'}])
  assert.throws(() => prepareImport([...rows,{full_name:'bad'}],query,'{"name":"full_name"}'), /Record 2/)
  assert.throws(() => prepareImport(rows,{...query,readable:true}), /write query/)
  assert.throws(() => prepareImport(rows,query,'{"unknown":"email"}'), /Invalid mapping/)
  assert.throws(() => prepareImport(rows,query,'[]'), /JSON object/)
})
test('input containing SQL stays a parameter value', () => {
  const attack = "'); DROP TABLE users;--"
  assert.equal(prepareImport([{name:attack,email:'x'}],query)[0].name,attack)
})
test('stop on error is sequential and does not retry ambiguous writes', async () => {
  const calls = []
  const api = { executeQuery: async (id,opts) => { calls.push([id,opts]); if (calls.length === 2) throw new Error('Disconnected') } }
  const parameters = [{name:'a'},{name:'b'},{name:'c'}]
  const result = await runImport({ api, queryId:'q', parameters })
  assert.equal(result.succeeded,1); assert.equal(result.failed,1); assert.equal(result.processed,2)
  assert.deepEqual(calls,[['q',{parameters:parameters[0]}],['q',{parameters:parameters[1]}]])
  assert.deepEqual(result.errors,[{record:2,message:'Disconnected'}])
})
test('continue after errors reports partial success', async () => {
  const api = { executeQuery:async (_,opts) => { if(opts.parameters.id === 2) throw new Error('Failed') } }
  const result = await runImport({api,queryId:'q',parameters:[{id:1},{id:2},{id:3}],stopOnError:false})
  assert.equal(result.succeeded,2); assert.equal(result.failed,1); assert.equal(result.processed,3)
})
test('cancellation completes in-flight write and skips following writes', async () => {
  let cancel = false
  const api = { executeQuery:async () => { cancel=true } }
  const result = await runImport({api,queryId:'q',parameters:[{id:1},{id:2}],shouldCancel:()=>cancel})
  assert.equal(result.succeeded,1); assert.equal(result.processed,1); assert.equal(result.cancelled,true)
})
