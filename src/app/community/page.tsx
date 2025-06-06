
"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CommunityPost, CommunityComment } from "@/types";
import { 
  createCommunityPost, 
  getCommunityPosts, 
  addCommentToCommunityPost, 
  getCommentsForPost,
  likeCommunityPost,
  likeCommunityComment,
  deleteCommunityPost,
  deleteCommunityComment,
  updateCommunityPost, // Renamed from updateCommunityPostText
  updateCommunityCommentText
} from "@/lib/database";
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
import { Loader2, MessageCircle, ThumbsUp, ImagePlus, Send, User, Users, MessageSquareText, Trash2, Edit3, Save, X } from "lucide-react";
import { formatDistanceToNow } from 'date-fns';
import Image from "next/image";
import { cn } from "@/lib/utils";

const IMGBB_API_KEY = "978828685c602c999b5eff9bcbfc45f0"; // User-provided key

interface CommunityPostCardProps {
  post: CommunityPost;
  currentUser: import("firebase/auth").User | null;
  uploadToImgBB: (file: File) => Promise<string | null>;
}

const CommunityPostCard = ({ post, currentUser, uploadToImgBB }: CommunityPostCardProps) => {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const [isEditingPost, setIsEditingPost] = useState(false);
  const [editingPostText, setEditingPostText] = useState(post.questionText);
  const [isSavingPostEdit, setIsSavingPostEdit] = useState(false);
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [isRemovingCurrentImage, setIsRemovingCurrentImage] = useState(false);
  const editingImageInputRef = useRef<HTMLInputElement>(null);


  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isSavingCommentEdit, setIsSavingCommentEdit] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (showComments && post.id) {
      setIsLoadingComments(true);
      const unsubscribe = getCommentsForPost(post.id, (loadedComments) => {
        setComments(loadedComments);
        setIsLoadingComments(false);
      });
      return () => unsubscribe();
    }
  }, [post.id, showComments]);

  const handleAddComment = async () => {
    if (!currentUser || !currentUser.displayName) {
      toast({ title: "Username Required", description: "Please set your display name in Settings to comment.", variant: "destructive" });
      router.push('/settings');
      return;
    }
    if (!newComment.trim()) {
      toast({ title: "Empty Comment", description: "Cannot submit an empty comment.", variant: "destructive" });
      return;
    }
    setIsSubmittingComment(true);
    try {
      await addCommentToCommunityPost(post.id, currentUser.uid, currentUser.displayName, newComment);
      setNewComment("");
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({ title: "Error", description: "Could not add comment.", variant: "destructive" });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleLikePost = async () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "Please log in to like posts.", variant: "destructive"});
      return;
    }
    try {
      await likeCommunityPost(post.id, currentUser.uid);
    } catch (error) {
      console.error("Error liking post:", error);
      toast({ title: "Error", description: (error as Error).message || "Could not like post.", variant: "destructive" });
    }
  };

  const handleLikeComment = async (commentId: string) => {
     if (!currentUser) {
      toast({ title: "Login Required", description: "Please log in to like comments.", variant: "destructive"});
      return;
    }
    try {
      await likeCommunityComment(post.id, commentId, currentUser.uid);
    } catch (error) {
      console.error("Error liking comment:", error);
      toast({ title: "Error", description: (error as Error).message || "Could not like comment.", variant: "destructive" });
    }
  };

  const handleDeletePost = async () => {
    if (!currentUser || currentUser.uid !== post.userId) {
      toast({ title: "Unauthorized", description: "You can only delete your own posts.", variant: "destructive" });
      return;
    }
    try {
      await deleteCommunityPost(post.id, currentUser.uid);
      toast({ title: "Post Deleted", description: "Your post has been removed." });
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({ title: "Error", description: "Could not delete post.", variant: "destructive" });
    }
  };

  const handleDeleteComment = async (commentId: string, commentAuthorId: string) => {
    if (!currentUser || currentUser.uid !== commentAuthorId) {
      toast({ title: "Unauthorized", description: "You can only delete your own comments.", variant: "destructive" });
      return;
    }
    try {
      await deleteCommunityComment(post.id, commentId, currentUser.uid);
      toast({ title: "Comment Deleted", description: "Your comment has been removed." });
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast({ title: "Error", description: "Could not delete comment.", variant: "destructive" });
    }
  };

  const handleEditPost = () => {
    setEditingPostText(post.questionText);
    setEditingImageFile(null);
    setIsRemovingCurrentImage(false);
    setIsEditingPost(true);
  };

  const handleSavePostEdit = async () => {
    if (!currentUser || !editingPostText.trim()) return;
    setIsSavingPostEdit(true);

    let finalImageUrl: string | null = post.imageUrl;

    if (isRemovingCurrentImage) {
      finalImageUrl = null;
    } else if (editingImageFile) {
      const uploadedUrl = await uploadToImgBB(editingImageFile);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      } else {
        toast({ title: "Image Upload Failed", description: "Post text not saved due to image upload error. The original image (if any) is retained.", variant: "destructive" });
        // Retain original image on failure, but still allow text edit
        // Or bail out completely:
        // setIsSavingPostEdit(false);
        // return;
      }
    }

    try {
      await updateCommunityPost(post.id, editingPostText, finalImageUrl, currentUser.uid);
      setIsEditingPost(false);
      setEditingImageFile(null);
      setIsRemovingCurrentImage(false);
      toast({ title: "Post Updated", description: "Your post has been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Could not update post.", variant: "destructive" });
    } finally {
      setIsSavingPostEdit(false);
    }
  };

  const handleEditComment = (comment: CommunityComment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.text);
  };

  const handleSaveCommentEdit = async (commentId: string) => {
    if (!currentUser || !editingCommentText.trim()) return;
    setIsSavingCommentEdit(true);
    try {
      await updateCommunityCommentText(post.id, commentId, editingCommentText, currentUser.uid);
      setEditingCommentId(null);
      toast({ title: "Comment Updated", description: "Your comment has been updated." });
    } catch (error) {
      toast({ title: "Error", description: "Could not update comment.", variant: "destructive" });
    } finally {
      setIsSavingCommentEdit(false);
    }
  };
  
  const hasUserLikedPost = currentUser && post.likedBy && post.likedBy[currentUser.uid];

  return (
    <Card className="mb-6 shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
            <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                {post.username ? post.username.charAt(0).toUpperCase() : <User size={20}/>}
                </AvatarFallback>
            </Avatar>
            <div>
                <CardTitle className="text-lg">{post.username}</CardTitle>
                <CardDescription>
                  {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                  {post.updatedAt && post.updatedAt !== post.timestamp && (
                    <span className="text-xs text-muted-foreground/70"> (edited)</span>
                  )}
                </CardDescription>
            </div>
            </div>
            {currentUser && currentUser.uid === post.userId && (
              <div className="flex items-center space-x-1">
                {!isEditingPost && (
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" onClick={handleEditPost}>
                    <Edit3 size={16} />
                  </Button>
                )}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                        <Trash2 size={16} />
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Post?</AlertDialogTitle>
                        <AlertDialogDescription>
                        Are you sure you want to delete this post? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePost} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditingPost ? (
          <div className="space-y-3">
            <Textarea 
              value={editingPostText} 
              onChange={(e) => setEditingPostText(e.target.value)} 
              rows={4}
              disabled={isSavingPostEdit}
            />
            
            {/* Image editing section */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Edit Image</p>
              {post.imageUrl && !isRemovingCurrentImage && !editingImageFile && (
                <div className="relative group w-fit">
                  <Image src={post.imageUrl} alt="Current post image" width={200} height={150} className="rounded-md border object-contain max-h-[150px]" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 opacity-70 group-hover:opacity-100"
                    onClick={() => {
                      setIsRemovingCurrentImage(true);
                      setEditingImageFile(null); 
                    }}
                    disabled={isSavingPostEdit}
                  >
                    <Trash2 size={14} />
                    <span className="sr-only">Remove Image</span>
                  </Button>
                </div>
              )}
              {editingImageFile && (
                <div className="relative group w-fit">
                   <Image src={URL.createObjectURL(editingImageFile)} alt="New image preview" width={200} height={150} className="rounded-md border object-contain max-h-[150px]" />
                   <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-7 w-7 opacity-70 group-hover:opacity-100 bg-background/50 hover:bg-background/80"
                    onClick={() => {
                      setEditingImageFile(null);
                      if (editingImageInputRef.current) editingImageInputRef.current.value = "";
                    }}
                    disabled={isSavingPostEdit}
                  >
                    <X size={14}/>
                     <span className="sr-only">Cancel Image Selection</span>
                  </Button>
                </div>
              )}

              {isRemovingCurrentImage ? (
                <div className="flex items-center gap-2 text-sm text-destructive p-2 rounded-md bg-destructive/10">
                  <Trash2 size={16} />
                  <span>Image will be removed.</span>
                  <Button variant="ghost" size="sm" onClick={() => setIsRemovingCurrentImage(false)} disabled={isSavingPostEdit} className="text-destructive hover:text-destructive">Undo</Button>
                </div>
              ) : (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editingImageInputRef.current?.click()}
                    disabled={isSavingPostEdit}
                  >
                    <ImagePlus size={16} className="mr-2" />
                    {post.imageUrl || editingImageFile ? "Change Image" : "Add Image"}
                  </Button>
                  <Input
                    type="file"
                    accept="image/*"
                    ref={editingImageInputRef}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        if (file.size > 4 * 1024 * 1024) { 
                          toast({ title: "Image too large", description: "Please upload an image smaller than 4MB.", variant: "destructive"});
                          return;
                        }
                        setEditingImageFile(file);
                        setIsRemovingCurrentImage(false); 
                      }
                    }}
                    className="hidden"
                    disabled={isSavingPostEdit}
                  />
                  {editingImageFile && <span className="text-xs text-muted-foreground ml-2 truncate max-w-[150px] inline-block align-middle">{editingImageFile.name}</span>}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={() => {
                setIsEditingPost(false);
                setEditingImageFile(null);
                setIsRemovingCurrentImage(false);
              }} 
              disabled={isSavingPostEdit}>Cancel</Button>
              <Button onClick={handleSavePostEdit} disabled={isSavingPostEdit || !editingPostText.trim()}>
                {isSavingPostEdit ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save size={16} className="mr-1.5" />}
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="whitespace-pre-wrap mb-3">{post.questionText}</p>
            {post.imageUrl && (
              <div className="my-3 rounded-md overflow-hidden border border-border w-full max-w-md">
                <Image src={post.imageUrl} alt="Community post image" width={500} height={300} className="w-full h-auto object-contain" data-ai-hint="community question" />
              </div>
            )}
          </>
        )}
      </CardContent>
      {!isEditingPost && (
        <CardFooter className="flex flex-col items-start space-y-3">
            <div className="flex items-center space-x-4">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLikePost} 
                className={cn(
                "flex items-center text-muted-foreground hover:text-primary",
                hasUserLikedPost && "text-primary"
                )}
                disabled={!currentUser}
            >
                <ThumbsUp size={16} className={cn("mr-1.5", hasUserLikedPost && "fill-primary")} /> {post.likes || 0} Likes
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowComments(!showComments)} className="flex items-center text-muted-foreground hover:text-primary">
                <MessageCircle size={16} className="mr-1.5" /> {post.commentCount || 0} Comments
            </Button>
            </div>
            {showComments && (
            <div className="w-full pl-2 mt-3 border-l-2 border-border/50">
                {isLoadingComments ? <Loader2 className="h-5 w-5 animate-spin my-3" /> : 
                comments.length > 0 ? (
                    comments.map(comment => {
                    const hasUserLikedComment = currentUser && comment.likedBy && comment.likedBy[currentUser.uid];
                    const isEditingThisComment = editingCommentId === comment.id;
                    return (
                        <Card key={comment.id} className="my-3 bg-muted/30 shadow-sm">
                        <CardHeader className="pb-2 pt-3 px-4">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                                    {comment.username ? comment.username.charAt(0).toUpperCase() : <User size={14}/>}
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-sm font-semibold">{comment.username}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(comment.timestamp), { addSuffix: true })}
                                      {comment.updatedAt && comment.updatedAt !== comment.timestamp && (
                                         <span className="text-xs text-muted-foreground/70"> (edited)</span>
                                      )}
                                    </p>
                                </div>
                                </div>
                                {currentUser && currentUser.uid === comment.userId && !isEditingThisComment && (
                                <div className="flex items-center space-x-0.5">
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleEditComment(comment)}>
                                    <Edit3 size={12} />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                            <Trash2 size={12} />
                                        </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Comment?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                            Are you sure you want to delete this comment? This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteComment(comment.id, comment.userId)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pb-3 px-4">
                            {isEditingThisComment ? (
                            <div className="space-y-1.5">
                                <Textarea 
                                value={editingCommentText} 
                                onChange={(e) => setEditingCommentText(e.target.value)} 
                                rows={2}
                                className="text-sm"
                                disabled={isSavingCommentEdit}
                                />
                                <div className="flex justify-end space-x-1.5">
                                <Button variant="ghost" size="xs" onClick={() => setEditingCommentId(null)} disabled={isSavingCommentEdit}>Cancel</Button>
                                <Button size="xs" onClick={() => handleSaveCommentEdit(comment.id)} disabled={isSavingCommentEdit || !editingCommentText.trim()}>
                                    {isSavingCommentEdit ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save size={12} className="mr-1" />}
                                    Save
                                </Button>
                                </div>
                            </div>
                            ) : (
                            <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                            )}
                        </CardContent>
                        {!isEditingThisComment && (
                            <CardFooter className="pb-3 px-4">
                            <Button 
                                variant="ghost" 
                                size="xs" 
                                onClick={() => handleLikeComment(comment.id)} 
                                className={cn(
                                "flex items-center text-xs text-muted-foreground hover:text-primary",
                                hasUserLikedComment && "text-primary"
                                )}
                                disabled={!currentUser}
                            >
                                <ThumbsUp size={12} className={cn("mr-1", hasUserLikedComment && "fill-primary")} /> {comment.likes || 0} Likes
                            </Button>
                            </CardFooter>
                        )}
                        </Card>
                    )
                    })
                ) : <p className="text-sm text-muted-foreground my-3">No comments yet.</p>
                }
                <div className="mt-4 flex gap-2">
                <Textarea 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 text-sm"
                    rows={2}
                    disabled={isSubmittingComment}
                />
                <Button onClick={handleAddComment} disabled={isSubmittingComment || !newComment.trim()} size="sm">
                    {isSubmittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={16} />}
                </Button>
                </div>
            </div>
            )}
        </CardFooter>
      )}
    </Card>
  );
};


