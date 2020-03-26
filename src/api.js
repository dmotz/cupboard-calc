import apiKey from './api-key'

const baseUrl = 'https://api.nal.usda.gov/fdc/v1/'

const keyParam = '?api_key=' + apiKey

export async function searchFood(food) {
  if (!food.trim()) {
    return []
  }

  return (
    (
      await (
        await fetch(
          `${baseUrl}search${keyParam}&generalSearchInput=${encodeURIComponent(
            food
          )}`
        )
      ).json()
    ).foods || []
  )
}

export async function getFoodDetails(id) {
  return (await fetch(`${baseUrl}${id}${keyParam}`)).json()
}
