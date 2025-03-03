import Image from "next/image";
import { Users, Clock, Star } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PdfUpload } from "@/components/pdf-upload";
import type { Game } from "@/lib/types";

interface GameDetailsProps {
  game: Game;
}

export function GameDetails({ game }: GameDetailsProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-0">
        {game.image ? (
          <Image
            src={game.image || "/placeholder.svg"}
            alt={game.name}
            width={400}
            height={300}
            className="h-auto w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted">
            <span className="text-muted-foreground">No image</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-4">
        <h1 className="mb-2 text-xl font-bold">{game.name}</h1>
        {game.yearPublished && (
          <p className="mb-4 text-sm text-muted-foreground">
            ({game.yearPublished})
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center">
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>
              {game.minPlayers === game.maxPlayers
                ? `${game.minPlayers} players`
                : `${game.minPlayers}-${game.maxPlayers} players`}
            </span>
          </div>

          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>
              {game.minPlaytime === game.maxPlaytime
                ? `${game.minPlaytime} min`
                : `${game.minPlaytime}-${game.maxPlaytime} min`}
            </span>
          </div>

          {game.rating && (
            <div className="flex items-center">
              <Star className="mr-2 h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{game.rating.toFixed(1)} BGG Rating</span>
            </div>
          )}
        </div>

        {/* PDF Upload Component */}
        <PdfUpload sessionId={`game-${game.id}`} />
      </CardContent>
    </Card>
  );
}
