
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import { CalendarCheck, Loader2, PlusCircle, Trash2, GripVertical, Lightbulb, FileText, CalendarDays, Download, Save, Eye, FolderOpen } from "lucide-react";
import { GenerateStudyPlanInputSchema } from "@/lib/planner-schemas";
import { GenerateStudyPlanInput, GenerateStudyPlanOutput as StudyPlanFromAI, Exam as ExamType, StudySession as StudySessionType } from "@/ai/flows/generate-study-plan-flow";
import { generateStudyPlan as generateStudyPlanAI } from "@/ai/flows/generate-study-plan-flow";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format as formatDateFns, parse as parseDateFns, set as setDateFns, getHours as getHoursFns, getMinutes as getMinutesFns, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { saveStudyPlan, getSavedStudyPlans, deleteStudyPlan as deleteSavedStudyPlanDB } from "@/lib/database";
import type { SavedStudyPlan } from "@/types";
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

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type PlannerFormValues = GenerateStudyPlanInput;

export default function PlannerPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<StudyPlanFromAI | null>(null); // Plan from AI
  const [displayedPlan, setDisplayedPlan] = useState<StudyPlanFromAI | SavedStudyPlan | null>(null); // Plan shown in UI
  
  const [savedPlans, setSavedPlans] = useState<SavedStudyPlan[]>([]);
  const [isLoadingSavedPlans, setIsLoadingSavedPlans] = useState(true);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isDisplayingSavedPlan, setIsDisplayingSavedPlan] = useState(false);


  const form = useForm<PlannerFormValues>({
    resolver: zodResolver(GenerateStudyPlanInputSchema),
    defaultValues: {
      exams: [{ id: crypto.randomUUID(), subject: "", date: "", type: "Exam" }],
      weakAreas: [],
      learningPace: "moderate",
      studyHoursPerWeek: undefined,
      preferredStudyDays: [],
      notes: "",
    },
  });

  const { fields: examFields, append: appendExam, remove: removeExam } = useFieldArray({
    control: form.control,
    name: "exams",
  });

  useEffect(() => {
    if (user && !authLoading) {
      setIsLoadingSavedPlans(true);
      const unsubscribe = getSavedStudyPlans(user.uid, (fetchedPlans) => {
        setSavedPlans(fetchedPlans);
        setIsLoadingSavedPlans(false);
      });
      return () => unsubscribe();
    } else if (!authLoading) {
      setIsLoadingSavedPlans(false);
      setSavedPlans([]);
    }
  }, [user, authLoading]);

  const onSubmit = async (data: PlannerFormValues) => {
    if (!user) {
      toast({ title: "Not Authenticated", description: "You must be logged in to generate a study plan.", variant: "destructive" });
      return;
    }
    setIsGeneratingPlan(true);
    setGeneratedPlan(null);
    setDisplayedPlan(null);
    setIsDisplayingSavedPlan(false);
    try {
      const plan = await generateStudyPlanAI(data);
      setGeneratedPlan(plan);
      setDisplayedPlan(plan);
      toast({ title: "Study Plan Generated!", description: "Your personalized study plan is ready." });
    } catch (error: any) {
      console.error("Error generating study plan:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Could not generate study plan. Please check your inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const formatToICSDate = (date: Date): string => {
    return formatDateFns(date, "yyyyMMdd'T'HHmmss");
  };

  const generateICSContent = (plan: StudyPlanFromAI | SavedStudyPlan): string => {
    let icsString = "";
    icsString += "BEGIN:VCALENDAR\r\n";
    icsString += "VERSION:2.0\r\n";
    icsString += "PRODID:-//StudyBuddyAI//Personalized Study Plan//EN\r\n";
    icsString += `X-WR-CALNAME:${plan.planTitle || 'Study Plan'}\r\n`;

    plan.dailySessions?.forEach(day => {
      day.sessions?.forEach(session => {
        try {
          const baseDate = parseDateFns(day.date, "yyyy-MM-dd", new Date());
          const startTimeParts = parseDateFns(session.startTime, "hh:mm a", new Date());
          const startDateTime = setDateFns(baseDate, {
            hours: getHoursFns(startTimeParts),
            minutes: getMinutesFns(startTimeParts),
            seconds: 0, milliseconds: 0,
          });
          const endTimeParts = parseDateFns(session.endTime, "hh:mm a", new Date());
          const endDateTime = setDateFns(baseDate, {
            hours: getHoursFns(endTimeParts),
            minutes: getMinutesFns(endTimeParts),
            seconds: 0, milliseconds: 0,
          });
          if (endDateTime <= startDateTime) {
             console.warn(`Adjusting end time for session: ${session.subject} on ${day.date} from ${session.startTime} to ${session.endTime}`);
          }
          icsString += "BEGIN:VEVENT\r\n";
          icsString += `UID:${crypto.randomUUID()}@studybuddy.ai\r\n`;
          icsString += `DTSTAMP:${formatToICSDate(new Date())}\r\n`;
          icsString += `DTSTART:${formatToICSDate(startDateTime)}\r\n`;
          icsString += `DTEND:${formatToICSDate(endDateTime)}\r\n`;
          icsString += `SUMMARY:${session.isBreak ? "Break" : session.subject}\r\n`;
          icsString += `DESCRIPTION:${session.activity.replace(/\n/g, "\\n")}\r\n`;
          icsString += "END:VEVENT\r\n";
        } catch(e) {
            console.error("Error parsing date/time for ICS event:", day.date, session.startTime, session.endTime, e);
        }
      });
    });
    icsString += "END:VCALENDAR\r\n";
    return icsString;
  };

  const handleDownloadPlan = () => {
    if (!displayedPlan) {
      toast({ title: "No Plan", description: "Generate or load a study plan first.", variant: "destructive" });
      return;
    }
    try {
      const icsContent = generateICSContent(displayedPlan);
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const fileName = (displayedPlan.planTitle || "Study Plan").replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `${fileName}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: "Download Started", description: "Your study plan .ics file is downloading." });
    } catch (error) {
        console.error("Error generating or downloading ICS file:", error);
        toast({ title: "Download Failed", description: "Could not prepare the plan for download.", variant: "destructive"});
    }
  };

  const handleSavePlan = async () => {
    if (!user || !generatedPlan || isDisplayingSavedPlan) { // Only save newly generated plans
      toast({ title: "Cannot Save", description: "Only newly generated plans can be saved.", variant: "destructive" });
      return;
    }
    setIsSavingPlan(true);
    try {
      const planToSave = { ...generatedPlan };
      if (!planToSave.planTitle) {
        planToSave.planTitle = `Study Plan - ${formatDateFns(new Date(), "PPpp")}`;
      }
      const planId = await saveStudyPlan(user.uid, planToSave);
      toast({ title: "Plan Saved!", description: "Your study plan has been saved." });
      // The savedPlans list will update via the onValue listener
      // Optionally, mark this generated plan as saved to prevent re-saving
      // For now, simply generating a new plan will allow saving again.
      setGeneratedPlan(null); // Clear generated plan so save button is disabled until new one is made
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save the plan.", variant: "destructive" });
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleViewSavedPlan = (plan: SavedStudyPlan) => {
    setDisplayedPlan(plan);
    setIsDisplayingSavedPlan(true);
    setGeneratedPlan(null); // Clear any active generated plan
  };

  const handleDeleteSavedPlan = async (planId: string) => {
     if (!user) return;
     try {
       await deleteSavedStudyPlanDB(user.uid, planId);
       toast({ title: "Plan Deleted", description: "The saved study plan has been removed." });
       if (displayedPlan && 'id' in displayedPlan && displayedPlan.id === planId) {
         setDisplayedPlan(null);
         setIsDisplayingSavedPlan(false);
       }
     } catch (error: any) {
       console.error("Error deleting saved plan:", error);
       toast({ title: "Deletion Failed", description: error.message || "Could not delete the plan.", variant: "destructive"});
     }
  };
  
  if (authLoading) {
    return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
   if (!user) {
    return <div className="flex flex-1 items-center justify-center p-4"><p>Please log in to use the Study Planner.</p></div>;
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6 bg-background">
      <div className="mb-6 flex items-center gap-3">
        <CalendarCheck className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
          Personalized Study Planner
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-lg h-fit">
          <CardHeader>
            <CardTitle>Plan Your Studies</CardTitle>
            <CardDescription>Tell us about your exams, weak spots, and preferences to generate a custom study schedule.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <FormLabel className="text-base font-semibold">Exams & Deadlines</FormLabel>
                  <FormDescription className="mb-2">Add your important dates.</FormDescription>
                  <div className="space-y-3">
                    {examFields.map((field, index) => (
                      <Card key={field.id} className="p-3 bg-muted/30">
                        <div className="flex items-center mb-2">
                           <GripVertical className="h-5 w-5 text-muted-foreground mr-1 cursor-grab" />
                           <span className="font-medium text-sm">Entry {index + 1}</span>
                           <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeExam(index)} disabled={examFields.length <= 1}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`exams.${index}.subject`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subject</FormLabel>
                                <FormControl><Input placeholder="e.g., Math" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`exams.${index}.date`}
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Date</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant={"outline"}
                                        className={cn(
                                          "w-full pl-3 text-left font-normal",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value ? formatDateFns(parseDateFns(field.value, "yyyy-MM-dd", new Date()), "PPP") : <span>Pick a date</span>}
                                        <CalendarDays className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value ? parseDateFns(field.value, "yyyy-MM-dd", new Date()) : undefined}
                                      onSelect={(date) => field.onChange(date ? formatDateFns(date, "yyyy-MM-dd") : "")}
                                      disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                            control={form.control}
                            name={`exams.${index}.type`}
                            render={({ field }) => (
                              <FormItem className="mt-3">
                                <FormLabel>Type (Optional)</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type (e.g., Exam)" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Exam">Exam</SelectItem>
                                    <SelectItem value="Final Exam">Final Exam</SelectItem>
                                    <SelectItem value="Midterm">Midterm</SelectItem>
                                    <SelectItem value="Quiz">Quiz</SelectItem>
                                    <SelectItem value="Assignment Due">Assignment Due</SelectItem>
                                    <SelectItem value="Project Deadline">Project Deadline</SelectItem>
                                    <SelectItem value="Presentation">Presentation</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                      </Card>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendExam({ id: crypto.randomUUID(), subject: "", date: "", type: "Exam" })}>
                      <PlusCircle size={16} className="mr-2" /> Add Exam/Deadline
                    </Button>
                  </div>
                </div>
                <FormField
                  control={form.control}
                  name="weakAreas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Weak Areas (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="List subjects or topics you find challenging... Separate with commas or new lines." {...field} 
                        onChange={e => field.onChange(e.target.value.split(/,|\n/).map(s => s.trim()).filter(s => s))}
                        value={Array.isArray(field.value) ? field.value.join(", ") : ""}
                        />
                      </FormControl>
                      <FormDescription>Help the AI prioritize these topics.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="learningPace"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Learning Pace</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select pace" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="relaxed">Relaxed</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="intensive">Intensive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="studyHoursPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Study Hours Per Week (Optional)</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 15" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || undefined)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                    <FormLabel className="text-base font-semibold">Preferred Study Days (Optional)</FormLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                        {daysOfWeek.map((day) => (
                        <FormField
                            key={day}
                            control={form.control}
                            name="preferredStudyDays"
                            render={({ field }) => {
                            return (
                                <FormItem
                                key={day}
                                className="flex flex-row items-center space-x-2 space-y-0 bg-muted/30 p-2 rounded-md border"
                                >
                                <FormControl>
                                    <Checkbox
                                    checked={field.value?.includes(day)}
                                    onCheckedChange={(checked) => {
                                        return checked
                                        ? field.onChange([...(field.value || []), day])
                                        : field.onChange(
                                            (field.value || []).filter(
                                                (value) => value !== day
                                            )
                                            )
                                    }}
                                    />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                    {day}
                                </FormLabel>
                                </FormItem>
                            )
                            }}
                        />
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base font-semibold">Additional Notes (Optional)</FormLabel>
                      <FormControl><Textarea placeholder="e.g., Prefer to study in the mornings..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isGeneratingPlan} className="w-full">
                  {isGeneratingPlan ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                  Generate Study Plan
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          {isGeneratingPlan && (
            <Card className="shadow-lg">
              <CardHeader><CardTitle>Generating Your Plan...</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="ml-4 text-lg">AI is crafting your schedule!</p>
              </CardContent>
            </Card>
          )}
          {!isGeneratingPlan && !displayedPlan && (
            <Card className="shadow-lg">
              <CardHeader><CardTitle>Your Study Plan Will Appear Here</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Fill out the form and click "Generate Study Plan".</p>
              </CardContent>
            </Card>
          )}
          {displayedPlan && (
            <Card className="shadow-lg">
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl font-semibold text-primary">{displayedPlan.planTitle || "Your Personalized Study Plan"}</CardTitle>
                  {displayedPlan.summaryNotes && <CardDescription>{displayedPlan.summaryNotes}</CardDescription>}
                  {isDisplayingSavedPlan && 'savedAt' in displayedPlan && (
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      Saved: {formatDistanceToNow(new Date(displayedPlan.savedAt), { addSuffix: true })}
                    </CardDescription>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {generatedPlan && !isDisplayingSavedPlan && ( // Only show save for newly generated plans
                     <Button variant="outline" size="sm" onClick={handleSavePlan} disabled={isSavingPlan}>
                        {isSavingPlan ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Save size={16} className="mr-2" />}
                        Save Plan
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={handleDownloadPlan} disabled={isGeneratingPlan}>
                    <Download size={16} className="mr-2" />
                    Download Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {displayedPlan.dailySessions && displayedPlan.dailySessions.length > 0 ? (
                  <ScrollArea className="h-[500px]"> 
                    <Accordion type="multiple" defaultValue={displayedPlan.dailySessions.map(day => day.date)} className="w-full">
                      {displayedPlan.dailySessions.map((day, dayIndex) => (
                        <AccordionItem value={day.date} key={dayIndex} className="mb-2 border-b-0">
                           <AccordionTrigger className="bg-muted/50 hover:bg-muted/80 px-4 py-3 rounded-md text-left text-md font-medium text-foreground">
                             {formatDateFns(parseDateFns(day.date, "yyyy-MM-dd", new Date()), "EEEE, MMMM d, yyyy")}
                           </AccordionTrigger>
                           <AccordionContent className="pt-2 pb-0 pl-2">
                            <div className="space-y-2 pl-4 border-l-2 border-primary/50 ml-2">
                              {day.sessions.length > 0 ? day.sessions.map((session, sessionIndex) => (
                                <Card key={sessionIndex} className={cn("p-3", session.isBreak ? "bg-blue-50 border-blue-200" : "bg-background")}>
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <p className="font-semibold text-primary">{session.subject}</p>
                                      <p className="text-sm">{session.activity}</p>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                      <p className="text-xs font-medium text-muted-foreground">
                                        {session.startTime} - {session.endTime}
                                      </p>
                                      {session.isBreak && <span className="text-xs text-blue-600 font-medium">(Break)</span>}
                                    </div>
                                  </div>
                                </Card>
                              )) : (
                                <p className="text-sm text-muted-foreground py-2">No sessions scheduled for this day.</p>
                              )}
                            </div>
                           </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </ScrollArea>
                ) : (
                  <p className="text-muted-foreground">No study sessions generated. Try adjusting your inputs.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Saved Plans Section */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FolderOpen className="h-6 w-6 text-primary"/> Your Saved Study Plans</CardTitle>
              <CardDescription>View or delete your previously saved study schedules.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingSavedPlans ? (
                <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : savedPlans.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">You haven't saved any study plans yet.</p>
              ) : (
                <ScrollArea className="h-60"> {/* Adjust height as needed */}
                  <div className="space-y-3 pr-2">
                    {savedPlans.map(plan => (
                      <Card key={plan.id} className="p-3 bg-muted/20 hover:shadow-md transition-shadow">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                          <div className="mb-2 sm:mb-0">
                            <p className="font-semibold text-card-foreground">{plan.planTitle || "Untitled Plan"}</p>
                            <p className="text-xs text-muted-foreground">
                              Saved: {formatDistanceToNow(new Date(plan.savedAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button variant="outline" size="sm" onClick={() => handleViewSavedPlan(plan)}>
                              <Eye size={14} className="mr-1.5"/> View
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="bg-destructive/80 hover:bg-destructive text-destructive-foreground">
                                  <Trash2 size={14} className="mr-1.5"/> Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Saved Plan?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this saved study plan? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteSavedPlan(plan.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
