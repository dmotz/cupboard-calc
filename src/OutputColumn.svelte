<script>
  import {formatNum} from './utils'

  export let title
  export let value
  export let min
  export let max
  export let onUpdate
  export let dayNum = NaN
  export let dayBlocks = []

  function onValChange(e) {
    const n = parseFloat(e.target.value)
    if (!isNaN(n)) {
      onUpdate(n)
    }
  }
</script>

<style>
  .col {
    flex: 1 1 0;
    padding: 0 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.4rem;
    font-weight: bold;
  }

  input[type='range'] {
    margin-bottom: 1.6rem;
  }

  .day-count {
    margin-top: 4rem;
    padding-top: 0.4rem;
    border-top: 1px solid var(--gray);
    padding-top: 1rem;
    color: var(--green);
    font-size: 2rem;
  }

  .day-block {
    display: inline-block;
    width: 0.8rem;
    height: 0.8rem;
    margin: 0.05rem 0.1rem;
    margin: 1px 1px;
  }

  .day-block div {
    background-color: var(--green2);
    height: 100%;
  }
</style>

<div class="col">
  <label>{title}</label>

  <div class="inputs">
    <input type="range" on:input={onValChange} {min} {max} {value} />
    <input type="number" on:input={onValChange} {min} {max} {value} />
  </div>

  {#if !isNaN(dayNum)}
    <div class="day-count">
      <p>{formatNum(dayNum, 1)} days</p>
      <div class="days">
        {#each dayBlocks as pct}
          <div class="day-block">
            <div style={`width:${pct}%`} />
          </div>
        {/each}
      </div>
    </div>
  {:else}
    <span>{new Array(value).fill('🙂').join('')}</span>
  {/if}
</div>
