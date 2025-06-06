"use client";

import type { Message } from "@/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { User, Bot } from "lucide-react";
import Image from "next/image";
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const date = new Date(message.timestamp);
  // Format time to HH:MM
  const timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;


  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Bot size={20} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          "max-w-[70%] rounded-xl p-3 shadow-md",
          isUser
            ? "rounded-br-none bg-primary text-primary-foreground"
            : "rounded-bl-none bg-secondary text-secondary-foreground"
        )}
      >
        {message.imageUrl && (
          <div className="mb-2 overflow-hidden rounded-lg border border-border">
            <Image
              src={message.imageUrl}
              alt="User upload"
              width={300}
              height={300}
              className="max-h-[300px] w-auto object-contain"
              data-ai-hint="illustration drawing"
            />
          </div>
        )}
        <div className="prose prose-sm max-w-none text-current break-words">
          <ReactMarkdown
            components={{
              p: ({node, ...props}) => <p className="mb-1 last:mb-0" {...props} />, // eslint-disable-line @typescript-eslint/no-unused-vars
              code: ({node, inline, className, children, ...props}) => { // eslint-disable-line @typescript-eslint/no-unused-vars
                const match = /language-(\w+)/.exec(className || '')
                return !inline && match ? (
                  <pre className={cn("font-code my-2 rounded bg-muted p-2 text-muted-foreground", className)} {...props}>
                    <code>{String(children).replace(/\n$/, '')}</code>
                  </pre>
                ) : (
                  <code className={cn("font-code rounded bg-muted px-1 py-0.5 text-muted-foreground",className)} {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
         <p className={cn(
            "mt-1 text-xs opacity-70",
            isUser ? "text-right" : "text-left"
          )}>
            {timeString}
          </p>
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
           <AvatarFallback className="bg-accent text-accent-foreground">
            <User size={20} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
