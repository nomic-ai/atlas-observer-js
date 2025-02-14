import OpenAI from "openai";
import {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "openai/resources/index";
import { Stream } from "openai/streaming";
import {
  getNomicCredentials,
  OpenAIFlatDatapoint,
  uploadDatapoint,
} from "./utils.js";

export const wrapOpenAI = ({
  client,
  datasetId,
}: {
  client: OpenAI;
  datasetId: string;
}) => {
  const orig = client.chat.completions.create;
  const creds = getNomicCredentials();
  if (!creds) {
    throw new Error("Nomic credentials not found");
  }
  // @ts-expect-error TODO `create` signature is too complex.
  client.chat.completions.create = async (
    ...args: [ChatCompletionCreateParams, any]
  ) => {
    const handleResult = async (res: {
      id: string;
      model: string;
      created: number;
      usage: {
        completion_tokens: number;
        prompt_tokens: number;
        total_tokens: number;
      };
      final: {
        message: string;
        reason: string;
        refusal: string;
      };
    }) => {
      // TODO With more client wrappers, we'll move OpenAI-specific code to a separate file
      const messageContent = (
        m:
          | {
              content?: string | unknown;
            }
          | unknown[]
          | undefined
          | null
          | string
      ) => {
        if (!m || Array.isArray(m)) {
          return "";
        }
        if (typeof m === "string") {
          return m;
        }
        if (typeof m.content === "string") {
          return m.content;
        }
        return "";
      };
      const inputMessages: Array<{
        role: string;
        content: string;
      }> = args[0].messages.map((m) => ({
        content: messageContent(m.content),
        role: m.role,
      }));
      const flatData: OpenAIFlatDatapoint = {
        id: res.id,
        model: res.model,
        created: res.created,
        tokens_completion: res.usage.completion_tokens,
        tokens_prompt: res.usage.prompt_tokens,
        tokens_total: res.usage.total_tokens,
        finish_reason: res.final.reason,
        refusal: res.final.refusal,
        full_input_text: JSON.stringify(inputMessages),
        last_input_message: messageContent(args[0].messages.at(-1)),
        full_conversation: JSON.stringify([
          ...inputMessages,
          { role: "assistant", content: res.final.message },
        ]),
        model_response: res.final.message,
      };
      await uploadDatapoint({
        datasetId,
        creds,
        point: flatData,
      });
    };
    const rv = await orig.apply(client.chat.completions, args);
    if (rv instanceof Stream) {
      const [a, b] = rv.tee();
      (async () => {
        const response = Array<ChatCompletionChunk>();
        // TODO Initial `rv` may have no usage, and chunks may have partial or cumulative usage. Find out.
        for await (const chunk of a) {
          response.push(chunk);
        }
        const l = response.at(-1);
        await handleResult({
          created: l?.created ?? 0,
          id: l?.id ?? "",
          model: l?.model ?? "",
          usage: {
            completion_tokens: l?.usage?.completion_tokens ?? 0,
            prompt_tokens: l?.usage?.prompt_tokens ?? 0,
            total_tokens: l?.usage?.total_tokens ?? 0,
          },
          final: {
            message: response.map((c) => c.choices[0].delta.content).join(""),
            reason: l?.choices[0].finish_reason ?? "",
            refusal: l?.choices[0].delta.refusal ?? "",
          },
        });
      })();
      return b;
    }
    const res: ChatCompletion = rv;
    handleResult({
      created: res.created,
      id: res.id,
      model: res.model,
      usage: {
        completion_tokens: res.usage?.completion_tokens ?? 0,
        prompt_tokens: res.usage?.prompt_tokens ?? 0,
        total_tokens: res.usage?.total_tokens ?? 0,
      },
      final: {
        message: res.choices[0].message.content ?? "",
        reason: res.choices[0].finish_reason,
        refusal: res.choices[0].message.refusal ?? "",
      },
    });
    return res;
  };
  return client;
};
