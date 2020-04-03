<script>
  export let units
  export let value
  export let activeUnit
  export let onChange
  export let onChangeUnit
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
    background-color: var(--input-bg);
    color: var(--dark-blue);
    margin-left: 0.4rem;
    padding: 0.3rem;
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
  }
</style>

<div>
  <input type="number" {value} on:input={onChange} on:change={onChange} />
  {#each units as unit}
    <span
      class="unit"
      class:active={unit === activeUnit}
      on:click={onChangeUnit.bind(null, unit)}>
      {unit}
    </span>
  {/each}
</div>
