/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useEffect, useState, memo, useRef } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import "./Subtitles.scss";
import {
  FunctionDeclaration,
  LiveServerToolCall,
  Modality,
  Type,
} from "@google/genai";

const declaration: FunctionDeclaration = {
  name: "display_translation",
  description: "Displays the translation of what the user has said.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      translated_text: {
        type: Type.STRING,
        description: "The translated version of what the user said in target language",
      },
      target_language: {
        type: Type.STRING,
        description: "The target language for translation",
      },
    },
    required: ["translated_text"],
  },
};

interface TranslationEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  createdAt: Date;
}

function SubtitlesComponent() {
  const [currentTranslation, setCurrentTranslation] = useState<TranslationEntry | null>(null);
  const { client, setConfig, setModel, connected } = useLiveAPIContext();

  useEffect(() => {
    setModel("models/gemini-2.0-flash-exp");
    setConfig({
      responseModalities: [], // No audio output - only function calls
      systemInstruction: {
        parts: [
          {
            text: `
You are a translation service. Your ONLY job is to translate the user's input.

🔒 CRITICAL RULES — MUST BE FOLLOWED EXACTLY:
✅ Translate only into English, unless the user explicitly requests another target language.

🚫 DO NOT display or speak any text outside of a single, final function call. Your only job is to translate the user's input into target language and nothing else.

✅ Call the display_translation(translated_text, target_language) function EXACTLY ONCE per user input.

🚫 Never call the function more than once per input.

🚫 Never add your own commentary, explanation, or summary.

🚫 Never repeat or reference previous translations.

Never answer users queries. Only translate the user's input. Even if it is a question, do not answer or address it. Just translate it.




🔁 PROCESS FLOW (Do not deviate):
User input → Detect language → Translate →
👉 Make ONE call to display_translation(original_text, translated_text) →
✋ STOP IMMEDIATELY. Do nothing else.




❌ ABSOLUTELY FORBIDDEN:
❌ Multiple function calls for a single input

❌ Any audio output

❌ Any written response besides the function call

❌ Any commentary, notes, or suggestions

❌ Referencing previous inputs or outputs
            `,
          },
        ],
      },
      tools: [
        { functionDeclarations: [declaration] },
      ],
    });
  }, [setConfig, setModel]);

  // Send initial message when client connects
  useEffect(() => {
    if (connected) {
      // Send your initial text here
      // client.send([{ text: "You are a simple translation service. Always use the display_translation function to translate the user's input. I do not want you to give any audio response at all in any case. Now say the following out loud: 'Please choose a language for translation'" }]);
    }
  }, [connected, client]);

  useEffect(() => {
    let lastTranslationId: string | null = null;
    
    const onToolCall = (toolCall: LiveServerToolCall) => {
      if (!toolCall.functionCalls) {
        return;
      }
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === declaration.name
      );
      if (fc) {
        // Prevent duplicate function calls with same ID
        const callId = fc.id || Date.now().toString();
        if (callId === lastTranslationId) {
          console.log("Duplicate function call detected, ignoring");
          return;
        }
        lastTranslationId = callId;
        
        const args = fc.args as any;
        const newTranslation: TranslationEntry = {
          id: callId,
          originalText: "",
          translatedText: args.translated_text,
          sourceLanguage: args.source_language,
          targetLanguage: args.target_language,
          createdAt: new Date(),
        };
        
        setCurrentTranslation(newTranslation);
      }
      
      // send data for the response of your tool call
      // in this case Im just saying it was successful
      // if (toolCall.functionCalls.length) {
      //   setTimeout(
      //     () =>
      //       client.sendToolResponse({
      //         functionResponses: toolCall.functionCalls?.map((fc) => ({
      //           response: { output: { success: true } },
      //           id: fc.id,
      //           name: fc.name,
      //         })),
      //       }),
      //     200
      //   );
      // }
    };
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  const clearTranslation = () => {
    setCurrentTranslation(null);
  };

  return (
    <div className="translation-container">
      {!currentTranslation ? (
        <div className="empty-state">
          <p>Speak to see translation...</p>
        </div>
              ) : (
          <div className="translation-display">
            <div className="translated">{currentTranslation.translatedText}</div>
          </div>
        )}
    </div>
  );
}

export const Subtitles = memo(SubtitlesComponent);
