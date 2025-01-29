import OpenAI from "openai";
import { ChatCompletion, ChatCompletionCreateParams } from "openai/resources/index";
import { Stream } from "openai/streaming";

export const wrapOpenAI = ({
  apiKey,
  client,
  buildInterval,
  datasetId,
}: {
  apiKey?: string;
  client: OpenAI;
  buildInterval: number; // Seconds
  datasetId: string;
}) => {
  const orig = client.chat.completions.create;
  client.chat.completions.create = async (...args: [ChatCompletionCreateParams, any]) => {
    const handleResult = async (res: {
      id: string | number,
      model: string,
      usage?: {
        completion_tokens: number,
        prompt_tokens: number,
        total_tokens: number,
      };
      final: {
        message: string,
      };
    }) => {
      const dp = {
        id: res.id,
        model: res.model,
        tokens_completion: res.usage?.completion_tokens ?? 0,
        tokens_prompt: res.usage?.prompt_tokens ?? 0,
        tokens_total: res.usage?.total_tokens ?? 0,
        text: [
          ...args[0].messages.map(m => m.content),
          res.final.message,
        ].join("\n\n\n\n"),
      };
      // TODO Assert response status ACCEPTED and empty body?
      const ingestRes = await fetch(`https://staging-api-atlas.nomic.ai/v1/project/ingest/${datasetId}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datapoints: [dp],
          build_interval: buildInterval,
        }),
      });
    };
    const rv = await orig.apply(client.chat.completions, args);
    if (rv instanceof Stream) {
      const [a, b] = rv.tee();
      (async () => {
        const response = Array<string>();
        // TODO Initial `rv` may have no usage, and chunks may have partial or cumulative usage. Find out.
        for await (const chunk of a) {
          response.push(chunk.choices[0].delta.content ?? "");
        }
        await handleResult({
          ...rv,
          final: {
            message: response.join(""),
          },
        });
      })();
      return b;
    }
    const res: ChatCompletion = rv;
    handleResult({
      ...res,
      final: {
        message: res.choices[0].message.content ?? "",
      },
    });
    return res;
  };
  return client;
};
