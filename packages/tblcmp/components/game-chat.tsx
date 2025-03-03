"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Game } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";
import { stream } from "fetch-event-stream";

interface GameChatProps {
  game: Game;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  isHidden?: boolean;
}

interface RagStepInfo {
  step: string;
  data?: any;
}

export function GameChat({ game }: GameChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uuidv4(),
      role: "system",
      content: `Welcome to the chat for ${game.name}! Ask rule or other questions about the game.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ragSteps, setRagSteps] = useState<RagStepInfo[]>([]);
  const [informativeMessage, setInformativeMessage] = useState("");
  const [relevantContext, setRelevantContext] = useState<any[]>([]);
  const [queries, setQueries] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const ragEndpoint =
    process.env.NEXT_PUBLIC_RAG_ENDPOINT || "http://localhost:8787/api";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    // Add user message to chat
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setRagSteps([]);
    setInformativeMessage("");
    setRelevantContext([]);
    setQueries([]);

    try {
      // Create a unique session ID based on the game ID
      const sessionId = `game-${game.id}`;

      // Prepare messages for the RAG server
      const messageHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      messageHistory.push({
        role: "user",
        content: userMessage.content,
      });

      // Call the RAG server with streaming response
      const response = await stream(`${ragEndpoint}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "text/event-stream",
        },
        body: JSON.stringify({
          messages: messageHistory,
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          sessionId,
          game: game.name,
        }),
      });

      for await (const event of response) {
        try {
          const parsedChunk = JSON.parse(
            event?.data?.trim().replace(/^data:\s*/, "") || ""
          );

          const newContent =
            parsedChunk.response ||
            parsedChunk.choices?.[0]?.delta?.content ||
            parsedChunk.delta?.text ||
            parsedChunk.text ||
            "";

          if (newContent) {
            setInformativeMessage("");

            setMessages((prevMessages) => {
              const lastMessage = prevMessages[prevMessages.length - 1];
              if (lastMessage?.role === "assistant" && !lastMessage.isHidden) {
                // Check if the new content is already at the end of the last message
                if (!lastMessage.content.endsWith(newContent)) {
                  return [
                    ...prevMessages.slice(0, -1),
                    {
                      ...lastMessage,
                      isHidden: false,
                      content: lastMessage.content + newContent,
                    },
                  ];
                }
              } else {
                return [
                  ...prevMessages,
                  {
                    id: uuidv4(),
                    content: newContent,
                    role: "assistant",
                    isHidden: false,
                    timestamp: new Date(),
                  },
                ];
              }
              return prevMessages; // Return unchanged if content was already added
            });
          } else if (parsedChunk.message) {
            console.log("Informative message:", parsedChunk.message);
            setInformativeMessage(parsedChunk.message);

            // Add to RAG steps
            setRagSteps((prev) => [
              ...prev,
              {
                step: parsedChunk.message,
                data:
                  parsedChunk.queries || parsedChunk.relevantContext || null,
              },
            ]);
          } else if (parsedChunk.error) {
            console.error("Error:", parsedChunk.error);
            setInformativeMessage("");
            toast({
              title: "Error",
              description: parsedChunk.error,
              variant: "destructive",
            });
          }

          if (parsedChunk.relevantContext) {
            setRelevantContext(parsedChunk.relevantContext);
            // Add relevant context to messages array
            setMessages((prevMessages) => [
              ...prevMessages,
              {
                id: uuidv4(),
                content:
                  "Relevant context:\n" +
                  parsedChunk.relevantContext
                    .map((ctx: { text: string }) => ctx.text)
                    .join("\n"),
                role: "assistant",
                isHidden: true,
                timestamp: new Date(),
              },
            ]);
          }
          if (parsedChunk.queries) {
            setQueries(parsedChunk.queries);
          }
        } catch (error) {
          console.log("Non-JSON chunk received:", event?.data);
        }
      }
    } catch (error) {
      console.error("Error querying RAG server:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: uuidv4(),
          role: "assistant",
          content:
            "Sorry, there was an error processing your request. Please try again later.",
          timestamp: new Date(),
        },
      ]);

      toast({
        title: "Error",
        description: "Failed to connect to the server. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col">
      <CardHeader className="border-b px-6 py-4">
        <CardTitle>Chat</CardTitle>
      </CardHeader>

      {/* RAG Steps Panel - Pinned at the top */}
      {ragSteps.length > 0 && (
        <div className="border-b bg-muted/50 p-3">
          <div className="text-sm font-medium mb-2">Processing Steps:</div>
          <div className="space-y-2 max-h-[150px] overflow-y-auto text-xs">
            {ragSteps.map((step, index) => (
              <div key={index} className="p-2 bg-background rounded-md">
                <div className="font-medium">{step.step}</div>
                {step.data && (
                  <div className="mt-1 text-muted-foreground">
                    {Array.isArray(step.data) ? (
                      <ul className="list-disc list-inside">
                        {step.data.slice(0, 3).map((item: any, i: number) => (
                          <li key={i}>
                            {typeof item === "string"
                              ? item
                              : item.text
                                ? `${item.text.substring(0, 50)}...`
                                : JSON.stringify(item).substring(0, 50) + "..."}
                          </li>
                        ))}
                        {step.data.length > 3 && (
                          <li>...and {step.data.length - 3} more</li>
                        )}
                      </ul>
                    ) : (
                      <span>
                        {JSON.stringify(step.data).substring(0, 100)}...
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CardContent className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          {informativeMessage && (
            <div className="mb-2 rounded-md bg-blue-50 p-2 text-sm text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {informativeMessage}
            </div>
          )}
          {messages.map(
            (message) =>
              !message.isHidden && (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[80%] items-start space-x-2 rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.role !== "user" && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src="/placeholder.svg?height=32&width=32"
                          alt="Avatar"
                        />
                        <AvatarFallback>
                          {message.role === "system" ? "S" : "A"}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <p>{message.content}</p>
                    </div>
                  </div>
                </div>
              )
          )}
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <CardFooter className="border-t p-4">
        <form
          onSubmit={handleSubmit}
          className="flex w-full items-center space-x-2"
        >
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={handleInputChange}
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
