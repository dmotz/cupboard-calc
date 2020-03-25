<script>
  import {onMount, tick} from 'svelte'
  import {searchFood, getFoodDetails} from './api'

  const lsKey = 'ls'
  const metrics = ['grams', 'energy', 'protein']
  const rdi = {
    energy: 2000,
    protein: 50
  }
  const searchThrottleMs = 500

  let daysNeeded = 7
  let numPeople = 1
  let pendingName = ''
  let pendingQuantity = ''
  let targetEnergy = 2000
  let targetProtein = 50
  let rows = []
  let suggestions = []
  let activeSuggestion = 0
  let didMount = false
  let pendingFoodData
  let foodNameInput
  let quantityInput
  let suggestionsEl
  let activeSuggestionEl
  let searchTimeout

  $: targetQuantities = {energy: targetEnergy, protein: targetProtein}

  $: totals = rows.reduce(
    (a, c) => {
      Object.keys(c).forEach(k => (a[k] += c[k]))
      return a
    },
    metrics.slice(1).reduce((a, c) => {
      a[c] = 0
      return a
    }, {})
  )

  $: expectedDays = Object.fromEntries(
    Object.entries(totals).map(([k, v]) => [
      k,
      v / targetQuantities[k] / numPeople
    ])
  )

  $: helpText = !pendingFoodData
    ? '👈 type a food in the first field'
    : isNaN(parseFloat(pendingQuantity))
    ? '👈 now enter the amount in grams'
    : 'press the enter key to add'

  $: _ =
    rows &&
    didMount &&
    localStorage.setItem(lsKey, JSON.stringify({rows, numPeople, daysNeeded}))

  function getInputWidth(val) {
    return `width:calc(${
      val === undefined ? 1 : val.toString().length
    }ch + 2px)`
  }

  function formatNum(n) {
    return Math.round(n).toLocaleString()
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

  async function onFoodInputKey(e) {
    if (e.key === 'Enter') {
      setFood(suggestions[activeSuggestion])
      return
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      activeSuggestion += e.key === 'ArrowDown' ? 1 : -1

      if (activeSuggestion < 0) {
        activeSuggestion = suggestions.length - 1
      }

      if (activeSuggestion >= suggestions.length) {
        activeSuggestion = 0
      }

      pendingName = suggestions[activeSuggestion].description.toLowerCase()
      await tick()
      activeSuggestionEl.scrollIntoView()
    }
  }

  function onFoodInput() {
    pendingFoodData = null
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

  async function onFoodInputBlur() {
    await new Promise(res => setTimeout(res, 200))
    suggestions = []
    activeSuggestion = 0

    if (!pendingFoodData) {
      pendingName = ''
    }
  }

  function setFood(food) {
    pendingName = food.description.toLowerCase()
    pendingFoodData = getFoodDetails(food.fdcId)
    suggestions = []
    quantityInput.focus()
  }

  function removeRow(n) {
    rows = rows.filter((_, i) => i !== n)
  }

  onMount(() => {
    if (didMount) {
      return
    }

    didMount = true

    try {
      const res = JSON.parse(localStorage.getItem(lsKey))

      if (res.rows && res.numPeople && res.daysNeeded) {
        rows = res.rows
        numPeople = res.numPeople
        daysNeeded = res.daysNeeded
      }
    } catch (e) {
      console.log('error restoring data')
    }
  })
</script>

<style>
  :root {
    --blue: rgb(0, 50, 252);
  }

  h1 {
    font-size: 3rem;
  }

  #intro {
    font-size: 1.7rem;
  }

  #settings {
    display: flex;
    align-items: center;
    font-size: 1.6rem;
    margin-bottom: 3rem;
    color: #888;
  }

  #settings div {
    margin-right: 1.5rem;
    text-align: center;
  }

  #settings input {
    display: block;
    width: 12rem;
  }

  #settings label {
    color: #000;
    margin-top: 1rem;
    display: block;
  }

  #settings span {
    color: var(--blue);
    font-weight: bold;
    margin-left: 0.4rem;
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
    position: relative;
  }

  td:first-child {
    padding-left: 2rem;
  }

  td input {
    font-size: 1.4rem;
    border: none;
    border-bottom: 3px solid var(--blue);
    position: relative;
    overflow: visible;
  }

  td em {
    color: #ccc;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateX(-50%) translateY(-50%);
    width: 100%;
  }

  .delete {
    font-size: 1rem;
    visibility: hidden;
    cursor: pointer;
    position: absolute;
    left: 0;
  }

  tr:hover .delete {
    visibility: visible;
  }

  #input-row td {
    border-color: var(--blue);
    padding-bottom: 2rem;
    padding-top: 1.6rem;
  }

  .check {
    color: rgb(10, 196, 25);
    visibility: hidden;
  }

  .check.active {
    visibility: visible;
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
    border: 1px solid #aaa;
    margin-top: 0.4rem;
    z-index: 99;
  }

  .suggestions li {
    padding: 1rem;
    font-size: 1.2rem;
    cursor: pointer;
    border-bottom: 1px solid #aaa;
  }

  .suggestions li:hover,
  .suggestions .active {
    background-color: #aaa;
    color: #fff;
  }
