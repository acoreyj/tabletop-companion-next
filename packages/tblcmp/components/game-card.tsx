import Image from "next/image"
import Link from "next/link"
import { Star } from "lucide-react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import type { Game } from "@/lib/types"

interface GameCardProps {
  game: Game
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link href={`/game/${game.id}`}>
      <Card className="h-full overflow-hidden transition-all hover:shadow-md">
        <div className="aspect-[4/3] w-full overflow-hidden">
          {game.image ? (
            <Image
              src={game.image || "/placeholder.svg"}
              alt={game.name}
              width={300}
              height={225}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-muted-foreground">No image</span>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold line-clamp-1">{game.name}</h3>
          {game.yearPublished && <p className="text-sm text-muted-foreground">({game.yearPublished})</p>}
        </CardContent>
        {game.rating && (
          <CardFooter className="flex items-center p-4 pt-0">
            <Star className="mr-1 h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm">{game.rating.toFixed(1)}</span>
          </CardFooter>
        )}
      </Card>
    </Link>
  )
}

