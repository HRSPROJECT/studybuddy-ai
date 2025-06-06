
import type { User } from 'firebase/auth';
import { ref, set, push, get, serverTimestamp, update, query, orderByChild, limitToLast, onValue, off, increment, runTransaction, remove } from 'firebase/database';
import { db } from './firebase';
import type { Conversation, Message, ConversationListItem, CommunityPost, CommunityComment, StudyPlanFromAI, SavedStudyPlan, FlashcardSet, Flashcard, TestSet, TestQuestion, TestAnalysisReport } from '@/types';
import { summarizeConversation as summarizeConversationAI } from '@/ai/flows/summarize-conversation';


export const createNewConversation = async (user: User, firstMessage: Message): Promise<string> => {
  if (!user || !user.uid) throw new Error("User not authenticated.");

  const conversationHistoryText = `${firstMessage.role}: ${firstMessage.content}`;
  let title = firstMessage.content.substring(0, 50) + (firstMessage.content.length > 50 ? "..." : "");
  try {
    const summaryResult = await summarizeConversationAI({ conversationHistory: conversationHistoryText });
    title = summaryResult.summary;
  } catch (error) {
    console.warn("AI summarization for title failed, using default title:", error);
  }
  
  const conversationRef = ref(db, `conversations/${user.uid}`);
  const newConversationRef = push(conversationRef);
  const newConversationId = newConversationRef.key;

  if (!newConversationId) throw new Error("Failed to generate conversation ID.");
  
  const conversationData: Partial<Conversation> = {
    id: newConversationId,
    title: title,
    userId: user.uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [firstMessage],
  };

  await set(newConversationRef, conversationData);
  return newConversationId;
};

export const addMessageToConversation = async (userId: string, conversationId: string, message: Message): Promise<void> => {
  const messagesRef = ref(db, `conversations/${userId}/${conversationId}/messages`);
  const newMessageRef = push(messagesRef); 
  message.id = newMessageRef.key!;
  await set(newMessageRef, message);

  const conversationRef = ref(db, `conversations/${userId}/${conversationId}`);
  await update(conversationRef, {
    updatedAt: new Date().toISOString(),
  });
};

export const getConversation = (userId: string, conversationId: string, callback: (data: Conversation | null) => void): (() => void) => {
  const conversationRef = ref(db, `conversations/${userId}/${conversationId}`);
  onValue(conversationRef, (snapshot) => {
    const val = snapshot.val();
    if (val) {
      if (val.messages && typeof val.messages === 'object' && !Array.isArray(val.messages)) {
        val.messages = Object.values(val.messages);
      } else if (!val.messages) {
        val.messages = [];
      }
    }
    callback(val as Conversation | null);
  });
  return () => off(conversationRef);
};