</style>

<main>
  <h2>🍎🥑🥔🥕🥫🥜🍌</h2>
  <h1>Cupboard Calculator</h1>
  <h3>Get an estimate for how long your food will last</h3>

  <table>
    <thead>
      <tr>
        <td>food</td>

        {#each metrics as metric}
          <td>{metric === 'energy' ? 'calories' : metric}</td>
        {/each}
      </tr>
    </thead>

    {#each rows as row, i}
      <tr>
        <td>
          <span class="delete" on:click={removeRow.bind(null, i)}>❌</span>
          {row.name}
        </td>

        {#each metrics as metric}
          <td>{formatNum(row[metric])}</td>
        {/each}
      </tr>
    {/each}

    <tr id="input-row">
      <td>
        <input
          placeholder="food name"
          spellcheck="false"
          bind:this={foodNameInput}
          bind:value={pendingName}
          on:keydown={onFoodInputKey}
          on:input={onFoodInput}
          on:blur={onFoodInputBlur} />
        <span class="check" class:active={pendingFoodData}>✓</span>

        {#if suggestions.length}
          <ul class="suggestions" bind:this={suggestionsEl}>
            {#each suggestions as suggestion, i}
              {#if i === activeSuggestion}
                <li
                  on:click={setFood.bind(null, suggestion)}
                  bind:this={activeSuggestionEl}
                  class="active">
                  {suggestion.description.toLowerCase()}
                </li>
              {:else}
                <li on:click={setFood.bind(null, suggestion)}>
                  {suggestion.description.toLowerCase()}
                </li>
              {/if}
            {/each}
          </ul>
        {/if}
      </td>

      <td>
        <input
          type="number"
          placeholder="0"
          bind:value={pendingQuantity}
          bind:this={quantityInput}
          on:keydown={checkEnter} />
        {#each units as unit}
          <span
            class="measurement"
            class:active={unit === activeUnit}
            on:click={setActiveUnit.bind(null, unit)}>
            {unit}
          </span>
        {/each}
      </td>

      <td colspan="2">
        <em>{helpText}</em>
      </td>
    </tr>
  </table>

  <section id="output">
    <div>
      <label>How many people?</label>
      <input type="number" bind:value={numPeople} />
    </div>

    <div>
      <label>Target protein per day</label>
      <input type="number" bind:value={targetProtein} />
      <span>g per day</span>

      <div>{expectedDays.protein} days</div>
    </div>

    <div>
      <label>Target calories per day</label>
      <input type="number" bind:value={targetEnergy} />
      <span>per day</span>

      <div>{expectedDays.energy} days</div>
    </div>
  </section>
</main>