export default function CommunityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [newPostText, setNewPostText] = useState("");
  const [newPostImageFile, setNewPostImageFile] = useState<File | null>(null);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsLoadingPosts(true);
    const unsubscribe = getCommunityPosts((loadedPosts) => {
      setPosts(loadedPosts);
      setIsLoadingPosts(false);
    });
    return () => unsubscribe();
  }, []);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
       if (file.size > 4 * 1024 * 1024) { // ~4MB limit for ImgBB free tier
        toast({
          title: "Image too large",
          description: "Please upload an image smaller than 4MB for ImgBB.",
          variant: "destructive",
        });
        setNewPostImageFile(null);
        if (imageInputRef.current) imageInputRef.current.value = "";
        return;
      }
      setNewPostImageFile(file);
    }
  };

  const uploadToImgBB = async (file: File): Promise<string | null> => {
    // IMPORTANT SECURITY WARNING
    console.warn("PROTOTYPE ONLY: Using client-side ImgBB upload with API key. DO NOT use in production due to security risks of exposing the API key.");
    toast({
      title: "Image Upload (Prototype Warning)",
      description: "Uploading image using client-side ImgBB. This is for demonstration purposes only and is insecure. Do not use your real API key this way in a production app.",
      variant: "default",
      duration: 15000, 
    });

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success && result.data && result.data.url) {
        return result.data.url;
      } else {
        console.error("ImgBB upload failed:", result);
        toast({ title: "Image Upload Failed", description: result.error?.message || "Unknown error from ImgBB.", variant: "destructive" });
        return null;
      }
    } catch (error) {
      console.error("Error uploading to ImgBB:", error);
      toast({ title: "Image Upload Error", description: "Could not connect to image hosting service.", variant: "destructive" });
      return null;
    }
  };

  const handleCreatePost = async () => {
    if (!user || !user.displayName) {
      toast({ title: "Username Required", description: "Please set your display name in Settings to post.", variant: "destructive" });
      router.push('/settings');
      return;
    }
    if (!newPostText.trim()) {
      toast({ title: "Empty Post", description: "Cannot submit an empty post.", variant: "destructive" });
      return;
    }

    setIsSubmittingPost(true);
    let imageUrl: string | null = null;
    if (newPostImageFile) {
      imageUrl = await uploadToImgBB(newPostImageFile);
      if (!imageUrl) { // Upload failed, error toast shown by uploadToImgBB
        setIsSubmittingPost(false);
        return;
      }
    }

    try {
      await createCommunityPost(user.uid, user.displayName, newPostText, imageUrl);
      setNewPostText("");
      setNewPostImageFile(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      toast({ title: "Post Created", description: "Your question has been posted to the community." });
    } catch (error) {
      console.error("Error creating post:", error);
      toast({ title: "Error", description: "Could not create post.", variant: "destructive" });
    } finally {
      setIsSubmittingPost(false);
    }
  };

  if (authLoading) {
    return <div className="flex flex-1 items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <div className="flex flex-1 items-center justify-center p-4"><p>Please <Button variant="link" asChild><Link href="/login">log in</Link></Button> to view the community.</p></div>;
  }

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <div className="mb-6 flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground md:text-3xl font-headline">
          Community Q&A
        </h1>
      </div>

      <Card className="mb-8 shadow-lg">
        <CardHeader>
          <CardTitle>Ask the Community</CardTitle>
          <CardDescription>Post your questions and get help from fellow students and StudyBuddy AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea 
            value={newPostText} 
            onChange={(e) => setNewPostText(e.target.value)}
            placeholder="Type your question here..."
            rows={3}
            disabled={isSubmittingPost}
          />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={isSubmittingPost}>
                    <ImagePlus size={16} className="mr-2" /> Add Image
                </Button>
                <Input 
                    type="file" 
                    accept="image/*"
                    ref={imageInputRef} 
                    onChange={handleImageFileChange} 
                    className="hidden" 
                    disabled={isSubmittingPost}
                />
                {newPostImageFile && <span className="text-sm text-muted-foreground truncate max-w-[150px]">{newPostImageFile.name}</span>}
            </div>
            <Button onClick={handleCreatePost} disabled={isSubmittingPost || !newPostText.trim()}>
              {isSubmittingPost ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
              Post Question
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoadingPosts ? (
        <div className="flex justify-center mt-8"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-10">
          <MessageSquareText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground">No questions yet!</h3>
          <p className="text-muted-foreground">Be the first to ask a question in the community.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map(post => (
            <CommunityPostCard key={post.id} post={post} currentUser={user} uploadToImgBB={uploadToImgBB} />
          ))}
        </div>
      )}
    </div>
  );
}
