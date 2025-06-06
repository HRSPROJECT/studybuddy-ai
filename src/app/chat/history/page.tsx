
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { getConversationList, deleteConversation } from "@/lib/database";
import type { ConversationListItem } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquareText, History as HistoryIcon, Trash2 } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    const unsubscribe = getConversationList(user.uid, (data) => {
      setConversations(data);
      setIsLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [user, authLoading]);

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to delete conversations.", variant: "destructive" });
      return;
    }
    try {
      await deleteConversation(user.uid, conversationId);
      toast({ title: "Conversation Deleted", description: "The conversation has been successfully removed." });
      // The list will update automatically due to the real-time listener
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast({ title: "Deletion Failed", description: "Could not delete the conversation.", variant: "destructive" });
    }
  };

  if (authLoading || isLoadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 bg-background">
      <div className="mb-6 flex items-center gap-3">
        <HistoryIcon className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
          Homework & Conversation History
        </h1>
      </div>
      {conversations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <MessageSquareText className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No History Found</h2>
          <p className="mt-2 text-muted-foreground">
            Your past conversations will appear here once you start chatting.
          </p>
          <Button asChild className="mt-6">
            <Link href="/chat">Start a New Chat</Link>
          </Button>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-4">
            {conversations.map((convo) => (
              <Card key={convo.id} className="hover:shadow-lg transition-shadow duration-200 ease-in-out bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-semibold text-card-foreground truncate">{convo.title}</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Last activity: {formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: true })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
                    <Link href={`/chat/${convo.id}`}>View Conversation</Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={16} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this conversation? This action cannot be undone and will remove all messages associated with it.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteConversation(convo.id)} className="bg-destructive hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

    