<script>
  import {onMount, tick} from 'svelte'
  import {searchFood, getFoodDetails} from './api'
  import Quagga from 'quagga'

  const lsKey = 'ls'
  const metrics = ['grams', 'energy', 'protein']
  const rdi = {
    energy: 2000,
    protein: 50
  }
  const searchThrottleMs = 500

  let numPeople = 1
  let pendingName = ''
  let pendingQuantity = ''
  let pendingMultiplier = 1
  let rows = []
  let suggestions = []
  let activeSuggestion = 0
  let didMount = false
  let pendingFoodData
  let foodNameInput
  let quantityInput
  let multiplierInput
  let suggestionsEl
  let activeSuggestionEl
  let searchTimeout
  let scanning = false
  let barcodeMessage = ''

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
    Object.entries(totals).map(([k, v]) => [k, v / numPeople])
  )

  $: helpText = !pendingFoodData
    ? '👈 type a food in the first field'
    : isNaN(parseFloat(pendingQuantity))
    ? '👈 now enter the amount in grams'
    : 'press the enter key to add'

  $: _ =
    rows &&
    didMount &&
    localStorage.setItem(lsKey, JSON.stringify({rows, numPeople}))

  function getInputWidth(val) {
    return `width:calc(${
      val === undefined ? 1 : val.toString().length
    }ch + 2px)`
  }

  function formatNum(n, d = 0) {
    return (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString()
  }

  let a = new AudioContext()

  function beep(vol, freq, duration) {
    let v = a.createOscillator()
    let u = a.createGain()
    v.connect(u)
    v.frequency.value = freq
    v.type = 'square'
    u.connect(a.destination)
    u.gain.value = vol * 0.01
    v.start(a.currentTime)
    v.stop(a.currentTime + duration * 0.001)
  }

  async function addRow() {
    const name = pendingName.trim()
    const quant = parseFloat(pendingQuantity)
    const mult = parseFloat(pendingMultiplier)
    const data = await pendingFoodData

    if (!name || isNaN(quant) || !data) {
      return
    }

    rows = [
      ...rows,
      {
        name,
        grams: quant * mult,
        ...metrics.reduce((a, c) => {
          if (c !== 'grams') {
            a[c] = findNutrientData(c, quant * mult, data)
          }
          return a
        }, {})
      }
    ]

    pendingName = ''
    pendingQuantity = ''
    pendingMultiplier = 1
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

  function onStartScan() {
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: document.querySelector('#liveview')
        },
        multiple: false,
        debug: {
          drawBoundingBox: true
        },
        decoder: {
          readers: ['upc_reader']
        }
      },
      function(err) {
        if (err) {
          console.log(err)
          return
        }
        console.log('Initialization finished. Ready to start')
        scanning = true
        Quagga.start()
      }
    )

    Quagga.onDetected(async res => {
      if (!scanning) return
      scanning = false
      barcodeMessage = 'Searching...'
      beep(5, 520, 200)
      suggestions = await searchFood(res.codeResult.code)
      if (suggestions.length > 0) {
        setFood(suggestions[0])
        barcodeMessage = 'Found item'
      } else {
        barcodeMessage = " ❌ Didn't find product"
      }

      setTimeout(() => {
        scanning = true
      }, 2000)
    })
  }

  onMount(() => {
    if (didMount) {
      return
    }

    didMount = true

    try {
      const res = JSON.parse(localStorage.getItem(lsKey))

      if (res.rows && res.numPeople) {
        rows = res.rows
        numPeople = res.numPeople
      }
    } catch (e) {
      console.log('error restoring data')
    }

    onStartScan()
  })
</script>

