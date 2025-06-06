"use client";

import type { Message } from "@/types";
import { ChatMessage } from "./ChatMessage";
import { ScrollArea } from "./ui/scroll-area";
import React, { useEffect, useRef } from "react";

interface MessageListProps {
  messages: Message[];
  isLoadingAiResponse: boolean;
}

export function MessageList({ messages, isLoadingAiResponse }: MessageListProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, isLoadingAiResponse]);

  return (
    <ScrollArea className="h-full flex-1 p-4" ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoadingAiResponse && (
          <div className="flex justify-start items-center">
            <div className="p-3 rounded-xl bg-secondary text-secondary-foreground shadow-md">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:-0.3s]"></div>
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:-0.15s]"></div>
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
                <span className="text-sm">StudyBuddy AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
