<script>
  import {createEventDispatcher, onMount} from 'svelte'

  export let units
  export let value
  export let activeUnit
  export let onChange
  export let onChangeUnit
  export let onEnterKey = () => null
  export let bindInput = false

  const dispatch = createEventDispatcher()

  let input

  $: displayVal = Math.round(value)

  function checkEnter(e) {
    if (e.key === 'Enter') {
      onEnterKey()
    }
  }

  onMount(() => {
    if (bindInput) {
      dispatch('element', {
        input
      })
    }
  })
</script>

<style>
  div {
    display: inline-block;
  }

  input {
    width: 6rem;
  }

  .unit {
    cursor: pointer;
    color: var(--dark-blue);
    margin-left: 0.4rem;
    font-size: 1.2rem;
    padding-top: 0.2rem;
    display: inline-block;
    font-weight: bold;
    text-align: center;
    opacity: 0.33;
    border-radius: 4px;
  }

  .unit.active {
    opacity: 1;
    text-decoration: underline;
  }
</style>

<div>
  <input
    type="number"
    value={displayVal}
    bind:this={input}
    on:input={onChange}
    on:change={onChange}
    on:keydown={checkEnter} />
  {#each units as unit}
    <span
      class="unit"
      class:active={unit === activeUnit}
      on:click={onChangeUnit.bind(null, unit)}>
      {unit}
    </span>
  {/each}
</div>
