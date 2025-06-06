"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle, XCircle, Lightbulb, FileText, Brain, Clock, Percent, LogOut, Home, ChevronDown } from "lucide-react";
import { getTestSetDetails, submitTestAndSaveAnswers, saveTestAnalysis } from "@/lib/database";
import { analyzeTestResults } from "@/ai/flows/analyze-test-results-flow"; 
import type { TestSet, TestQuestion, QuestionAnalysis, UserAnswer, TestAnalysisReport } from "@/types";
import { formatDistanceToNow } from 'date-fns';
import ReactMarkdown from 'react-markdown';
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
import { cn } from "@/lib/utils";


// Function to generate a basic report when AI is unavailable
const generateBasicReport = (submittedTest: TestSet): TestAnalysisReport => {
  let correctObjectiveAnswers = 0;
  let totalObjectiveQuestions = 0;

  const questionAnalyses: QuestionAnalysis[] = submittedTest.questions.map(q => {
    const userAnswerValue = submittedTest.userResponses?.[q.id];
    let userAnswerText = userAnswerValue || "Not Attempted";
    let isCorrect = false;

    if (q.type === 'objective') {
      totalObjectiveQuestions++;
      const selectedOption = q.options?.find(opt => opt.id === userAnswerValue);
      if (selectedOption) {
        userAnswerText = selectedOption.text;
      } else if (userAnswerValue) {
        userAnswerText = "Invalid option selected";
      }

      if (userAnswerValue && userAnswerValue === q.correctAnswerKey) {
        isCorrect = true;
        correctObjectiveAnswers++;
      }
    } else { // Subjective
        if (!userAnswerValue?.trim()) userAnswerText = "Not Attempted";
    }

    return {
      questionId: q.id,
      questionText: q.questionText,
      userAnswerText: userAnswerText,
      correctAnswerText: q.correctAnswerText || (q.type === 'objective' ? "Correct answer not specified" : "Model answer not specified"),
      isCorrect: isCorrect,
      feedback: "AI-powered feedback is temporarily unavailable for this question.",
      suggestedScoreOutOfTen: undefined, // No AI scoring in basic report
    };
  });

  const overallScore = totalObjectiveQuestions > 0 
    ? (correctObjectiveAnswers / totalObjectiveQuestions) * 100 
    : null;

  return {
    overallScore,
    overallFeedback: "Basic report generated. AI analysis is temporarily unavailable. This report primarily reflects performance on objective questions.",
    questionAnalyses,
  };
};

// Add generateStaticParams function for static export
export async function generateStaticParams() {
  // Return empty array for static export - pages will be generated on demand
  return [];
}

