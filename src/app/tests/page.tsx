
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, PlusCircle, Lightbulb, ChevronRight, Clock, Edit, Trash2, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { createTestSetAndGenerateQuestions, getTestSetsForUser, deleteTestSet as deleteTestSetDB } from "@/lib/database";
import { generateTest } from "@/ai/flows/generate-test-flow";
import type { TestSet } from "@/types";
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
import { Slider } from "@/components/ui/slider";

const testSetSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  subject: z.string().max(50, "Subject is too long").optional(),
  description: z.string().max(500, "Description is too long").optional(),
  numSubjective: z.number().min(0).max(20).default(5),
  numObjective: z.number().min(0).max(20).default(5),
  timeLimitMinutes: z.number().min(10, "Minimum 10 minutes").max(180, "Maximum 180 minutes").optional().default(60),
}).refine(data => data.numObjective > 0 || data.numSubjective > 0, {
  message: "Total number of questions must be greater than 0.",
  path: ["numObjective"], 
});

type TestSetFormValues = z.infer<typeof testSetSchema>;

export default function TestsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [testSets, setTestSets] = useState<TestSet[]>([]);
  const [isLoadingSets, setIsLoadingSets] = useState(true);
  const [isCreateSetDialogOpen, setIsCreateSetDialogOpen] = useState(false);
  const [isSubmittingSet, setIsSubmittingSet] = useState(false);
  const [testToDelete, setTestToDelete] = useState<TestSet | null>(null);

  const form = useForm<TestSetFormValues>({
    resolver: zodResolver(testSetSchema),
    defaultValues: { 
      title: "", 
      subject: "", 
      description: "",
      numSubjective: 5,
      numObjective: 5,
      timeLimitMinutes: 60,
    },
  });

  useEffect(() => {
    if (user && !authLoading) {
      setIsLoadingSets(true);
      const unsubscribe = getTestSetsForUser(user.uid, (fetchedSets) => {
        setTestSets(fetchedSets);
        setIsLoadingSets(false);
      });
      return () => unsubscribe();
    } else if (!authLoading) {
      setIsLoadingSets(false);
      setTestSets([]);
    }
  }, [user, authLoading]);

  const handleCreateTestSet = async (values: TestSetFormValues) => {
    if (!user) return;
    setIsSubmittingSet(true);
    try {
      toast({ title: "Generating Test...", description: "AI is crafting your questions. This may take a moment." });
      
      const generatedTestOutput = await generateTest({
        title: values.title,
        subject: values.subject,
        description: values.description,
        numSubjective: values.numSubjective,
        numObjective: values.numObjective,
      });

      if (!generatedTestOutput || !generatedTestOutput.questions || generatedTestOutput.questions.length === 0) {
        toast({ title: "AI Generation Failed", description: "Could not generate test questions. Please try adjusting your inputs.", variant: "destructive" });
        setIsSubmittingSet(false);
        return;
      }

      const testDetailsForDb = {
        title: values.title,
        subject: values.subject,
        description: values.description,
        numSubjective: values.numSubjective,
        numObjective: values.numObjective,
        timeLimitMinutes: values.timeLimitMinutes,
      };
      
      const testSetId = await createTestSetAndGenerateQuestions(user.uid, testDetailsForDb, generatedTestOutput.questions);
      
      toast({ title: "Test Created!", description: `Test "${values.title}" with ${generatedTestOutput.questions.length} questions has been created.` });
      form.reset();
      setIsCreateSetDialogOpen(false);
      router.push(`/tests/${testSetId}`); 
    } catch (error) {
      console.error("Error creating test set with AI questions:", error);
      toast({ title: "Creation Failed", description: "Could not create test set or generate questions.", variant: "destructive" });
    } finally {
      setIsSubmittingSet(false);
    }
  };

  const handleDeleteTest = async () => {
    if (!user || !testToDelete) return;
    try {
      await deleteTestSetDB(user.uid, testToDelete.id);
      toast({ title: "Test Set Deleted", description: `The test set "${testToDelete.title}" has been removed.` });
      setTestToDelete(null); 
    } catch (error) {
      console.error("Error deleting test set:", error);
      toast({ title: "Deletion Failed", description: "Could not delete test set.", variant: "destructive" });
    }
  };

  if (authLoading) {
    return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <div className="flex flex-1 items-center justify-center p-4"><p>Please log in to manage your tests.</p></div>;
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 bg-background">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Edit className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
            Your Tests
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={() => router.push('/chat')} className="w-full sm:w-auto">
            <ArrowLeft size={18} className="mr-2" /> Back to Home
          </Button>
          <Dialog open={isCreateSetDialogOpen} onOpenChange={setIsCreateSetDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle size={18} className="mr-2" /> Create New Test with AI
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Test with AI</DialogTitle>
                <DialogDescription>
                  Provide details and AI will generate subjective and objective questions.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleCreateTestSet)} className="space-y-4 py-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl><Input placeholder="e.g., Chapter 5 Review Quiz" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Subject (Optional)</FormLabel>
                          <FormControl><Input placeholder="e.g., History" {...field} /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )} />
                      <FormField control={form.control} name="timeLimitMinutes" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Time Limit (Minutes)</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 60" {...field} onChange={e => field.onChange(parseInt(e.target.value,10))} /></FormControl>
                          <FormMessage />
                      </FormItem>
                      )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl><Textarea placeholder="Brief overview of the test content..." {...field} rows={2} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                   <FormField control={form.control} name="numSubjective" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Number of Subjective Questions ({field.value})</FormLabel>
                          <FormControl>
                              <Slider
                                  defaultValue={[field.value || 5]}
                                  onValueChange={(value) => field.onChange(value[0])}
                                  max={20}
                                  step={1}
                              />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField control={form.control} name="numObjective" render={({ field }) => (
                      <FormItem>
                          <FormLabel>Number of Objective Questions ({field.value})</FormLabel>
                          <FormControl>
                               <Slider
                                  defaultValue={[field.value || 5]}
                                  onValueChange={(value) => field.onChange(value[0])}
                                  max={20}
                                  step={1}
                              />
                          </FormControl>
                          <FormMessage />
                      </FormItem>
                  )} />
                  {(form.formState.errors.numObjective || form.formState.errors.numSubjective) && !form.formState.errors.numObjective?.message && !form.formState.errors.root?.message && (
                      <p className="text-sm font-medium text-destructive">{form.formState.errors.numObjective?.message || "Total number of questions must be greater than 0."}</p>
                  )}
                  {form.formState.errors.root?.message && (
                      <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
                  )}
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateSetDialogOpen(false)} disabled={isSubmittingSet}>Cancel</Button>
                    <Button type="submit" disabled={isSubmittingSet}>
                      {isSubmittingSet ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                      Generate & Create Test
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoadingSets ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : testSets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center">
          <FileText className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">No Tests Created Yet</h2>
          <p className="mt-2 text-muted-foreground">Click "Create New Test with AI" to get started.</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testSets.map((test) => (
              <Card key={test.id} className="hover:shadow-lg transition-shadow duration-200 ease-in-out bg-card flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold text-card-foreground truncate">{test.title}</CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-muted-foreground hover:text-destructive h-7 w-7" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setTestToDelete(test); 
                          }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      {/* Content moved to ensure it's only rendered when testToDelete is set */}
                    </AlertDialog>
                  </div>
                  {test.subject && (
                    <CardDescription className="text-xs text-muted-foreground">{test.subject}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pb-4 flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {test.numObjective || 0} Objective, {test.numSubjective || 0} Subjective Questions
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock size={12} className="inline mr-1" /> {test.timeLimitMinutes || 60} minutes
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created: {formatDistanceToNow(new Date(test.createdAt), { addSuffix: true })}
                  </p>
                  {test.status === 'submitted' && test.submittedAt && (
                     <p className="text-xs text-green-600 font-medium mt-1 flex items-center">
                        <CheckCircle size={12} className="inline mr-1" /> Submitted: {formatDistanceToNow(new Date(test.submittedAt), { addSuffix: true })}
                    </p>
                  )}
                   {test.status === 'analyzed' && test.analysis && (
                     <p className="text-xs text-primary font-medium mt-1 flex items-center">
                        <CheckCircle size={12} className="inline mr-1 text-primary" /> Analyzed - Score: {test.analysis.overallScore?.toFixed(0)}%
                    </p>
                  )}
                  {test.status === 'generated' && (
                    <p className="text-xs text-amber-600 font-medium mt-1 flex items-center">
                        <AlertTriangle size={12} className="inline mr-1" /> Not yet taken
                    </p>
                  )}
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/tests/${test.id}`}>
                      {test.status === 'generated' ? 'Start Test' : 'View Details'} <ChevronRight size={16} className="ml-auto"/>
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
      {testToDelete && (
        <AlertDialog open={!!testToDelete} onOpenChange={(open) => !open && setTestToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Test Set?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the test set "{testToDelete.title}"? This will remove the test, its questions, and any submission data. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTestToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTest} className="bg-destructive hover:bg-destructive/90">
                Delete Test
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
    

    

    