
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Layers, PlusCircle, Trash2, Edit3, ArrowLeft, ArrowRight, Lightbulb, Save, X, RotateCcw, BookOpen, Sparkles, Eye, EyeOff } from "lucide-react";
import { getFlashcardSetDetails, getFlashcardsInSet, addFlashcardToSet, updateFlashcardInSet, deleteFlashcardFromSet } from "@/lib/database";
import type { Flashcard, FlashcardSet } from "@/types";
import { generateFlashcardAnswer as generateAnswerAI } from "@/ai/flows/generate-flashcard-answer-flow";
import { generateMultipleFlashcards as generateMultipleCardsAI } from "@/ai/flows/generate-multiple-flashcards-flow";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const flashcardSchema = z.object({
  frontText: z.string().min(1, "Front text is required").max(500, "Front text is too long"),
  backText: z.string().min(1, "Back text is required").max(1000, "Back text is too long"),
});
type FlashcardFormValues = z.infer<typeof flashcardSchema>;

interface FlashcardDisplayProps {
  flashcard: Flashcard;
  onEdit: (card: Flashcard) => void;
  onDelete: (cardId: string) => void;
}

const FlashcardDisplay: React.FC<FlashcardDisplayProps> = ({ flashcard, onEdit, onDelete }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <Card 
      className={cn(
        "relative aspect-[3/2] w-full max-w-sm cursor-pointer select-none overflow-hidden rounded-lg border-2 shadow-md transition-all duration-300 ease-in-out hover:shadow-xl",
        isFlipped ? "border-primary" : "border-border"
      )}
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ perspective: '1000px' }}
    >
      <div 
        className="relative h-full w-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front of the card */}
        <div 
          className="absolute flex h-full w-full flex-col items-center justify-center_scroll-py-10 bg-card p-4 text-card-foreground [backface-visibility:hidden]"
        >
          <ScrollArea className="h-full w-full py-6">
             <p className="text-center text-lg font-medium whitespace-pre-wrap">{flashcard.frontText}</p>
          </ScrollArea>
        </div>
        {/* Back of the card */}
        <div 
          className="absolute flex h-full w-full flex-col items-center justify-center_scroll-py-10 bg-primary p-4 text-primary-foreground [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <ScrollArea className="h-full w-full py-6">
            <p className="text-center text-md whitespace-pre-wrap">{flashcard.backText}</p>
          </ScrollArea>
        </div>
      </div>
      <div className="absolute bottom-2 right-2 z-10 flex gap-1 bg-card/80 p-1 rounded-md" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => onEdit(flashcard)}>
            <Edit3 size={14} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onDelete(flashcard.id)}>
            <Trash2 size={14} />
          </Button>
        </div>
    </Card>
  );
};


