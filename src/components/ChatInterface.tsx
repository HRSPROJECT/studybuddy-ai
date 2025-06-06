
"use client";

import type { Conversation, Message } from "@/types";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { addMessageToConversation, createNewConversation, getConversation } from "@/lib/database";
import { resolveQuestion as resolveQuestionAI } from "@/ai/flows/resolve-question";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UploadCloud } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ChatInterfaceProps {
  initialConversationId?: string;
}

export function ChatInterface({ initialConversationId }: ChatInterfaceProps) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [isLoadingAiResponse, setIsLoadingAiResponse] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(initialConversationId);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageForUpload, setImageForUpload] = useState<string | null>(null);

  useEffect(() => {
    if (initialConversationId !== currentConversationId) {
        setCurrentConversationId(initialConversationId);
        if (!initialConversationId) {
            setCurrentConversation(null);
            setMessages([]);
            setImageForUpload(null); 
        }
    }
  }, [initialConversationId, currentConversationId]);

  useEffect(() => {
    if (authLoading || !user) return;

    if (currentConversationId) {
      setIsLoadingConversation(true);
      const unsubscribe = getConversation(user.uid, currentConversationId, (data) => {
        setCurrentConversation(data);
        setMessages(data?.messages || []);
        setIsLoadingConversation(false);
      });
      return () => unsubscribe();
    } else {
      setCurrentConversation(null);
      setMessages([]);
      setIsLoadingConversation(false);
    }
  }, [user, currentConversationId, authLoading]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Image too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "destructive",
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageForUpload(reader.result as string);
        toast({ title: "File Selected", description: `${file.name} is ready to be sent with your next message.`});
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in to send messages.", variant: "destructive" });
      return;
    }
    if (content.trim() === "" && !imageForUpload) {
      toast({ title: "Empty Message", description: "Please type a message or upload an image.", variant: "destructive" });
      return;
    }
    setIsLoadingAiResponse(true);

    const userMessage: Message = {
      id: `temp-user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      imageUrl: imageForUpload, 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setImageForUpload(null); 

    let conversationIdToUse = currentConversationId;

    try {
      if (!conversationIdToUse) {
        const newConvoId = await createNewConversation(user, userMessage);
        setCurrentConversationId(newConvoId);
        router.replace(`/chat/${newConvoId}`, { scroll: false });
        conversationIdToUse = newConvoId;
      } else {
        await addMessageToConversation(user.uid, conversationIdToUse, userMessage);
      }

      const aiResponse = await resolveQuestionAI({ question: content, image: userMessage.imageUrl || undefined });
      
      const aiMessage: Message = {
        id: `temp-ai-${Date.now()}`,
        role: "assistant",
        content: aiResponse.answer,
        timestamp: new Date().toISOString(),
      };
      
      await addMessageToConversation(user.uid, conversationIdToUse, aiMessage);

    } catch (error) {
      console.error("Error sending message or getting AI response:", error);
      toast({ title: "Error", description: "Failed to send message or get AI response.", variant: "destructive" });
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoadingAiResponse(false);
    }
  };
  
  if (authLoading || isLoadingConversation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {messages.length === 0 && !isLoadingAiResponse && (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4 font-headline">#1 Free AI Homework Helper</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            Study with our AI Homework Helper to get instant, step-by-step solutions to any problem.
          </p>
          <Card className="w-full max-w-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-8 rounded-xl shadow-none">
            <CardContent 
              className="flex flex-col items-center justify-center cursor-pointer p-0"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-16 w-16 text-primary mb-4" />
              <p className="text-lg font-medium text-foreground">
                Upload <span className="text-primary font-semibold">Image</span> or <span className="text-primary font-semibold">PDF</span> to solve questions in it
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">⌘</kbd> + <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">V</kbd> to paste
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="image/*,.pdf" 
              />
            </CardContent>
          </Card>
           {imageForUpload && (
            <p className="mt-2 text-sm text-green-600">File selected! It will be sent with your next message.</p>
          )}
        </div>
      )}
      <MessageList messages={messages} isLoadingAiResponse={isLoadingAiResponse} />
      <MessageInput onSendMessage={handleSendMessage} isLoading={isLoadingAiResponse} />
    </div>
  );
}
