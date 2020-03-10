<script>
  import {searchFood, getFoodDetails} from './api'

  const metrics = ['grams', 'energy', 'protein']
  const rdi = {
    energy: 2000,
    protein: 50
  }
  const searchThrottleMs = 500

  let daysNeeded = 14
  let numPeople = 2
  let pendingName = ''
  let pendingQuantity = ''
  let rows = []
  let suggestions = []
  let pendingFoodData
  let foodNameInput
  let searchTimeout

  $: totals = rows.reduce(
    (a, c) => {
      Object.keys(c).forEach(k => (a[k] += c[k]))
      return a
    },
    metrics.reduce((a, c) => {
      a[c] = 0
      return a
    }, {})
  )

  $: perDiemTotals = Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [k, v / daysNeeded / numPeople])
  )

  function getInputWidth(val) {
    return `width:calc(${
      val === undefined ? 1 : val.toString().length
    }ch + 2px)`
  }

  async function addRow() {
    const name = pendingName.trim()
    const quant = parseFloat(pendingQuantity)
    const data = await pendingFoodData

    if (!name || isNaN(quant) || !data) {
      return
    }

    rows = [
      ...rows,
      {
        name,
        grams: quant,
        ...metrics.reduce((a, c) => {
          if (c !== 'grams') {
            a[c] = findNutrientData(c, quant, data)
          }
          return a
        }, {})
      }
    ]

    pendingName = ''
    pendingQuantity = ''
    pendingFoodData = null
    foodNameInput.focus()
  }

  function findNutrientData(query, grams, data) {
    const rx = new RegExp(query, 'i')
    return (
      data.foodNutrients.find(record => rx.test(record.nutrient.name)).amount *
      (grams / 100)
    )
  }

  function checkEnter(e) {
    if (e.key === 'Enter') {
      addRow()
    }
  }

  function onFoodInput() {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(async () => {
      suggestions = (await searchFood(pendingName)).reduce(
        ([names, a], c) => {
          const name = c.description.toLowerCase()

          return !names.includes(name)
            ? [[...names, name], [...a, c]]
            : [names, a]
        },
        [[], []]
      )[1]
    }, searchThrottleMs)
  }

  function setFood(food) {
    pendingName = food.description.toLowerCase()
    pendingFoodData = getFoodDetails(food.fdcId)
    suggestions = []
  }
</script>

<style>
  :root {
    --blue: rgb(0, 50, 252);
  }
  h1 {
    font-size: 3rem;
  }
  #prompt {
    font-size: 2rem;
    margin-bottom: 3rem;
  }

  #prompt input {
    font-size: 2rem;
  }

  input {
    font-size: 1.4rem;
    border: none;
    border-bottom: 3px solid var(--blue);
    position: relative;
    overflow: visible;
  }

  #prompt input::-webkit-outer-spin-button,
  #prompt input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  table {
    font-size: 1.4rem;
    border-collapse: collapse;
    width: 100%;
  }

  thead {
    color: #aaa;
  }

  td {
    border-bottom: 1px solid #ccc;
    padding: 0.8rem 0;
    padding-right: 2rem;
  }

  td em {
    color: #ccc;
  }

  #input-row td {
    border-color: var(--blue);
    padding-bottom: 2rem;
    padding-top: 1.6rem;
  }

  .totals td {
    padding-top: 1rem;
    border-bottom: none;
    position: relative;
    font-weight: bold;
    color: var(--blue);
  }

  .totals td:first-child {
    color: #000;
  }

  .fill {
    border: 1px solid #eee;
    width: 90%;
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: -1;
    transform: translateX(-4px);
  }

  .fill div {
    background-color: #eee;
    height: 100%;
  }

  .suggestions {
    position: absolute;
    background-color: #fff;
    list-style: none;
    padding: 0;
    width: 20rem;
    max-height: 20rem;
    overflow: auto;
    border: 1px solid #ccc;
    margin-top: 0.4rem;
    z-index: 99;
  }

  .suggestions li {
    padding: 1rem;
    font-size: 1.2rem;
    cursor: pointer;
    border-bottom: 1px solid #ccc;
  }

  .suggestions li:hover {
    background-color: #ccc;
    color: #fff;
  }
</style>

<main>
  <h1>Nutrition Planner</h1>
  <p id="prompt">
    Calculate food needed for
    <input
      type="number"
      bind:value={daysNeeded}
      style={getInputWidth(daysNeeded)} />
    day{daysNeeded === 1 ? '' : 's'} for
    <input
      type="number"
      bind:value={numPeople}
      style={getInputWidth(numPeople)} />
    adult{numPeople === 1 ? '' : 's'}:
  </p>

  <table>
    <thead>
      <tr>
        <td>food</td>
        {#each metrics as metric}
          <td>{metric === 'energy' ? 'calories' : metric}</td>
        {/each}
      </tr>
    </thead>
    {#each rows as row}
      <tr>
        <td>{row.name}</td>
        {#each metrics as metric}
          <td>{row[metric]}</td>
        {/each}
      </tr>
    {/each}
    <tr id="input-row">
      <td>
        <input
          placeholder="food name"
          bind:this={foodNameInput}
          bind:value={pendingName}
          on:keydown={checkEnter}
          on:input={onFoodInput} />
        {#if suggestions.length}
          <ul class="suggestions">
            {#each suggestions as suggestion}
              <li on:click={setFood.bind(null, suggestion)}>
                {suggestion.description.toLowerCase()}
              </li>
            {/each}
          </ul>
        {/if}
      </td>
      <td>
        <input
          type="number"
          placeholder="amount in grams"
          bind:value={pendingQuantity}
          on:keydown={checkEnter} />
      </td>
      <td colspan="2">
        <em>press enter to add</em>
      </td>
    </tr>

    {#if rows.length}
      <tr class="totals">
        <td>total:</td>
        {#each metrics as metric}
          <td>{totals[metric].toLocaleString()}</td>
        {/each}
      </tr>

      <tr class="totals">
        <td>per person per day:</td>
        {#each metrics as metric}
          <td>{perDiemTotals[metric].toLocaleString()}</td>
        {/each}
      </tr>

      <tr class="totals">
        <td>% of RDI:</td>

        {#each metrics as metric}
          {#if rdi[metric]}
            <td class="percentage">
              <div class="fill">
                <div
                  style={`width:${Math.min((perDiemTotals[metric] / rdi[metric]) * 100, 100)}%`} />
              </div>
              {Math.round((perDiemTotals[metric] / rdi[metric]) * 100)}%
            </td>
          {:else}
            <td />
          {/if}
        {/each}
      </tr>
    {/if}
  </table>
</main>