export default function TestTakingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const testId = params.testId as string;
  const { toast } = useToast();

  const [testSet, setTestSet] = useState<TestSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({}); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showConfirmSubmitDialog, setShowConfirmSubmitDialog] = useState(false);
  const [showConfirmExitDialog, setShowConfirmExitDialog] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const reportCardRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (authLoading || !user || !testId) {
      if (!authLoading && !user && !isLoading) setIsLoading(false); 
      return;
    }
    
    if (isLoading || (testSet && testSet.id !== testId)) {
        setIsLoading(true);
        const currentTestIdInState = testSet?.id;
        if (currentTestIdInState !== testId) {
            // Reset timeLeft only if we are loading a *different* test
            setTimeLeft(null); 
        }
        const unsubscribe = getTestSetDetails(user.uid, testId, (data) => {
        setTestSet(data);
        if (data) {
            // Initialize timeLeft ONLY if it's null AND the test is 'generated' and has a time limit
            if (data.status === 'generated' && data.timeLimitMinutes && timeLeft === null) { 
                setTimeLeft(data.timeLimitMinutes * 60);
            } else if (data.status !== 'generated') { 
                // If test is not in 'generated' state (e.g., already submitted/analyzed), clear the timer
                setTimeLeft(null);
            }
            if (data.userResponses) {
                setUserAnswers(data.userResponses);
            }
        }
        setIsLoading(false);
        });
        return () => unsubscribe();
    } else {
        // If testSet.id === testId, and we are not loading, ensure isLoading is false.
        if (isLoading) setIsLoading(false);
    }
  }, [user, testId, authLoading, isLoading, testSet, timeLeft]); // timeLeft in dependency array to manage re-initialization carefully

  const handleSubmitTest = useCallback(async (forceSubmit: boolean = false) => {
    if (!user || !testSet || testSet.status !== 'generated') return;

    if (!forceSubmit) {
        const unansweredQuestions = testSet.questions.filter(q => !userAnswers[q.id]?.trim()).length;
        if (unansweredQuestions > 0) {
            setShowConfirmSubmitDialog(true);
            return;
        }
    }
    setShowConfirmSubmitDialog(false); 
    setSubmissionError(null); 
    setIsSubmitting(true);
    setIsAnalyzing(false); 
    toast({ title: "Submitting Test...", description: "Please wait while we save your answers." });

    let submittedTest: TestSet | null = null;
    try {
      submittedTest = await submitTestAndSaveAnswers(user.uid, testId, userAnswers);
      setIsSubmitting(false); 
      
      if (!submittedTest) {
        throw new Error("Failed to retrieve submitted test data for analysis after saving answers.");
      }
      
      setIsAnalyzing(true);
      toast({ title: "Test Submitted!", description: "Your answers have been saved. Now analyzing..." });
      
      const analysisInput = {
        testTitle: submittedTest.title,
        testSubject: submittedTest.subject,
        testDescription: submittedTest.description,
        questions: submittedTest.questions.map(q => ({ 
            id: q.id,
            questionText: q.questionText,
            type: q.type,
            options: q.options,
            correctAnswerKey: q.correctAnswerKey,
            correctAnswerText: q.correctAnswerText,
        })),
        userResponses: submittedTest.userResponses || {},
      };
      
      let analysisResult: TestAnalysisReport;
      try {
        analysisResult = await analyzeTestResults(analysisInput);
      } catch (aiError: any) {
        const aiErrorMessage = (aiError as Error).message || "AI analysis failed.";
        if (aiErrorMessage.includes("503") || aiErrorMessage.toLowerCase().includes("overloaded") || aiErrorMessage.toLowerCase().includes("service unavailable")) {
          toast({ title: "AI Model Overloaded", description: "Generating a basic report instead. AI feedback will be limited.", variant: "default", duration: 7000 });
          if (!submittedTest) throw new Error("Submitted test data not available for basic report generation.");
          analysisResult = generateBasicReport(submittedTest);
        } else {
          throw aiError; 
        }
      }
      
      await saveTestAnalysis(user.uid, testId, analysisResult);
      toast({ title: "Analysis Complete!", description: "Your test report is ready." });
      setIsAnalyzing(false); 

    } catch (error) {
      console.error("Error submitting or analyzing test:", error);
      const errorMessage = (error as Error).message || "Could not process your test. Please try again.";
      toast({ title: "Submission or Analysis Failed", description: errorMessage, variant: "destructive" });
      setSubmissionError(errorMessage);
      setIsSubmitting(false); 
      setIsAnalyzing(false); 
    }
  }, [user, testSet, testId, userAnswers, toast, analyzeTestResults]); 

  useEffect(() => {
    if (testSet?.status !== 'generated' || timeLeft === null || timeLeft <= 0 || isSubmitting || isAnalyzing) {
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime !== null && prevTime > 0) {
          return prevTime - 1;
        }
        clearInterval(timer);
        if (prevTime !== null && prevTime <= 1 && testSet?.status === 'generated' && !isSubmitting && !isAnalyzing) { 
          toast({ title: "Time's Up!", description: "Submitting your test automatically.", variant: "default" });
          handleSubmitTest(true); 
        }
        return 0;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, testSet?.status, isSubmitting, isAnalyzing, toast, handleSubmitTest]);

  useEffect(() => {
    const checkScrollability = () => {
      if (typeof window !== 'undefined' && testSet?.status === 'analyzed' && testSet.analysis) {
        // Delay to allow DOM to update with report content
        const timerId = setTimeout(() => {
          if (typeof window !== 'undefined') { // Check window again inside timeout
            const isScrollable = document.documentElement.scrollHeight > window.innerHeight;
            setShowScrollToBottom(isScrollable);
          }
        }, 500); // Increased timeout
        return () => clearTimeout(timerId); // Cleanup timeout
      } else {
        setShowScrollToBottom(false);
      }
    };

    checkScrollability();
    
    // Add resize listener
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', checkScrollability);
    }
    // Cleanup resize listener
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkScrollability);
      }
    };
  }, [testSet?.status, testSet?.analysis]); // Re-check when analysis data is available

  const scrollToBottom = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
    }
  };


  const currentQuestion: TestQuestion | undefined = testSet?.questions?.[currentQuestionIndex];

  const handleAnswerChange = (questionId: string, answerValue: string) => {
    if (isSubmitting || isAnalyzing) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: answerValue }));
  };

  const handleNextQuestion = () => {
    if (testSet && currentQuestionIndex < testSet.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };
  
  const formatTime = (seconds: number | null): string => {
    if (seconds === null) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const progressPercentage = useMemo(() => {
    if (!testSet || !testSet.questions) return 0;
    return ((currentQuestionIndex + 1) / testSet.questions.length) * 100;
  }, [currentQuestionIndex, testSet]);


  if (authLoading || isLoading) {
    return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return <div className="flex flex-1 items-center justify-center p-4"><p>Please log in to access tests.</p></div>;
  }
  
  if (submissionError) {
    let advice = "";
    if (submissionError.includes("503") || submissionError.toLowerCase().includes("overloaded") || submissionError.toLowerCase().includes("service unavailable")) {
      advice = "The AI model seems to be busy or unavailable. Please try submitting again in a few minutes.";
    }
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error During Processing</h2>
        <p className="text-muted-foreground mb-1">{submissionError}</p>
        {advice && <p className="text-muted-foreground mb-4 text-sm">{advice}</p>}
        <Button onClick={() => router.push('/tests')} className="mt-4">Back to Tests</Button>
      </div>
    );
  }

  if (!testSet) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <FileText className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive">Test Not Found</h2>
        <p className="text-muted-foreground">The test you are looking for does not exist or you may not have permission to view it.</p>
        <Button onClick={() => router.push('/tests')} className="mt-4">Back to Tests</Button>
      </div>
    );
  }
  
  const canNavigatePrev = currentQuestionIndex > 0;
  const canNavigateNext = testSet && currentQuestionIndex < testSet.questions.length - 1;

  if (isSubmitting ) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Submitting Your Answers...</h2>
        <p className="text-muted-foreground">This may take a moment. Please don't close this page.</p>
      </div>
    );
  }
  
  if (isAnalyzing || (testSet.status === 'submitted' && !testSet.analysis)) {
     return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">AI is Analyzing Your Results...</h2>
        <p className="text-muted-foreground">This may take a moment. Please don't close this page.</p>
      </div>
    );
  }


  if (testSet.status === 'generated') {
    if (!currentQuestion) return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading question...</p></div>;

    return (
      <div className="flex flex-1 flex-col p-4 md:p-6 bg-background">
        <Button 
            variant="outline" 
            size="sm" 
            onClick={() => router.push("/tests")} 
            className="mb-4 self-start"
            disabled={isSubmitting || isAnalyzing}
        >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Tests
        </Button>
        <Card className="w-full max-w-3xl mx-auto shadow-xl">
          <CardHeader className="border-b">
            <div className="flex justify-between items-center">
                <CardTitle className="text-xl md:text-2xl font-bold text-primary">{testSet.title}</CardTitle>
                {testSet.timeLimitMinutes && timeLeft !== null && (
                    <div className="flex items-center gap-2 text-lg font-semibold text-destructive">
                        <Clock size={20}/> 
                        <span>{formatTime(timeLeft)}</span>
                    </div>
                )}
            </div>
            {testSet.subject && <CardDescription className="text-sm">{testSet.subject}</CardDescription>}
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-medium text-muted-foreground">
                        Question {currentQuestionIndex + 1} of {testSet.questions.length} ({currentQuestion.type})
                    </p>
                    <p className="text-sm font-medium text-muted-foreground">
                        {progressPercentage.toFixed(0)}%
                    </p>
                </div>
              <Progress value={progressPercentage} className="w-full h-2 mb-4" />
            </div>
            
            <div className="text-lg font-semibold mb-3">
              <ReactMarkdown
                components={{
                  p: ({node, ...props}) => <span className="inline" {...props} />, // Render paragraphs as inline spans to avoid extra margins
                  code: ({node, inline, className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <pre className={cn("font-code my-1 p-1 text-sm bg-muted text-muted-foreground rounded", className)} {...props}>
                        <code>{String(children).replace(/\n$/, '')}</code>
                      </pre>
                    ) : (
                      <code className={cn("font-code px-1 py-0.5 text-sm bg-muted text-muted-foreground rounded",className)} {...props}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {currentQuestion.questionText}
              </ReactMarkdown>
            </div>
            
            {currentQuestion.type === 'objective' && currentQuestion.options && (
              <RadioGroup
                value={userAnswers[currentQuestion.id] || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-2"
                disabled={isSubmitting || isAnalyzing}
              >
                {currentQuestion.options.map((option) => (
                  <Label
                    key={option.id}
                    htmlFor={`${currentQuestion.id}-${option.id}`}
                    className={cn(
                      "flex items-center space-x-3 rounded-md border p-3 hover:bg-accent/50 transition-colors cursor-pointer",
                      userAnswers[currentQuestion.id] === option.id && "bg-primary/10 border-primary ring-2 ring-primary",
                      (isSubmitting || isAnalyzing) && "cursor-not-allowed opacity-70"
                    )}
                  >
                    <RadioGroupItem value={option.id} id={`${currentQuestion.id}-${option.id}`} disabled={isSubmitting || isAnalyzing} />
                    <span className="text-sm">{option.text}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.type === 'subjective' && (
              <Textarea
                value={userAnswers[currentQuestion.id] || ""}
                onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                placeholder="Type your answer here..."
                rows={6}
                className="text-base"
                disabled={isSubmitting || isAnalyzing}
              />
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between border-t pt-6 gap-2">
            <div className="w-full sm:w-auto">
                <Button 
                    variant="outline" 
                    onClick={() => setShowConfirmExitDialog(true)} 
                    disabled={isSubmitting || isAnalyzing}
                    className="w-full"
                >
                <LogOut className="mr-2 h-4 w-4" /> Exit Test
                </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    variant="outline" 
                    onClick={handlePrevQuestion} 
                    disabled={!canNavigatePrev || isSubmitting || isAnalyzing}
                    className="flex-1 sm:flex-initial"
                >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                {!canNavigateNext ? (
                <Button onClick={() => handleSubmitTest(false)} disabled={isSubmitting || isAnalyzing} className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-initial">
                    {(isSubmitting || isAnalyzing) ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Submit Test
                </Button>
                ) : (
                <Button 
                    variant="default" 
                    onClick={handleNextQuestion} 
                    disabled={!canNavigateNext || isSubmitting || isAnalyzing}
                    className="flex-1 sm:flex-initial"
                >
                    Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                )}
            </div>
          </CardFooter>
        </Card>
        
        <AlertDialog open={showConfirmSubmitDialog} onOpenChange={setShowConfirmSubmitDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirm Submission</AlertDialogTitle>
                <AlertDialogDescription>
                    You have unanswered questions. Are you sure you want to submit the test?
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleSubmitTest(true)} className="bg-destructive hover:bg-destructive/90">Submit Anyway</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showConfirmExitDialog} onOpenChange={setShowConfirmExitDialog}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Exit Test?</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to exit? Your current answers will be saved, but the test will not be submitted for grading. You can resume later.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Stay in Test</AlertDialogCancel>
                <AlertDialogAction onClick={() => router.push('/tests')} variant="destructive">
                    Exit Test
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

      </div>
    );
  }
  
  if (testSet.status === 'analyzed' && testSet.analysis) {
    const analysis = testSet.analysis;
    return (
      <div className="p-4 md:p-6 bg-background">
        <div className="max-w-4xl mx-auto space-y-6" ref={reportCardRef}> 
          <Card className="shadow-xl">
             <CardHeader className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-1">
                    <div className="flex items-center gap-3">
                    <Brain size={32}/>
                    <CardTitle className="text-3xl font-bold">{testSet.title} - Report</CardTitle>
                    </div>
                    <Button 
                      onClick={() => router.push('/chat')} 
                      variant="secondary" // Changed variant for better contrast
                      size="sm" 
                      className="self-start sm:self-center" // Ensure good alignment
                    >
                      <Home className="mr-2 h-4 w-4" /> Back to Home
                    </Button>
                </div>
                {testSet.subject && <CardDescription className="text-primary-foreground/80 text-sm">{testSet.subject}</CardDescription>}
                <CardDescription className="text-xs text-primary-foreground/70 mt-1">
                    Submitted: {testSet.submittedAt ? formatDistanceToNow(new Date(testSet.submittedAt), { addSuffix: true }) : "N/A"}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card className="bg-muted/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2"><Percent size={20} className="text-primary"/>Overall Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-5xl font-bold text-primary">{analysis.overallScore?.toFixed(0) ?? 'N/A'}%</p>
                    </CardContent>
                </Card>
                <Card className="bg-muted/30">
                     <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2"><Lightbulb size={20} className="text-amber-500"/>Overall Feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{analysis.overallFeedback || "No overall feedback provided."}</p>
                    </CardContent>
                </Card>
              </div>
              
              <h3 className="text-2xl font-semibold mb-4 text-foreground border-b pb-2">Question Breakdown</h3>
              <ScrollArea className="h-[50vh] pr-2"> 
                <div className="space-y-4">
                  {analysis.questionAnalyses?.map((qa: QuestionAnalysis, index: number) => (
                    <Card key={qa.questionId} className="overflow-hidden bg-card border">
                      <CardHeader className={cn(
                          "p-4 border-b",
                          qa.isCorrect ? "bg-green-500/10 border-green-500/20" : "bg-red-500/10 border-red-500/20"
                      )}>
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-md font-semibold text-foreground">
                            Question {index + 1}: { qa.isCorrect 
                              ? <CheckCircle size={18} className="inline mr-2 text-green-600" /> 
                              : <XCircle size={18} className="inline mr-2 text-red-600" /> 
                            }
                            {qa.isCorrect ? "Correct" : "Incorrect"}
                          </CardTitle>
                          {qa.suggestedScoreOutOfTen !== undefined && qa.suggestedScoreOutOfTen !== null && (
                              <p className={cn(
                                  "text-sm font-semibold px-2 py-1 rounded-md",
                                  qa.suggestedScoreOutOfTen >= 7 ? "bg-green-100 text-green-700" :
                                  qa.suggestedScoreOutOfTen >=4 ? "bg-yellow-100 text-yellow-700" :
                                  "bg-red-100 text-red-700"
                              )}>
                                  AI Score: {qa.suggestedScoreOutOfTen}/10
                              </p>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        <p className="text-sm text-muted-foreground font-medium">Question:</p>
                        <div className="text-sm text-foreground">
                            <ReactMarkdown
                                components={{
                                  p: ({node, ...props}) => <span className="inline" {...props} />,
                                  code: ({node, inline, className, children, ...props}) => {
                                    const match = /language-(\w+)/.exec(className || '')
                                    return !inline && match ? (
                                      <pre className={cn("font-code my-1 p-1 text-sm bg-muted text-muted-foreground rounded", className)} {...props}>
                                        <code>{String(children).replace(/\n$/, '')}</code>
                                      </pre>
                                    ) : (
                                      <code className={cn("font-code px-1 py-0.5 text-sm bg-muted text-muted-foreground rounded",className)} {...props}>
                                        {children}
                                      </code>
                                    )
                                  }
                                }}
                            >
                                {qa.questionText}
                            </ReactMarkdown>
                        </div>
                        
                        <p className="text-sm text-muted-foreground font-medium mt-2">Your Answer:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap border-l-4 border-blue-400/50 pl-2 py-1 bg-blue-500/10 rounded-sm">{qa.userAnswerText || <span className="italic text-muted-foreground">No answer provided</span>}</p>
                        
                        {!qa.isCorrect && qa.correctAnswerText && (
                          <>
                            <p className="text-sm text-muted-foreground font-medium mt-2">Correct Answer:</p>
                            <p className="text-sm text-foreground whitespace-pre-wrap border-l-4 border-green-400/50 pl-2 py-1 bg-green-500/10 rounded-sm">{qa.correctAnswerText}</p>
                          </>
                        )}
                        
                        <p className="text-sm text-muted-foreground font-medium mt-2">AI Feedback:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{qa.feedback || "No specific feedback for this question."}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-6 border-t flex flex-wrap justify-start items-center gap-2"> 
              <Button onClick={() => router.push('/tests')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Tests
              </Button>
            </CardFooter>
          </Card>
        </div>
        {showScrollToBottom && (
          <Button
            onClick={scrollToBottom}
            variant="default" 
            size="icon"
            className="fixed bottom-6 right-6 z-[60] rounded-full h-12 w-12 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-6 w-6" />
          </Button>
        )}
      </div>
    );
  }
  
  return (
     <div className="flex flex-1 flex-col items-center justify-center p-4">
        <FileText className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Unexpected Test State</h2>
        <p className="text-muted-foreground mb-4">The test is in an unrecognized state (Status: {testSet?.status || 'Unknown'}). Please try again later or contact support.</p>
        <Button onClick={() => router.push('/tests')} className="mt-4">Back to Tests</Button>
      </div>
  );
}









