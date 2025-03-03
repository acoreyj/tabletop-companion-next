import { SearchForm } from "@/components/search-form"

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">BoardGameGeek Chat</h1>
        <p className="max-w-[600px] text-muted-foreground md:text-xl">
          Search for your favorite board games and join the conversation.
        </p>
        <div className="w-full max-w-md">
          <SearchForm />
        </div>
      </div>
    </div>
  )
}

