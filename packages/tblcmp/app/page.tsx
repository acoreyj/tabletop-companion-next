import { SearchForm } from "@/components/search-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, Clock, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Game } from "@/lib/types";

// Featured games data
const featuredGames: Game[] = [
  {
    id: "13",
    name: "Catan",
    yearPublished: 1995,
    image:
      "https://cf.geekdo-images.com/PyUol9QxBnZQCJqZI6bmSA__original/img/g11AF48C6pLizxWPAq9dUEeKltQ=/0x0/filters:format(png)/pic8632666.png",
    minPlayers: 3,
    maxPlayers: 4,
    minPlaytime: 60,
    maxPlaytime: 120,
    rating: 7.1,
  },
  {
    id: "822",
    name: "Carcassonne",
    yearPublished: 2000,
    image:
      "https://cf.geekdo-images.com/okM0dq_bEXnbyQTOvHfwRA__original/img/aVZEXAI-cUtuunNfPhjeHlS4fwQ=/0x0/filters:format(png)/pic6544250.png",
    minPlayers: 2,
    maxPlayers: 5,
    minPlaytime: 30,
    maxPlaytime: 45,
    rating: 7.4,
  },
  {
    id: "30549",
    name: "Pandemic",
    yearPublished: 2008,
    image:
      "https://cf.geekdo-images.com/S3ybV1LAp-8SnHIXLLjVqA__original/img/IsrvRLpUV1TEyZsO5rC-btXaPz0=/0x0/filters:format(jpeg)/pic1534148.jpg",
    minPlayers: 2,
    maxPlayers: 4,
    minPlaytime: 45,
    maxPlaytime: 45,
    rating: 7.5,
  },
];

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">
          BoardGameGeek Chat
        </h1>
        <p className="max-w-[600px] text-muted-foreground md:text-xl">
          Search for your favorite board games and have AI help you learn more
          about them.
        </p>
        <div className="w-full max-w-md">
          <SearchForm />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="mb-6 text-2xl font-semibold text-center">
          Quick Access Games
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredGames.map((game) => (
            <Link href={`/game/${game.id}`} key={game.id}>
              <Card className="overflow-hidden h-full transition-all hover:shadow-md">
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
                  <h3 className="mb-2 text-lg font-bold">{game.name}</h3>
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
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
