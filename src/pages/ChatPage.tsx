import { ChatMessage } from "~/components/ChatMessage";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { useLayoutEffect, useRef, useState } from "react";
import ollama from "ollama";
import { ThoughtMessage } from "~/components/ThoughtMessage";
import { db } from "~/lib/dexie";
import { useParams } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";

// This would typically come from a state management solution or props
// const chatHistory: Message[] = [
//   { role: "assistant", content: "Hello! How can I assist you today?" },
//   { role: "user", content: "Can you explain what React is?" },
//   {
//     role: "assistant",
//     content:
//       "React is a popular JavaScript library for building user interfaces. It was developed by Facebook and is widely used for creating interactive, efficient, and reusable UI components. React uses a virtual DOM (Document Object Model) to improve performance by minimizing direct manipulation of the actual DOM. It also introduces JSX, a syntax extension that allows you to write HTML-like code within JavaScript.",
//   },
// ];
export default function ChatPage() {
  const [messsageInput, setMesssageInput] = useState("");
  const [streamedMessages, setStreamedMessages] = useState("");
  const [streamedThought, setStreamedThought] = useState("");
  const params = useParams();
  const scrollToBottom = useRef<HTMLDivElement>(null);

  const messages = useLiveQuery(
    () => db.getMessagesByThread(params.threadId as string),
    [params.threadId]
  );

  const handleSubmit = async () => {
    //create message user
    await db.createMessage({
      content: messsageInput,
      role: "user",
      thought: "",
      thread_id: params.threadId as string,
    });

    const stream = await ollama.chat({
      model: "deepseek-r1:1.5b",
      messages: [
        {
          role: "user",
          content: messsageInput.trim(),
        },
      ],
      stream: true,
    });
    setMesssageInput("");
    let fullContent = "";
    let fullThought = "";
    //2 output mode
    //1 mode mikir
    //2 mode jawab

    let outputMode: "think" | "response" = "think";

    for await (const part of stream) {
      const messageContent = part.message.content;
      if (outputMode === "think") {
        if (
          !(
            messageContent.includes("<think>") ||
            messageContent.includes("</think>")
          )
        ) {
          fullThought += messageContent;
        }

        setStreamedThought(fullThought);

        if (messageContent.includes("</think>")) {
          outputMode = "response";
        }
      } else {
        fullContent += messageContent;
        setStreamedMessages(fullContent);
      }
    }

    await db.createMessage({
      content: fullContent,
      role: "assistant",
      thought: fullThought,
      thread_id: params.threadId as string,
    });

    setStreamedMessages("");
    setStreamedThought("");
  };

  const handleScrollToBottom = () => {
    scrollToBottom.current?.scrollIntoView();
  };

  useLayoutEffect(() => {
    handleScrollToBottom();
  }, [streamedMessages, streamedThought, messages]);
  return (
    <>
      <div className="flex flex-col flex-1">
        <header className="flex items-center px-4 h-16 border-b">
          <h1 className="text-xl font-bold ml-4">AI Chat Dashboard</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 w-full">
          <div className="mx-auto space-y-4 pb-20 max-w-screen-md">
            {messages?.map((message, index) => (
              <ChatMessage
                key={index}
                role={message.role}
                content={message.content}
                thought={message.thought}
              />
            ))}
            {!!streamedThought && <ThoughtMessage thought={streamedThought} />}

            {!!streamedMessages && (
              <ChatMessage role="assistant" content={streamedMessages} />
            )}

            <div ref={scrollToBottom}></div>
          </div>
        </main>
        <footer className="border-t p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Textarea
              className="flex-1"
              placeholder="Type your message here..."
              rows={5}
              value={messsageInput}
              onChange={(e) => setMesssageInput(e.target.value)}
            />
            <Button onClick={handleSubmit} type="button">
              Send
            </Button>
          </div>
        </footer>
      </div>
    </>
  );
}