<style>
  :root {
    --blue: rgb(0, 50, 252);
  }

  h1 {
    font-size: 3rem;
  }

  button {
    border: 1px solid var(--blue);
    background: transparent;
    color: var(--blue);
  }

  button:hover {
    background-color: var(--blue);
    color: white;
  }

  .subtitle {
    font-size: 1.7rem;
    margin-top: 5rem;
  }

  #settings {
    display: flex;
    align-items: center;
    font-size: 1.6rem;
    margin-top: 3rem;
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

  .check {
    color: rgb(10, 196, 25);
    visibility: hidden;
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

  #add-food-modal {
    border: 1px solid #ccc;
    margin-top: 2rem;
    display: flex;
  }
  #add-food-modal > div {
    padding: 1rem;
    position: relative;
  }
  #add-food-modal-barcode {
    width: 300px;
  }

  #liveview {
    position: relative;
  }
  #barcode-result {
    width: 100%;
    height: 100%;
    position: absolute;
    background-color: rgba(0, 0, 0, 0.5);
    top: 0;
    z-index: 100;
    color: white;
  }
  #barcode-result span {
    top: 50%;
    transform: translateY(-50%);
    position: absolute;
    text-align: center;
    width: 100%;
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
          <td>{formatNum(row[metric])} g</td>
        {/each}
      </tr>
    {/each}

    <!-- <tr id="input-row">
      <td>
        <button class="scanner" on:click={onScan}>📸</button>
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
          placeholder="amount in grams"
          bind:value={pendingQuantity}
          bind:this={quantityInput}
          on:keydown={checkEnter} />
      </td>

      <td colspan="2">
        <em>{helpText}</em>
      </td>
    </tr> -->

    <!-- {#if rows.length}
      <tr class="totals">
        <td>total:</td>
        {#each metrics as metric}
          <td>{formatNum(totals[metric])}</td>
        {/each}
      </tr>

      <tr class="totals">
        <td>per person per day:</td>
        {#each metrics as metric}
          <td>{formatNum(perDiemTotals[metric])}</td>
        {/each}
      </tr>

      <tr class="totals">
        <td>daily %:</td>

        {#each metrics as metric}
          {#if rdi[metric]}
            <td class="percentage">
              <div class="fill">
                <div
                  style={`width:${Math.min((perDiemTotals[metric] / rdi[metric]) * 100, 100)}%`} />
              </div>
              {formatNum((perDiemTotals[metric] / rdi[metric]) * 100)}%
            </td>
          {:else}
            <td />
          {/if}
        {/each}
      </tr>
    {/if} -->
  </table>

  <!-- <button id="add-button" on:click={showAddFoodModal.bind(null)}>+ Add food</button> -->

  <div id="add-food-modal">
    <div id="add-food-modal-barcode">
      <p>Scan barcode</p>
      <div id="liveview">
        {#if !scanning}
          <div id="barcode-result">
            <span>{barcodeMessage}</span>
          </div>
        {/if}
      </div>
    </div>

    <div id="add-food-model-manual">
      <p>Enter Manually</p>

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

      <input
        type="number"
        placeholder="amount in grams"
        bind:value={pendingQuantity}
        bind:this={quantityInput}
        on:keydown={checkEnter} />
      X
      <input
        type="number"
        placeholder="count"
        style="width:5rem"
        bind:value={pendingMultiplier}
        bind:this={multiplierInput}
        on:keydown={checkEnter} />
      <br />
      <br />
      <button on:click={addRow}>Add</button>

    </div>

  </div>

  <p class="subtitle">Your household:</p>

  <p class="text">How many people are in your household?</p>

  <div id="settings">
    <div>
      <input type="range" min="1" max="9" bind:value={numPeople} />
      <label>
        🙂
        <span>{numPeople}</span>
        {numPeople === 1 ? 'person' : 'people'}
      </label>
    </div>
    <!-- <div>
      <input type="range" min="1" max="60" bind:value={daysNeeded} />
      <label>
        📅
        <span>{daysNeeded}</span>
        day{daysNeeded === 1 ? '' : 's'}
      </label>
    </div> -->
  </div>

  {#each metrics as metric}
    {#if rdi[metric]}
      <p class="text">
        This will cover {formatNum(perDiemTotals[metric] / rdi[metric], 1)} days
        of {metric === 'energy' ? 'calorie' : metric} intake
      </p>
      <!-- <td class="percentage">
      <div class="fill">
        <div
          style={`width:${Math.min((perDiemTotals[metric] / rdi[metric]) * 100, 100)}%`} />
      </div>
      {formatNum((perDiemTotals[metric] / rdi[metric]) * 100)}%
    </td> -->
    {:else}
      <!-- <td /> -->
    {/if}
  {/each}
</main>
