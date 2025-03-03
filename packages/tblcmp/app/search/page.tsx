import { GameCard } from "@/components/game-card"
import { SearchForm } from "@/components/search-form"
import { searchGames } from "@/lib/bgg-api"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q: string }
}) {
  const query = searchParams.q || ""
  const games = await searchGames(query)

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-4 text-2xl font-bold">Search Results for "{query}"</h1>
        <div className="max-w-md">
          <SearchForm />
        </div>
      </div>

      {games.length === 0 ? (
        <p className="text-muted-foreground">No games found. Try a different search term.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  )
}

