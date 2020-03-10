<script>
  const metrics = ['grams', 'protein', 'calories']
  const rdi = {
    calories: 2000,
    protein: 100
  }

  let daysNeeded = 14
  let numPeople = 2
  let pendingName = ''
  let pendingQuantity = ''
  let rows = []
  let foodNameInput

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

  function addRow() {
    const name = pendingName.trim()
    const quant = parseFloat(pendingQuantity)

    if (!name || isNaN(quant)) {
      return
    }

    rows = [
      ...rows,
      {
        name,
        grams: quant,
        protein: Math.round(Math.random() * 40),
        calories: Math.round(Math.random() * 400)
      }
    ]
    pendingName = ''
    pendingQuantity = ''
    foodNameInput.focus()
  }

  function checkEnter(e) {
    if (e.key === 'Enter') {
      addRow()
    }
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
        <td>Food</td>
        {#each metrics as metric}
          <td>{metric}</td>
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
          on:keydown={checkEnter} />
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
        <td />
        {#each metrics as metric}
          {#if rdi[metric]}
            <td class="percentage">
              <div class="fill">
                <div
                  style={`width:${(perDiemTotals[metric] / rdi[metric]) * 100}%`} />
              </div>
              {Math.round((perDiemTotals[metric] / rdi[metric]) * 100)}%
            </td>
          {/if}
        {/each}
      </tr>
    {/if}
  </table>
</main>
