import apiKey from './api-key'

export async function searchFood(food) {
  if (!food.trim()) {
    return []
  }

  return (
    (
      await (
        await fetch(
          `https://api.nal.usda.gov/fdc/v1/search?api_key=${apiKey}&generalSearchInput=${encodeURIComponent(
            food
          )}`
        )
      ).json()
    ).foods || []
  )
}
