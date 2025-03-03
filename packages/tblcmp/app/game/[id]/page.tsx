import { getGameDetails } from "@/lib/bgg-api"
import { GameDetails } from "@/components/game-details"
import { GameChat } from "@/components/game-chat"
import { notFound } from "next/navigation"

export default async function GamePage({ params }: { params: { id: string } }) {
  const gameId = params.id

  try {
    const game = await getGameDetails(gameId)

    if (!game) {
      notFound()
    }

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Game details sidebar */}
          <div className="lg:col-span-1">
            <GameDetails game={game} />
          </div>

          {/* Chat interface - main content */}
          <div className="lg:col-span-3">
            <GameChat game={game} />
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error fetching game details:", error)
    notFound()
  }
}

