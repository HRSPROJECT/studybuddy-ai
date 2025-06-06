
"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Wand2 } from "lucide-react"; 
import { useToast } from "@/hooks/use-toast";

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

export function MessageInput({ onSendMessage, isLoading }: MessageInputProps) {
  const [inputValue, setInputValue] = useState("");
  const { toast } = useToast();

  const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (inputValue.trim() === "") {
        // If ChatInterface requires text for image-only messages, it can pass a default.
        // For this component, if only an image is uploaded, ChatInterface handles that logic.
        // If no image and no text, ChatInterface will show a toast.
    }
    onSendMessage(inputValue.trim());
    setInputValue("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 border-t bg-background p-4 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <Textarea
          value={inputValue}
          onChange={handleInputChange}
          placeholder="Type or paste your question here, or use '/' for formatting. For the best answer, ask one question at a time."
          className="flex-1 resize-none rounded-lg border-input bg-muted/50 p-3 focus:bg-background"
          rows={2} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          disabled={isLoading}
        />
         <Button 
            type="submit" 
            size="default" 
            aria-label="Get answer" 
            disabled={isLoading || inputValue.trim() === ""} 
            className="h-auto self-stretch px-4 bg-primary hover:bg-primary/90" // Adjusted button height and padding
        >
          <Wand2 size={16} className="mr-2" /> 
          Get answer
        </Button>
      </div>
    </form>
  );
}
