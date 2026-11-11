<script>
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'
  export let Plugin
  setContext('sdk', {
    styleable: () => ({}), builderStore: writable({inBuilder:false}),
    API: {
      fetchQueryDefinition: async () => ({datasourceId:'ds',readable:false,parameters:[{name:'name'},{name:'email'}]}),
      executeQuery: async (id, payload) => { window.calls.push({id,...payload}); return {data:[]} }
    }
  })
  setContext('component', writable({styles:{}}))
</script>
<svelte:component this={Plugin} queryId="query_test" parameterMapping={'{"name":"full_name"}'} />
