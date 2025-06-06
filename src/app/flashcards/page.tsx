
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Layers, PlusCircle, Trash2, Edit3, FolderOpen, ChevronRight, FileText, Lightbulb } from "lucide-react";
import { createFlashcardSet, getFlashcardSetsForUser, deleteFlashcardSet as deleteSetDb, addFlashcardToSet } from "@/lib/database";
import type { FlashcardSet } from "@/types";
import { generateMultipleFlashcards } from "@/ai/flows/generate-multiple-flashcards-flow";
import { formatDistanceToNow } from 'date-fns';
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

const flashcardSetSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  subject: z.string().max(50, "Subject is too long").optional(),
  chapter: z.string().max(50, "Chapter is too long").optional(),
});
type FlashcardSetFormValues = z.infer<typeof flashcardSetSchema>;

export default function FlashcardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isCreateSetDialogOpen, setIsCreateSetDialogOpen] = useState(false);
  const [isSubmittingSet, setIsSubmittingSet] = useState(false);
  const [setToDelete, setSetToDelete] = useState<FlashcardSet | null>(null);

  const form = useForm<FlashcardSetFormValues>({
    resolver: zodResolver(flashcardSetSchema),
    defaultValues: { title: "", subject: "", chapter: "" },
  });

  useEffect(() => {
    if (user && !authLoading) {
      setIsLoadingSets(true);
      const unsubscribe = getFlashcardSetsForUser(user.uid, (fetchedSets) => {
        setSets(fetchedSets);
        setIsLoadingSets(false);
      });
      return () => unsubscribe();
    } else if (!authLoading) {
      setIsLoadingSets(false);
      setSets([]);
    }
  }, [user, authLoading]);

  const handleCreateSet = async (values: FlashcardSetFormValues) => {
    if (!user) return;
    setIsSubmittingSet(true);
    try {
      const topicParts = [values.title, values.subject, values.chapter].filter(Boolean);
      const topic = topicParts.join(" - ") || "General Knowledge";

      toast({ title: "Generating Flashcards...", description: "AI is creating your flashcards, this may take a moment." });
      const aiGeneratedCards = await generateMultipleFlashcards({ topic, numberOfCards: 5 });

      if (!aiGeneratedCards || !aiGeneratedCards.flashcards || aiGeneratedCards.flashcards.length === 0) {
        toast({ title: "AI Generation Failed", description: "Could not generate flashcards. Please try again.", variant: "destructive" });
        setIsSubmittingSet(false);
        return;
      }
      
      const setId = await createFlashcardSet(user.uid, values.title, values.subject, values.chapter);
      toast({ title: "Flashcard Set Created", description: `Set "${values.title}" metadata created. Adding AI cards...` });

      for (const card of aiGeneratedCards.flashcards) {
        await addFlashcardToSet(user.uid, setId, card.questionText, card.answerText);
      }

      toast({ title: "Flashcards Added!", description: `${aiGeneratedCards.flashcards.length} flashcards added to "${values.title}".` });
      form.reset();
      setIsCreateSetDialogOpen(false);
    } catch (error) {
      console.error("Error creating flashcard set with AI cards:", error);
      toast({ title: "Creation Failed", description: "Could not create flashcard set or add AI cards.", variant: "destructive" });
    } finally {
      setIsSubmittingSet(false);
    }
  };

  const handleDeleteSet = async () => {
    if (!user || !setToDelete) return;
    try {
      await deleteSetDb(user.uid, setToDelete.id);
      toast({ title: "Set Deleted", description: `Set "${setToDelete.title}" has been removed.` });
      setSetToDelete(null); 
    } catch (error) {
      console.error("Error deleting flashcard set:", error);
      toast({ title: "Deletion Failed", description: "Could not delete set.", variant: "destructive" });
    }
  };
  
  if (authLoading) {
    return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <div className="flex flex-1 items-center justify-center p-4"><p>Please log in to manage your flashcards.</p></div>;
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 bg-background">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
            Your Flashcard Sets
          </h1>
        </div>
        <Dialog open={isCreateSetDialogOpen} onOpenChange={setIsCreateSetDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle size={18} className="mr-2" /> Create New Set with AI
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Flashcard Set with AI</DialogTitle>
              <DialogDescription>
                Provide details and AI will generate flashcards for you (at least 5).
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateSet)} className="space-y-4 py-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="e.g., Biology Midterm" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subject" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Biology" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="chapter" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chapter (Optional)</FormLabel>
                    <FormControl><Input placeholder="e.g., Cell Structure" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateSetDialogOpen(false)} disabled={isSubmittingSet}>Cancel</Button>
                  <Button type="submit" disabled={isSubmittingSet}>
                    {isSubmittingSet ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                    Generate & Create Set
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoadingSets ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : sets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <FolderOpen className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Flashcard Sets Yet</h2>
          <p className="mt-2 text-muted-foreground">Click "Create New Set with AI" to get started.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sets.map((set) => (
              <Card key={set.id} className="hover:shadow-lg transition-shadow duration-200 ease-in-out bg-card">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold text-card-foreground truncate">{set.title}</CardTitle>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-7 w-7" onClick={(e) => { e.stopPropagation(); setSetToDelete(set); }}>
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                         {/* AlertDialogContent will be rendered conditionally below */}
                      </AlertDialog>
                  </div>
                  {(set.subject || set.chapter) && (
                    <CardDescription className="text-xs text-muted-foreground">
                      {set.subject}{set.subject && set.chapter && " - "}{set.chapter}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-sm text-muted-foreground">
                    {set.flashcardCount || 0} card{set.flashcardCount !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last updated: {formatDistanceToNow(new Date(set.updatedAt), { addSuffix: true })}
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/flashcards/${set.id}`}>
                      Open Set <ChevronRight size={16} className="ml-auto"/>
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      {setToDelete && (
        <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Flashcard Set?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the set "{setToDelete.title}"? This will remove all flashcards within it and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setSetToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSet} className="bg-destructive hover:bg-destructive/90">
                Delete Set
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
