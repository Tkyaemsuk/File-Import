import * as svelte from 'svelte'
import * as internal from 'svelte/internal'
import Host from './Host.svelte'
window.svelte = svelte
window.svelte_internal = internal
window.calls = []
window.mountPlugin = () => new Host({target: document.body,props:{Plugin:window['##BUDIBASE_CUSTOM_COMPONENTS##'][0].Component}})
