<script>
  import {onMount, onDestroy} from 'svelte'
  import Quagga from 'quagga'

  export let onScan
  export let onClose

  let scanning = false
  let aCtx
  let scannerEl

  function beep() {
    if (!aCtx) {
      aCtx = new AudioContext()
    }

    const osc = aCtx.createOscillator()
    const gain = aCtx.createGain()

    osc.connect(gain)
    osc.frequency.value = 520
    osc.type = 'square'
    gain.connect(aCtx.destination)
    gain.gain.value = 0.05
    osc.start(aCtx.currentTime)
    osc.stop(aCtx.currentTime + 0.2)
  }

  onMount(() => {
    Quagga.init(
      {
        inputStream: {
          target: scannerEl
        },
        multiple: false,
        decoder: {
          readers: ['upc_reader']
        }
      },
      err => {
        if (err) {
          console.log(err)
          return
        }
        scanning = true
        Quagga.start()
      }
    )
    Quagga.onDetected(res => {
      if (!scanning) {
        return
      }
      scanning = false

      onScan(res.codeResult.code)
      beep()
      setTimeout(() => (scanning = true), 2000)
    })
  })

  onDestroy(() => Quagga.stop())
</script>

<style>
  .root {
    width: 16rem;
    display: inline-block;
    margin-right: 1.5rem;
    position: relative;
  }

  .scan-view {
    display: inline-block;
    height: 12rem;
    background-color: #000;
    font-size: 0;
  }

  .close {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    z-index: 9;
    cursor: pointer;
  }
</style>

<div class="root">
  <div class="close" on:click={onClose}>❌</div>
  <div class="scan-view" bind:this={scannerEl} />
</div>
