"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import scenarios from "@/data/scenarios.json";

export default function TrainingChat() {
  const [selectedScenario, setSelectedScenario] = useState(scenarios[0]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    isLoading,
  } = useChat({
    initialMessages: [
      {
        id: "system-1",
        role: "system",
        content: `You are a realistic customer in an IT sales scenario. Respond based on the selected scenario. Do NOT read aloud colons (:), asterisks (*), or commas. Act like a real human, not a bot.`,
      },
      {
        id: "system-2",
        role: "system",
        content: selectedScenario.prompt,
      },
    ],
  });

  useEffect(() => {
    // When scenario changes, reset with new prompt
    append({
      id: `system-${Date.now()}`,
      role: "system",
      content: selectedScenario.prompt,
    });
  }, [selectedScenario]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">🎯 Sales Training Simulator</h1>

      <div className="flex flex-wrap gap-3">
        {scenarios.map((scenario) => (
          <Button
            key={scenario.id}
            variant={scenario.id === selectedScenario.id ? "default" : "outline"}
            onClick={() => setSelectedScenario(scenario)}
          >
            {scenario.name}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[400px] border p-4 rounded-md">
        {messages.map((m) => (
          <Card key={m.id} className="p-3 my-2">
            <strong>{m.role === "user" ? "🧑 You" : "🤖 Customer"}:</strong>
            <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
          </Card>
        ))}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          className="flex-1 border p-2 rounded"
          value={input}
          onChange={handleInputChange}
          placeholder="Type your message..."
        />
        <Button type="submit" disabled={isLoading}>
          Send
        </Button>
      </form>
    </div>
  );
}
