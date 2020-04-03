<script>
  import {onMount, tick} from 'svelte'
  import {searchFood, getFoodDetails} from './api'
  import {formatNum} from './utils'
  import BarcodeScanner from './BarcodeScanner.svelte'
  import OutputColumn from './OutputColumn.svelte'
  import UnitInput from './UnitInput.svelte'

  const lsKey = 'ls'
  const metrics = ['grams', 'energy', 'protein']
  const nutrientMetrics = metrics.slice(1)
  const searchThrottleMs = 500
  const conversions = {
    g: 1,
    oz: 28.3495,
    lb: 453.592
  }
  const units = Object.keys(conversions)
  const defaults = {people: 1, energy: 2000, protein: 50}
  const ranges = {
    people: [1, 9],
    energy: [1000, 5000],
    protein: [10, 300]
  }

  let numPeople = 1
  let pendingName = ''
  let pendingQuantity = 1
  let targetEnergy = defaults.energy
  let targetProtein = defaults.protein
  let rows = []
  let suggestions = []
  let activeSuggestion = 0
  let showInfo = false
  let didMount = false
  let scannerEnabled = false
  let failedScan = false
  let activeUnit = 'g'
  let pendingFoodData
  let foodNameInput
  let quantityInput
  let suggestionsEl
  let activeSuggestionEl
  let searchTimeout

  $: targetQuantities = {energy: targetEnergy, protein: targetProtein}

  $: totals = rows.reduce(
    (a, c) => {
      nutrientMetrics.forEach(
        k => (a[k] += c[k] * (c.quant * conversions[c.unit]))
      )
      return a
    },
    nutrientMetrics.reduce((a, c) => {
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

  $: dayBlocks = Object.fromEntries(
    nutrientMetrics.map(k => [
      k,
      new Array(isNaN(expectedDays[k]) ? 0 : Math.floor(expectedDays[k]))
        .fill(100)
        .concat(expectedDays[k] ? (expectedDays[k] % 1) * 100 : 0)
    ])
  )

  $: helpText = !pendingFoodData
    ? '👈 type a food in the first field'
    : isNaN(parseFloat(pendingQuantity))
    ? '👈 now enter the amount'
    : 'press the enter key to add'

  $: _ =
    rows &&
    didMount &&
    localStorage.setItem(
      lsKey,
      JSON.stringify({rows, numPeople, targetEnergy, targetProtein})
    )

  function getInputWidth(val) {
    return `width:calc(${
      val === undefined || val === '' ? 1 : val.toString().length
    }ch + 3rem)`
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
        quant,
        unit: activeUnit,
        foodId: data.fdcId,
        ...metrics.reduce((a, c) => {
          if (c !== 'grams') {
            a[c] = findNutrientData(c, quant, data)
          }
          return a
        }, {})
      }
    ]

    pendingName = ''
    pendingQuantity = 1
    pendingFoodData = null
    foodNameInput.focus()
  }

  function findNutrientData(query, grams, data) {
    const rx = new RegExp(query, 'i')
    return (
      data.foodNutrients.find(record => rx.test(record.nutrient.name)).amount /
      100
    )
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

  function onChangeQuant(n, e) {
    const quant = parseFloat(e.target.value)

    if (isNaN(quant) || quant < 0) {
      return
    }

    rows = rows.map((row, i) => (n === i ? {...row, quant} : row))
  }

  function onChangeNewQuant(e) {
    const quant = parseFloat(e.target.value)

    if (isNaN(quant) || quant < 0) {
      return
    }

    pendingQuantity = quant
  }

  function onChangeUnit(n, unit) {
    rows = rows.map((row, i) =>
      n === i
        ? {
            ...row,
            unit,
            quant: Math.round(
              (row.quant * conversions[row.unit]) / conversions[unit]
            )
          }
        : row
    )
  }

  function setFood(food) {
    pendingName = food.description.toLowerCase()
    pendingFoodData = getFoodDetails(food.fdcId)
    suggestions = []
    if (quantityInput) {
      quantityInput.focus()
    }
  }

  function removeRow(n) {
    rows = rows.filter((_, i) => i !== n)
  }

  function setActiveUnit(unit) {
    activeUnit = unit
  }

  function toggleScanner() {
    scannerEnabled = !scannerEnabled
  }

  async function onScan(code) {
    const results = await searchFood(code)
    if (results.length) {
      setFood(results[0])
      failedScan = false
      scannerEnabled = false
    } else {
      failedScan = true
    }
  }

  onMount(() => {
    if (didMount) {
      return
    }

    didMount = true

    try {
      const res = JSON.parse(localStorage.getItem(lsKey))

      if (res.rows && res.numPeople && res.targetEnergy && res.targetProtein) {
        rows = res.rows
        numPeople = res.numPeople
        targetEnergy = res.targetEnergy
        targetProtein = res.targetProtein
      }
    } catch (e) {
      console.log('error restoring data')
    }
  })
</script>

<style>
  header {
    position: relative;
  }

  h1 {
    font-size: 3rem;
  }

  h2 {
    margin-bottom: 1rem;
  }

  h3 {
    color: var(--gray);
    font-weight: normal;
    margin: 1rem 0;
    font-size: 1.4rem;
  }

  table {
    font-size: 1.4rem;
    border-collapse: collapse;
    width: 100%;
    table-layout: fixed;
  }

  thead {
    color: #aaa;
  }

  tr {
    border: 1px solid #ccc;
  }

  thead tr {
    border: none;
  }

  td {
    padding: 0.8rem 0;
    padding-right: 2rem;
    position: relative;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 22rem;
    min-width: 10rem;
  }

  td:first-child {
    text-align: center;
    width: 3rem;
    padding: 0;
  }

  td:nth-child(2) {
    width: 50%;
  }

  td:nth-child(4) {
    width: 3rem;
    padding: 0;
    color: #aaa;
    text-align: center;
  }

  td:last-child {
    padding: 0;
  }

  td a {
    color: #000;
    text-decoration-color: var(--dark-blue);
  }

  .delete {
    font-size: 1rem;
    visibility: hidden;
    cursor: pointer;
    left: 0;
  }

  tr:hover .delete {
    visibility: visible;
  }

  #input-row {
    border: none;
    display: flex;
    margin-top: 2rem;
    padding-left: 2.5rem;
  }

  #input-row > div {
    display: flex;
    align-items: center;
    margin-right: 2rem;
    position: relative;
  }

  #help-text {
    font-size: 1.3rem;
    color: var(--gray);
  }

  .check {
    color: rgb(10, 196, 25);
    visibility: hidden;
    margin-left: 0.4rem;
    font-size: 1.4rem;
  }

  .check.active {
    visibility: visible;
  }

  .suggestions {
    position: absolute;
    background-color: #fff;
    list-style: none;
    padding: 0;
    width: 20rem;
    max-height: 20rem;
    overflow: auto;
    border: 1px solid #000;
    margin-top: 0.4rem;
    z-index: 99;
    top: 100%;
  }

  .suggestions li {
    padding: 1rem;
    font-size: 1.2rem;
    cursor: pointer;
    border-bottom: 1px solid #000;
  }

  .suggestions li:hover,
  .suggestions .active {
    background-color: #aaa;
    color: #fff;
    background-color: #000;
    color: #fff;
  }

  #output {
    display: flex;
    justify-content: space-between;
    padding: 2rem;
    font-size: 1.4rem;
    margin-top: 2rem;
  }

  #info {
    display: flex;
    color: var(--gray);
    line-height: 2;
    min-height: 6rem;
    position: absolute;
    top: 0;
    right: 0;
  }

  #info-button {
    font-size: 1.1rem;
    cursor: pointer;
    margin-left: 1rem;
    width: 1.5rem;
    height: 1.5rem;
    user-select: none;
    border: 1px solid var(--gray);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  #info a {
    color: var(--dark-blue);
  }

  #scanner {
    display: flex;
    align-items: center;
    font-size: 1.1rem;
    padding-left: 2.5rem;
    padding-top: 1rem;
  }

  .start-scan {
    display: inline-block;
    margin-left: 2.5rem;
    margin-top: 0.5rem;
    font-size: 1rem;
    color: var(--dark-blue);
    cursor: pointer;
  }
