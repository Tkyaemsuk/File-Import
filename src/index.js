import Component from './Component.svelte'
import schema from '../schema.json'
const plugin = { Component, schema, version: '1.0.0' }
if (typeof window !== 'undefined') {
  const registry = window['##BUDIBASE_CUSTOM_COMPONENTS##'] ||= []
  registry.push(plugin)
  if (window.registerCustomComponent) window.registerCustomComponent(plugin)
}
export { Component, schema }
export const version = '1.0.0'
