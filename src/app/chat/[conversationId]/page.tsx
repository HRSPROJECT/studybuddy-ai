"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { useParams } from "next/navigation";

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  return <ChatInterface initialConversationId={conversationId} />;
}
