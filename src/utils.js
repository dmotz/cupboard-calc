export function formatNum(n, decimals = 0) {
  return parseFloat(n.toFixed(decimals)).toLocaleString()
}