</style>

<main>
  <header>
    <h2>🍎🥑🥔🥕🥫🥜🍌</h2>
    <h1>Cupboard Calculator</h1>
    <h3>A handy tool for planning your pantry</h3>

    <div id="info">
      {#if showInfo}
        <ul>
          <li>
            Nutritional data sourced from the
            <a href="https://fdc.nal.usda.gov/fdc-app.html#/" target="_blank">
              USDA FoodData Central
            </a>
          </li>

          <li>Remember: nutritional stats can change during cooking</li>

          <li>
            Source code
            <a href="https://github.com/dmotz/foodcalc">here</a>
          </li>
        </ul>
      {/if}
      <div id="info-button" on:click={() => (showInfo = !showInfo)}>?</div>
    </div>
  </header>

  <table>
    <thead>
      <tr>
        <td />
        <td>food</td>
        <td>amount</td>
        <td />
        {#each nutrientMetrics as metric}
          <td>{metric === 'energy' ? 'calories' : metric}</td>
        {/each}
      </tr>
    </thead>

    {#if rows.length}
      {#each rows as row, i}
        <tr>
          <td>
            <span class="delete" on:click={removeRow.bind(null, i)}>🗑</span>
          </td>
          <td>
            <a
              href={`https://fdc.nal.usda.gov/fdc-app.html#/food-details/${row.foodId}/nutrients`}
              target="_blank">
              {row.name}
            </a>
          </td>
          <td>
            <UnitInput
              {units}
              value={row.quant}
              activeUnit={row.unit}
              onChange={onChangeQuant.bind(null, i)}
              onChangeUnit={onChangeUnit.bind(null, i)} />
          </td>
          <td>➡</td>
          {#each nutrientMetrics as metric}
            <td>
              {formatNum(row[metric] * row.quant * conversions[row.unit])}
              {metric !== 'energy' ? 'g' : ''}
            </td>
          {/each}
        </tr>
      {/each}
    {:else}
      <tr>
        <td />
        <td>👇 add a food below</td>
        <td>-</td>
        <td />
        <td>-</td>
        <td>-</td>
      </tr>
    {/if}
  </table>

  <div id="input-row">
    <div>
      <input
        placeholder="food name"
        type="text"
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
    </div>

    <div>
      <input
        type="number"
        placeholder="0"
        bind:value={pendingQuantity}
        bind:this={quantityInput}
        on:keydown={checkEnter}
        class="amount-input"
        style={getInputWidth(pendingQuantity)} />
      {#each units as unit}
        <span
          class="unit"
          class:active={unit === activeUnit}
          on:click={setActiveUnit.bind(null, unit)}>
          {unit}
        </span>
      {/each}
    </div>

    <div id="help-text">{helpText}</div>
  </div>

  {#if !scannerEnabled}
    <span class="start-scan" on:click={toggleScanner}>🔍 scan barcode</span>
  {/if}
  <div id="scanner">
    {#if scannerEnabled}
      <BarcodeScanner {onScan} onClose={toggleScanner} />
      {#if failedScan}
        <span>⚠️ Canʼt find item via barcode, try manually adding.</span>
      {/if}
    {/if}
  </div>

  <section id="output">
    <OutputColumn
      title="Number of people"
      value={numPeople}
      min={ranges.people[0]}
      max={ranges.people[1]}
      onUpdate={n => (numPeople = n)} />

    <OutputColumn
      title="Target calories"
      value={targetEnergy}
      min={ranges.energy[0]}
      max={ranges.energy[1]}
      onUpdate={n => (targetEnergy = n)}
      dayNum={expectedDays.energy}
      dayBlocks={dayBlocks.energy} />

    <OutputColumn
      title="Target protein (g)"
      value={targetProtein}
      min={ranges.protein[0]}
      max={ranges.protein[1]}
      onUpdate={n => (targetProtein = n)}
      dayNum={expectedDays.protein}
      dayBlocks={dayBlocks.protein} />
  </section>

</main>
