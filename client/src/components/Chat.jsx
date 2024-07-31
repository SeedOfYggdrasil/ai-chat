import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import gfm from "remark-gfm";
import useAPI from "../hooks/useAPI";
import LoadingAnimation from "./LoadingAnimation";
import ModelSelectMenu from "./ModelSelectMenu";
import NewChatButton from "./NewChatButton";
import "./styles/Chat.css";

const Chat = () => {
  const {
    state,
    prompt,
    updatePrompt,
    submitPrompt,
    submitOnEnter,
    clearConversation,
    dispatch,
  } = useAPI();

  const models = ["llama3.1", "codellama", "gemma", "mistral"];
  const chatWindowRef = useRef(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [state.conversation, state.typing, state.loading]);

  return (
    <div className="chatContainer">
      <div className="headerContainer">
        <NewChatButton clearConversation={clearConversation} />
        <ModelSelectMenu
          models={models}
          selectedModel={state.model}
          onSelectModel={(e) =>
            dispatch({ type: "SET_MODEL", payload: e.target.value })
          }
        />
      </div>
      <div className="chatWindow" ref={chatWindowRef}>
        {state.conversation.map((entry, index) => (
          <div
            key={index}
            className={`chatMessage ${entry.type === "user" ? "userChat" : "botChat markdown"
              }`}
          >
            {entry.type === "user" ? (
              entry.text
            ) : (
              <ReactMarkdown remarkPlugins={[gfm]}>{entry.text}</ReactMarkdown>
            )}
          </div>
        ))}
        {state.loading && (
          <div className="chatMessage botChat">
            <div className="loadingWrapper">
              <LoadingAnimation />
            </div>
          </div>
        )}
        {state.typing && (
          <div className="chatMessage botChat markdown">
            <ReactMarkdown remarkPlugins={[gfm]}>{state.typing}</ReactMarkdown>
          </div>
        )}
      </div>
      <div className="inputContainer">
        <form onSubmit={submitPrompt}>
          <textarea
            rows={3}
            value={prompt}
            onChange={updatePrompt}
            onKeyDown={submitOnEnter}
            placeholder="Say something..."
          />
          <button className="submitButton" type="submit">
            SUBMIT
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