export const getConversationList = (userId: string, callback: (conversations: ConversationListItem[]) => void): (() => void) => {
  const conversationsRef = query(ref(db, `conversations/${userId}`), orderByChild('updatedAt'), limitToLast(50));
  
  onValue(conversationsRef, (snapshot) => {
    const conversationsData = snapshot.val();
    if (conversationsData) {
      const list: ConversationListItem[] = Object.entries(conversationsData)
        .map(([id, convo]: [string, any]) => ({ 
          id,
          title: convo.title || 'Untitled Conversation',
          lastMessageAt: convo.updatedAt || convo.createdAt,
        }))
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(conversationsRef);
};

export const deleteConversation = async (userId: string, conversationId: string): Promise<void> => {
  if (!userId) throw new Error("User ID is required.");
  if (!conversationId) throw new Error("Conversation ID is required.");

  const conversationRef = ref(db, `conversations/${userId}/${conversationId}`);
  await remove(conversationRef);
};


// Community Chat Database Functions

export const createCommunityPost = async (userId: string, username: string, questionText: string, imageUrl?: string | null): Promise<string> => {
  const postsRef = ref(db, 'communityPosts');
  const newPostRef = push(postsRef);
  const postId = newPostRef.key;
  if (!postId) throw new Error('Failed to generate post ID.');

  const postData: CommunityPost = {
    id: postId,
    userId,
    username,
    questionText,
    imageUrl: imageUrl || null,
    timestamp: new Date().toISOString(),
    likes: 0,
    likedBy: {},
    comments: {},
    commentCount: 0,
  };
  await set(newPostRef, postData);
  return postId;
};

export const getCommunityPosts = (callback: (posts: CommunityPost[]) => void): (() => void) => {
  const postsRef = query(ref(db, 'communityPosts'), orderByChild('timestamp'), limitToLast(100)); 
  onValue(postsRef, (snapshot) => {
    const postsData = snapshot.val();
    if (postsData) {
      const list: CommunityPost[] = Object.values(postsData)
        .sort((a, b) => new Date((b as CommunityPost).timestamp).getTime() - new Date((a as CommunityPost).timestamp).getTime());
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(postsRef);
};

export const addCommentToCommunityPost = async (postId: string, userId: string, username: string, text: string): Promise<string> => {
  const commentsRef = ref(db, `communityPosts/${postId}/comments`);
  const newCommentRef = push(commentsRef);
  const commentId = newCommentRef.key;
  if (!commentId) throw new Error('Failed to generate comment ID.');

  const commentData: CommunityComment = {
    id: commentId,
    postId,
    userId,
    username,
    text,
    timestamp: new Date().toISOString(),
    likes: 0,
    likedBy: {},
  };
  await set(newCommentRef, commentData);

  const postRef = ref(db, `communityPosts/${postId}`);
  await update(postRef, {
    commentCount: increment(1)
  });

  return commentId;
};

export const getCommentsForPost = (postId: string, callback: (comments: CommunityComment[]) => void): (() => void) => {
  const commentsRef = query(ref(db, `communityPosts/${postId}/comments`), orderByChild('timestamp'));
  onValue(commentsRef, (snapshot) => {
    const commentsData = snapshot.val();
    if (commentsData) {
      const list: CommunityComment[] = Object.values(commentsData)
        .sort((a, b) => new Date((a as CommunityComment).timestamp).getTime() - new Date((b as CommunityComment).timestamp).getTime());
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(commentsRef);
};


export const likeCommunityPost = async (postId: string, userId: string): Promise<void> => {
  const postRef = ref(db, `communityPosts/${postId}`);
  await runTransaction(postRef, (post: CommunityPost | null) => {
    if (post) {
      if (!post.likedBy) {
        post.likedBy = {};
      }
      if (post.likedBy[userId]) {
        post.likes = (post.likes || 0) - 1;
        delete post.likedBy[userId];
      } else {
        post.likes = (post.likes || 0) + 1;
        post.likedBy[userId] = true;
      }
    }
    return post;
  });
};


export const likeCommunityComment = async (postId: string, commentId: string, userId: string): Promise<void> => {
  const commentRef = ref(db, `communityPosts/${postId}/comments/${commentId}`);
  await runTransaction(commentRef, (comment: CommunityComment | null) => {
    if (comment) {
      if (!comment.likedBy) {
        comment.likedBy = {};
      }
      if (comment.likedBy[userId]) {
        comment.likes = (comment.likes || 0) - 1;
        delete comment.likedBy[userId];
      } else {
        comment.likes = (comment.likes || 0) + 1;
        comment.likedBy[userId] = true;
      }
    }
    return comment;
  });
};

export const deleteCommunityPost = async (postId: string, currentUserId: string): Promise<void> => {
  const postRef = ref(db, `communityPosts/${postId}`);
  const postSnapshot = await get(postRef);
  if (!postSnapshot.exists()) {
    throw new Error("Post not found.");
  }
  const postData = postSnapshot.val() as CommunityPost;
  if (postData.userId !== currentUserId) {
    throw new Error("You are not authorized to delete this post.");
  }
  await remove(postRef);
};

export const deleteCommunityComment = async (postId: string, commentId: string, currentUserId: string): Promise<void> => {
  const commentRef = ref(db, `communityPosts/${postId}/comments/${commentId}`);
  const commentSnapshot = await get(commentRef);
  if (!commentSnapshot.exists()) {
    throw new Error("Comment not found.");
  }
  const commentData = commentSnapshot.val() as CommunityComment;
  if (commentData.userId !== currentUserId) {
    throw new Error("You are not authorized to delete this comment.");
  }
  await remove(commentRef);

  const postRef = ref(db, `communityPosts/${postId}`);
  await update(postRef, {
    commentCount: increment(-1)
  });
};

export const updateCommunityPost = async (postId: string, newText: string, newImageUrl: string | null, currentUserId: string): Promise<void> => {
  const postRef = ref(db, `communityPosts/${postId}`);
  const postSnapshot = await get(postRef);
  if (!postSnapshot.exists()) {
    throw new Error("Post not found.");
  }
  const postData = postSnapshot.val() as CommunityPost;
  if (postData.userId !== currentUserId) {
    throw new Error("You are not authorized to edit this post.");
  }
  await update(postRef, {
    questionText: newText,
    imageUrl: newImageUrl,
    updatedAt: new Date().toISOString(),
  });
};

export const updateCommunityCommentText = async (postId: string, commentId: string, newText: string, currentUserId: string): Promise<void> => {
  const commentRef = ref(db, `communityPosts/${postId}/comments/${commentId}`);
  const commentSnapshot = await get(commentRef);
  if (!commentSnapshot.exists()) {
    throw new Error("Comment not found.");
  }
  const commentData = commentSnapshot.val() as CommunityComment;
  if (commentData.userId !== currentUserId) {
    throw new Error("You are not authorized to edit this comment.");
  }
  await update(commentRef, {
    text: newText,
    updatedAt: new Date().toISOString(),
  });
};

// Study Planner Database Functions

export const saveStudyPlan = async (userId: string, planData: StudyPlanFromAI): Promise<string> => {
  if (!userId) throw new Error("User not authenticated.");

  const plansRef = ref(db, `studyPlans/${userId}`);
  const newPlanRef = push(plansRef);
  const planId = newPlanRef.key;
  if (!planId) throw new Error("Failed to generate plan ID.");

  const savedPlan: SavedStudyPlan = {
    ...planData,
    id: planId,
    savedAt: new Date().toISOString(), 
  };

  await set(newPlanRef, savedPlan);
  return planId;
};

export const getSavedStudyPlans = (userId: string, callback: (plans: SavedStudyPlan[]) => void): (() => void) => {
  const plansQuery = query(ref(db, `studyPlans/${userId}`), orderByChild('savedAt'));
  
  const listener = onValue(plansQuery, (snapshot) => {
    const plansData = snapshot.val();
    if (plansData) {
      const list: SavedStudyPlan[] = Object.values(plansData)
        .sort((a, b) => new Date((b as SavedStudyPlan).savedAt).getTime() - new Date((a as SavedStudyPlan).savedAt).getTime()); 
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(plansQuery, 'value', listener);
};

export const deleteStudyPlan = async (userId: string, planId: string): Promise<void> => {
  if (!userId) throw new Error("User ID is required.");
  if (!planId) throw new Error("Plan ID is required.");

  const planRef = ref(db, `studyPlans/${userId}/${planId}`);
  await remove(planRef);
};

// Flashcard Database Functions

export const createFlashcardSet = async (userId: string, title: string, subject?: string, chapter?: string): Promise<string> => {
  if (!userId) throw new Error("User not authenticated.");
  const setsRef = ref(db, `flashcardSets/${userId}`);
  const newSetRef = push(setsRef);
  const setId = newSetRef.key;
  if (!setId) throw new Error("Failed to generate flashcard set ID.");

  const setData: FlashcardSet = {
    id: setId,
    userId,
    title,
    subject: subject || "",
    chapter: chapter || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    flashcardCount: 0,
  };
  await set(newSetRef, setData);
  return setId;
};

export const getFlashcardSetsForUser = (userId: string, callback: (sets: FlashcardSet[]) => void): (() => void) => {
  const setsQuery = query(ref(db, `flashcardSets/${userId}`), orderByChild('updatedAt'));
  const listener = onValue(setsQuery, (snapshot) => {
    const setsData = snapshot.val();
    if (setsData) {
      const list: FlashcardSet[] = Object.values(setsData)
        .sort((a, b) => new Date((b as FlashcardSet).updatedAt).getTime() - new Date((a as FlashcardSet).updatedAt).getTime());
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(setsQuery, 'value', listener);
};

export const getFlashcardSetDetails = (userId: string, setId: string, callback: (set: FlashcardSet | null) => void): (() => void) => {
  const setRef = ref(db, `flashcardSets/${userId}/${setId}`);
  const listener = onValue(setRef, (snapshot) => {
    callback(snapshot.val() as FlashcardSet | null);
  });
  return () => off(setRef, 'value', listener);
};


export const addFlashcardToSet = async (userId: string, setId: string, frontText: string, backText: string): Promise<string> => {
  const cardsRef = ref(db, `flashcards/${setId}`);
  const newCardRef = push(cardsRef);
  const cardId = newCardRef.key;
  if (!cardId) throw new Error("Failed to generate flashcard ID.");

  const cardData: Flashcard = {
    id: cardId,
    setId,
    frontText,
    backText,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await set(newCardRef, cardData);

  // Update flashcard count in the set
  const setRef = ref(db, `flashcardSets/${userId}/${setId}`);
  await update(setRef, {
    flashcardCount: increment(1),
    updatedAt: new Date().toISOString(),
  });
  return cardId;
};

export const getFlashcardsInSet = (setId: string, callback: (cards: Flashcard[]) => void): (() => void) => {
  const cardsQuery = query(ref(db, `flashcards/${setId}`), orderByChild('createdAt'));
  const listener = onValue(cardsQuery, (snapshot) => {
    const cardsData = snapshot.val();
    if (cardsData) {
      const list: Flashcard[] = Object.values(cardsData)
         .sort((a,b) => new Date((a as Flashcard).createdAt).getTime() - new Date((b as Flashcard).createdAt).getTime());
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(cardsQuery, 'value', listener);
};

export const updateFlashcardInSet = async (userId: string, setId: string, cardId: string, frontText: string, backText: string): Promise<void> => {
  const cardRef = ref(db, `flashcards/${setId}/${cardId}`);
  await update(cardRef, {
    frontText,
    backText,
    updatedAt: new Date().toISOString(),
  });
  const setRef = ref(db, `flashcardSets/${userId}/${setId}`);
  await update(setRef, {
    updatedAt: new Date().toISOString(),
  });
};

export const deleteFlashcardFromSet = async (userId: string, setId: string, cardId: string): Promise<void> => {
  const cardRef = ref(db, `flashcards/${setId}/${cardId}`);
  await remove(cardRef);

  const setRef = ref(db, `flashcardSets/${userId}/${setId}`);
  await update(setRef, {
    flashcardCount: increment(-1),
    updatedAt: new Date().toISOString(),
  });
};

export const deleteFlashcardSet = async (userId: string, setId: string): Promise<void> => {
  const setRef = ref(db, `flashcardSets/${userId}/${setId}`);
  await remove(setRef);
  // Also delete all flashcards associated with this set
  const cardsRef = ref(db, `flashcards/${setId}`);
  await remove(cardsRef);
};

// Test Generation Database Functions
export const createTestSetAndGenerateQuestions = async (
  userId: string, 
  testDetails: { title: string; subject?: string; description?: string; numSubjective: number; numObjective: number; timeLimitMinutes?: number; }, 
  generatedQuestions: TestQuestion[]
): Promise<string> => {
  if (!userId) throw new Error("User not authenticated.");
  const testSetsRef = ref(db, `testSets/${userId}`);
  const newTestSetRef = push(testSetsRef);
  const testSetId = newTestSetRef.key;
  if (!testSetId) throw new Error("Failed to generate test set ID.");

  const testSetData: TestSet = {
    id: testSetId,
    userId,
    title: testDetails.title,
    subject: testDetails.subject || "",
    description: testDetails.description || "",
    numSubjective: testDetails.numSubjective,
    numObjective: testDetails.numObjective,
    timeLimitMinutes: testDetails.timeLimitMinutes || 60, // Default to 60 minutes if not provided
    questions: generatedQuestions,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'generated', // Initial status
  };
  await set(newTestSetRef, testSetData);
  return testSetId;
};

export const getTestSetsForUser = (userId: string, callback: (sets: TestSet[]) => void): (() => void) => {
  const setsQuery = query(ref(db, `testSets/${userId}`), orderByChild('createdAt'));
  const listener = onValue(setsQuery, (snapshot) => {
    const setsData = snapshot.val();
    if (setsData) {
      const list: TestSet[] = Object.values(setsData)
        .sort((a, b) => new Date((b as TestSet).createdAt).getTime() - new Date((a as TestSet).createdAt).getTime());
      callback(list);
    } else {
      callback([]);
    }
  });
  return () => off(setsQuery, 'value', listener);
};

export const getTestSetDetails = (userId: string, testSetId: string, callback: (set: TestSet | null) => void): (() => void) => {
  const setRef = ref(db, `testSets/${userId}/${testSetId}`);
  const listener = onValue(setRef, (snapshot) => {
    callback(snapshot.val() as TestSet | null);
  });
  return () => off(setRef, 'value', listener);
};

export const submitTestAndSaveAnswers = async (
  userId: string,
  testId: string,
  answers: Record<string, string> // questionId: answerValue
): Promise<TestSet | null> => {
  const testSetRef = ref(db, `testSets/${userId}/${testId}`);
  const submissionTime = new Date().toISOString();
  
  await update(testSetRef, {
    userResponses: answers,
    status: 'submitted',
    submittedAt: submissionTime,
    updatedAt: submissionTime,
  });

  const snapshot = await get(testSetRef);
  return snapshot.val() as TestSet | null;
};


export const saveTestAnalysis = async (userId: string, testId: string, analysis: TestAnalysisReport): Promise<void> => {
  const testSetRef = ref(db, `testSets/${userId}/${testId}`);
  await update(testSetRef, {
    analysis: analysis,
    status: 'analyzed',
    updatedAt: new Date().toISOString(),
  });
};

export const deleteTestSet = async (userId: string, testSetId: string): Promise<void> => {
  if (!userId) throw new Error("User ID is required.");
  if (!testSetId) throw new Error("Test Set ID is required.");
  const testSetRef = ref(db, `testSets/${userId}/${testSetId}`);
  await remove(testSetRef);
};
