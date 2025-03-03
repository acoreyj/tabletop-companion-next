export interface Game {
  id: string
  name: string
  yearPublished: number | null
  image: string | null
  minPlayers: number | null
  maxPlayers: number | null
  minPlaytime: number | null
  maxPlaytime: number | null
  rating: number | null
}

