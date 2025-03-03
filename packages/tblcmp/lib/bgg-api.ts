import { XMLParser } from "fast-xml-parser"
import type { Game } from "./types"

const BGG_API_BASE = "https://boardgamegeek.com/xmlapi2"
const parser = new XMLParser({ ignoreAttributes: false })

export async function searchGames(query: string): Promise<Game[]> {
  try {
    const response = await fetch(`${BGG_API_BASE}/search?query=${encodeURIComponent(query)}&type=boardgame`)

    if (!response.ok) {
      throw new Error(`BGG API error: ${response.status}`)
    }

    const xml = await response.text()
    const result = parser.parse(xml)

    if (!result.items || !result.items.item) {
      return []
    }

    const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item]

    return items.map((item: any) => ({
      id: item["@_id"],
      name: item.name?.["@_value"] || "Unknown Game",
      yearPublished: item.yearpublished?.["@_value"] || null,
      // These will be filled in by getGameDetails
      image: null,
      minPlayers: null,
      maxPlayers: null,
      minPlaytime: null,
      maxPlaytime: null,
      rating: null,
    }))
  } catch (error) {
    console.error("Error searching games:", error)
    return []
  }
}

export async function getGameDetails(gameId: string): Promise<Game | null> {
  try {
    const response = await fetch(`${BGG_API_BASE}/thing?id=${gameId}&stats=1`)

    if (!response.ok) {
      throw new Error(`BGG API error: ${response.status}`)
    }

    const xml = await response.text()
    const result = parser.parse(xml)

    if (!result.items || !result.items.item) {
      return null
    }

    const item = result.items.item

    // Handle different name formats in the API
    let name = "Unknown Game"
    if (item.name) {
      if (Array.isArray(item.name)) {
        const primaryName = item.name.find((n: any) => n["@_type"] === "primary")
        name = primaryName?.["@_value"] || item.name[0]["@_value"]
      } else {
        name = item.name["@_value"]
      }
    }

    return {
      id: gameId,
      name,
      yearPublished: item.yearpublished?.["@_value"] || null,
      image: item.image || null,
      minPlayers: Number.parseInt(item.minplayers?.["@_value"]) || null,
      maxPlayers: Number.parseInt(item.maxplayers?.["@_value"]) || null,
      minPlaytime: Number.parseInt(item.minplaytime?.["@_value"]) || null,
      maxPlaytime: Number.parseInt(item.maxplaytime?.["@_value"]) || null,
      rating: item.statistics?.ratings?.average?.["@_value"]
        ? Number.parseFloat(item.statistics.ratings.average["@_value"])
        : null,
    }
  } catch (error) {
    console.error("Error getting game details:", error)
    return null
  }
}

