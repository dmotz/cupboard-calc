export function formatNum(n, decimals = 0) {
  return parseFloat(n.toFixed(decimals)).toLocaleString()
}

export function getInputWidth(val) {
  return `width:calc(${
    val === undefined || val === '' ? 1 : val.toString().length
  }ch + 3rem)`
}