export default function FlashcardSetPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const setId = params.setId as string;

  const [setDetails, setSetDetails] = useState<FlashcardSet | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Flashcard | null>(null);
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);

  const [isGeneratingMoreCards, setIsGeneratingMoreCards] = useState(false);
  const [isStudySessionActive, setIsStudySessionActive] = useState(false);
  const [currentStudyCardIndex, setCurrentStudyCardIndex] = useState(0);
  const [isStudyCardFlipped, setIsStudyCardFlipped] = useState(false);


  const form = useForm<FlashcardFormValues>({
    resolver: zodResolver(flashcardSchema),
    defaultValues: { frontText: "", backText: "" },
  });

  useEffect(() => {
    if (user && setId && !authLoading) {
      setIsLoading(true);
      const unsubscribeSet = getFlashcardSetDetails(user.uid, setId, setSetDetails);
      const unsubscribeCards = getFlashcardsInSet(setId, (fetchedCards) => {
        setFlashcards(fetchedCards);
        setIsLoading(false); 
      });
      return () => {
        unsubscribeSet();
        unsubscribeCards();
      };
    } else if (!authLoading) {
        setIsLoading(false);
    }
  }, [user, setId, authLoading]);

  const handleOpenAddDialog = (cardToEdit?: Flashcard) => {
    if (cardToEdit) {
      setEditingCard(cardToEdit);
      form.reset({ frontText: cardToEdit.frontText, backText: cardToEdit.backText });
    } else {
      setEditingCard(null);
      form.reset({ frontText: "", backText: "" });
    }
    setIsAddCardDialogOpen(true);
  };

  const handleGenerateAnswer = async () => {
    const frontText = form.getValues("frontText");
    if (!frontText.trim()) {
      toast({ title: "Question Needed", description: "Please enter a question first to generate an answer.", variant: "destructive" });
      return;
    }
    setIsGeneratingAnswer(true);
    try {
      const result = await generateAnswerAI({ questionText: frontText });
      form.setValue("backText", result.answerText);
      toast({ title: "Answer Generated!", description: "AI has suggested an answer." });
    } catch (error) {
      console.error("Error generating answer:", error);
      toast({ title: "AI Error", description: "Could not generate an answer.", variant: "destructive" });
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  const handleSaveCard = async (values: FlashcardFormValues) => {
    if (!user || !setId) return;
    setIsSubmittingCard(true);
    try {
      if (editingCard) {
        await updateFlashcardInSet(user.uid, setId, editingCard.id, values.frontText, values.backText);
        toast({ title: "Flashcard Updated", description: "Your flashcard has been saved." });
      } else {
        await addFlashcardToSet(user.uid, setId, values.frontText, values.backText);
        toast({ title: "Flashcard Added", description: "New flashcard added to the set." });
      }
      form.reset();
      setIsAddCardDialogOpen(false);
      setEditingCard(null);
    } catch (error) {
      console.error("Error saving flashcard:", error);
      toast({ title: "Save Failed", description: "Could not save flashcard.", variant: "destructive" });
    } finally {
      setIsSubmittingCard(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!user || !setId || !cardToDelete) return;
    try {
      await deleteFlashcardFromSet(user.uid, setId, cardToDelete);
      toast({ title: "Flashcard Deleted", description: "The flashcard has been removed." });
      setCardToDelete(null);
    } catch (error) {
      console.error("Error deleting flashcard:", error);
      toast({ title: "Deletion Failed", description: "Could not delete flashcard.", variant: "destructive" });
    }
  };

  const handleGenerateMoreCards = async () => {
    if (!user || !setDetails) {
        toast({ title: "Error", description: "Set details not available or user not logged in.", variant: "destructive" });
        return;
    }
    setIsGeneratingMoreCards(true);
    try {
        const topic = [setDetails.title, setDetails.subject, setDetails.chapter].filter(Boolean).join(" - ") || "General";
        const aiGeneratedCards = await generateMultipleCardsAI({ topic, numberOfCards: 5 });

        if (!aiGeneratedCards || !aiGeneratedCards.flashcards || aiGeneratedCards.flashcards.length === 0) {
            toast({ title: "AI Generation Failed", description: "Could not generate more flashcards.", variant: "destructive" });
            return;
        }
        
        for (const card of aiGeneratedCards.flashcards) {
            await addFlashcardToSet(user.uid, setId, card.questionText, card.answerText);
        }
        toast({ title: "Flashcards Added!", description: `${aiGeneratedCards.flashcards.length} new flashcards added to the set.` });
    } catch (error) {
        console.error("Error generating more flashcards:", error);
        toast({ title: "AI Error", description: "Could not generate more flashcards.", variant: "destructive" });
    } finally {
        setIsGeneratingMoreCards(false);
    }
  };

  const handleStartStudySession = () => {
    if (flashcards.length === 0) {
        toast({ title: "No Flashcards", description: "Add some flashcards to this set to start studying.", variant: "destructive" });
        return;
    }
    setCurrentStudyCardIndex(0);
    setIsStudyCardFlipped(false);
    setIsStudySessionActive(true);
  };

  const handleStudyNext = () => {
    if (currentStudyCardIndex < flashcards.length - 1) {
        setCurrentStudyCardIndex(prev => prev + 1);
        setIsStudyCardFlipped(false);
    }
  };

  const handleStudyPrev = () => {
    if (currentStudyCardIndex > 0) {
        setCurrentStudyCardIndex(prev => prev - 1);
        setIsStudyCardFlipped(false);
    }
  };

  const handleToggleStudyFlip = () => {
    setIsStudyCardFlipped(prev => !prev);
  };


  if (authLoading || isLoading) {
    return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <div className="flex flex-1 items-center justify-center p-4"><p>Please log in to view flashcards.</p></div>;
  }
  if (!setDetails && !isLoading) {
     return <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-destructive">Flashcard set not found or you do not have permission to view it.</p>
        <Button variant="link" onClick={() => router.push('/flashcards')} className="ml-2">Go back to sets</Button>
        </div>;
  }

  const currentStudyCard = flashcards[currentStudyCardIndex];

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 bg-background">
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/flashcards")} className="mb-4">
          <ArrowLeft size={16} className="mr-2" /> Back to Sets
        </Button>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <Layers className="h-8 w-8 text-primary" />
            <div>
                <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
                {setDetails?.title || "Loading Set..."}
                </h1>
                {(setDetails?.subject || setDetails?.chapter) && (
                <p className="text-sm text-muted-foreground">
                    {setDetails.subject}{setDetails.subject && setDetails.chapter && " - "}{setDetails.chapter}
                </p>
                )}
            </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <Button onClick={handleStartStudySession} disabled={flashcards.length === 0 || isStudySessionActive}>
                    <BookOpen size={18} className="mr-2" /> Start Study Session
                </Button>
                <Button onClick={() => handleOpenAddDialog()} variant="outline">
                    <PlusCircle size={18} className="mr-2" /> Add New Flashcard
                </Button>
                <Button onClick={handleGenerateMoreCards} variant="outline" disabled={isGeneratingMoreCards}>
                    {isGeneratingMoreCards ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Sparkles size={18} className="mr-2" />}
                    Generate 5 More AI Cards
                </Button>
            </div>
        </div>
      </div>

      {flashcards.length === 0 && !isLoading ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <RotateCcw className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Flashcards Yet</h2>
          <p className="mt-2 text-muted-foreground">Click "Add New Flashcard" or "Generate AI Cards" to populate this set.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-1">
            {flashcards.map((card) => (
              <FlashcardDisplay 
                key={card.id} 
                flashcard={card} 
                onEdit={handleOpenAddDialog} 
                onDelete={() => setCardToDelete(card.id)}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Add/Edit Flashcard Dialog */}
      <Dialog open={isAddCardDialogOpen} onOpenChange={(isOpen) => {
        setIsAddCardDialogOpen(isOpen);
        if (!isOpen) setEditingCard(null);
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCard ? "Edit Flashcard" : "Add New Flashcard"}</DialogTitle>
            <DialogDescription>
              {editingCard ? "Modify the details of your flashcard." : "Create a new question and answer card for your set."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveCard)} className="space-y-4 py-4">
              <FormField control={form.control} name="frontText" render={({ field }) => (
                <FormItem>
                  <FormLabel>Front (Question)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter the question or term..." {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <Button type="button" variant="outline" size="sm" onClick={handleGenerateAnswer} disabled={isGeneratingAnswer}>
                {isGeneratingAnswer ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                Generate Answer with AI
              </Button>

              <FormField control={form.control} name="backText" render={({ field }) => (
                <FormItem>
                  <FormLabel>Back (Answer)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter the answer or definition..." {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmittingCard}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingCard}>
                  {isSubmittingCard && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingCard ? <Save className="mr-2 h-4 w-4" /> : null}
                  {editingCard ? "Save Changes" : "Add Card"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      {cardToDelete && (
         <AlertDialog open={!!cardToDelete} onOpenChange={(open) => !open && setCardToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Flashcard?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this flashcard? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCardToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteCard} className="bg-destructive hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Study Session Dialog */}
      <Dialog open={isStudySessionActive} onOpenChange={(isOpen) => { if (!isOpen) setIsStudySessionActive(false); }}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>
              Study Session: {setDetails?.title} (Card {currentStudyCardIndex + 1} of {flashcards.length})
            </DialogTitle>
            {/* The redundant DialogClose component was here and has been removed */}
          </DialogHeader>

          {currentStudyCard && (
            <div className="flex-grow flex flex-col items-center justify-center p-6 border rounded-lg my-4 bg-card text-card-foreground relative overflow-hidden">
              <ScrollArea className="w-full h-full">
                <div className="flex items-center justify-center min-h-[30vh] p-4">
                    <p className="text-2xl md:text-3xl text-center whitespace-pre-wrap">
                    {isStudyCardFlipped ? currentStudyCard.backText : currentStudyCard.frontText}
                    </p>
                </div>
              </ScrollArea>
            </div>
          )}
          
          <DialogFooter className="flex-shrink-0 sm:justify-between items-center pt-4 border-t">
            <Button variant="outline" onClick={handleStudyPrev} disabled={currentStudyCardIndex === 0}>
              <ArrowLeft size={18} className="mr-2" /> Previous
            </Button>
            <Button onClick={handleToggleStudyFlip} variant="default" className="px-6 py-3 text-base">
              {isStudyCardFlipped ? <EyeOff size={20} className="mr-2" /> : <Eye size={20} className="mr-2" />}
              {isStudyCardFlipped ? "Hide Answer" : "Show Answer"}
            </Button>
            <Button variant="outline" onClick={handleStudyNext} disabled={currentStudyCardIndex === flashcards.length - 1}>
              Next <ArrowRight size={18} className="ml-2" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
