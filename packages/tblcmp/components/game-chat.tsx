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
import { v4 as uuidv4 } from "uuid";

interface GameChatProps {
  game: Game;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
      const response = await fetch(`${ragEndpoint}/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: messageHistory,
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Response body is not readable");
      }

      let assistantMessage = "";
      const decoder = new TextDecoder();

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.substring(6));

              // Handle different types of messages from the RAG server
              if (data.message) {
                // This is a step update
                setRagSteps((prev) => [
                  ...prev,
                  {
                    step: data.message,
                    data: data.queries || data.relevantContext || null,
                  },
                ]);
              } else if (data.text) {
                // This is the actual LLM response
                assistantMessage += data.text;

                // Update the assistant message in real-time
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const assistantMsgIndex = newMessages.findIndex(
                    (msg) =>
                      msg.role === "assistant" &&
                      msg.content.startsWith(assistantMessage.substring(0, 10))
                  );

                  if (assistantMsgIndex >= 0) {
                    newMessages[assistantMsgIndex].content = assistantMessage;
                  } else {
                    newMessages.push({
                      id: uuidv4(),
                      role: "assistant",
                      content: assistantMessage,
                      timestamp: new Date(),
                    });
                  }

                  return newMessages;
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }

      // If no assistant message was added during streaming, add it now
      if (!assistantMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: uuidv4(),
            role: "assistant",
            content:
              "I'm sorry, I couldn't generate a response. Please try again.",
            timestamp: new Date(),
          },
        ]);
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="flex h-[calc(100vh-200px)] min-h-[600px] flex-col">
      <CardHeader className="border-b px-6 py-4">
        <CardTitle>Game Discussion</CardTitle>
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
          {messages.map((message) => (
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
          ))}
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
