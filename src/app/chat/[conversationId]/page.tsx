"use client";

import { ChatInterface } from "@/components/ChatInterface";
import { useParams } from "next/navigation";

// Add generateStaticParams function for static export
export async function generateStaticParams() {
  // Return empty array for static export - pages will be generated on demand
  return [];
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  return <ChatInterface initialConversationId={conversationId} />;
}
