const fallbackModelIdentifier = "@cf/meta/llama-3.1-8b-instruct";

// Function to stream LLM responses using the Universal Endpoint
export async function fetchStreamingLanguageModelResponse({
  organizationId,
  conversationHistory,
  credentialKeys,
  modelIdentifier,
  workerAI,
  languageModelProvider,
}: {
  conversationHistory: RoleScopedChatInput[];
  organizationId: string;
  workerAI?: Ai;
  modelIdentifier: string;
  languageModelProvider: string;
  credentialKeys: {
    openai?: string;
    anthropic?: string;
    groq?: string;
  };
}) {
  const enableStreaming = true;
  console.log({
    modelIdentifier,
    languageModelProvider,
    areCredentialsValid: validateCredentials(credentialKeys),
    credentialKeys,
  });

  if (!validateCredentials(credentialKeys) && workerAI) {
    console.log("No API keys provided, using Workers AI");

    return await workerAI.run(fallbackModelIdentifier, {
      messages: conversationHistory,
      stream: true,
    });
  }

  const gatewayIdentifier = "cloudflare-rag";
  let availableProviders = [
    {
      provider: "groq",
      endpoint: "chat/completions",
      headers: {
        Authorization: `Bearer ${credentialKeys.groq}`,
        "Content-Type": "application/json",
      },
      query: {
        stream: enableStreaming,
        model: "llama-3.1-8b-instant",
        messages: conversationHistory,
      },
    },
    {
      provider: "openai",
      endpoint: "chat/completions",
      headers: {
        authorization: `Bearer ${credentialKeys.openai}`,
        "Content-Type": "application/json",
      },
      query: {
        model: "gpt-4o-mini",
        stream: enableStreaming,
        messages: conversationHistory,
      },
    },
    {
      provider: "openai",
      endpoint: "chat/completions",
      headers: {
        authorization: `Bearer ${credentialKeys.openai}`,
        "Content-Type": "application/json",
      },
      query: {
        model: "gpt-4o",
        stream: enableStreaming,
        messages: conversationHistory,
      },
    },
    {
      provider: "anthropic",
      endpoint: "v1/messages",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": credentialKeys.anthropic,
        "Content-Type": "application/json",
      },
      query: {
        model: "claude-3-haiku-20240307",
        stream: enableStreaming,
        max_tokens: 1024,
        messages: conversationHistory,
      },
    },
    {
      provider: "anthropic",
      endpoint: "v1/messages",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": credentialKeys.anthropic,
        "Content-Type": "application/json",
      },
      query: {
        model: "claude-3-5-sonnet-20240620",
        stream: enableStreaming,
        max_tokens: 1024,
        messages: conversationHistory,
      },
    },
    {
      provider: "groq",
      endpoint: "chat/completions",
      headers: {
        Authorization: `Bearer ${credentialKeys.groq}`,
        "Content-Type": "application/json",
      },
      query: {
        stream: enableStreaming,
        model: "llama-3.3-70b-versatile",
        messages: conversationHistory,
      },
    },
  ];

  console.log("conversationHistory", conversationHistory);
  let chosenProvider: AIGatewayUniversalRequest | undefined;
  if (languageModelProvider && modelIdentifier) {
    chosenProvider = availableProviders.find(
      (providerConfig) => providerConfig.provider === languageModelProvider
    );
    if (chosenProvider) {
      (chosenProvider.query as { model: string }).model = modelIdentifier;
    }
  }

  if (chosenProvider) {
    return workerAI?.gateway(gatewayIdentifier).run(chosenProvider);
  }
}

function validateCredentials(
  credentialKeys: Record<string, string | undefined>
): boolean {
  return Object.values(credentialKeys).some((key) => key !== undefined);
}

// New function to return a parsed text response
export async function fetchCompleteLanguageModelResponse({
  organizationId,
  conversationHistory,
  credentialKeys,
  modelIdentifier,
  workerAI,
  languageModelProvider,
}: {
  conversationHistory: RoleScopedChatInput[];
  organizationId: string;
  workerAI?: Ai;
  modelIdentifier: string;
  languageModelProvider: string;
  credentialKeys: {
    openai?: string;
    anthropic?: string;
    groq?: string;
  };
}): Promise<string> {
  console.log({
    modelIdentifier,
    languageModelProvider,
    areCredentialsValid: validateCredentials(credentialKeys),
    credentialKeys,
  });

  if (!validateCredentials(credentialKeys) && workerAI) {
    console.log("No API keys provided, using Workers AI");
    const aiResponse = await workerAI.run(fallbackModelIdentifier, {
      messages: conversationHistory,
    });
    return (aiResponse as { response: string }).response;
  }

  const gatewayIdentifier = "cloudflare-rag";
  const availableProviders = [
    {
      provider: "groq",
      endpoint: "chat/completions",
      headers: {
        Authorization: `Bearer ${credentialKeys.groq}`,
        "Content-Type": "application/json",
      },
      query: {
        model: "llama-3.1-8b-instant",
        messages: conversationHistory,
      },
    },
    {
      provider: "openai",
      endpoint: "chat/completions",
      headers: {
        authorization: `Bearer ${credentialKeys.openai}`,
        "Content-Type": "application/json",
      },
      query: {
        model: "gpt-4o-mini",
        messages: conversationHistory,
      },
    },
    {
      provider: "anthropic",
      endpoint: "v1/messages",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": credentialKeys.anthropic,
        "Content-Type": "application/json",
      },
      query: {
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: conversationHistory,
      },
    },
  ];

  let chosenProvider: AIGatewayUniversalRequest | undefined;
  if (languageModelProvider && modelIdentifier) {
    chosenProvider = availableProviders.find(
      (providerConfig) => providerConfig.provider === languageModelProvider
    );
    if (chosenProvider) {
      (chosenProvider.query as { model: string }).model = modelIdentifier;
    }
  }

  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${organizationId}/${gatewayIdentifier}/`;
  console.log("conversationHistory", conversationHistory);
  const apiResponse = await fetch(gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([chosenProvider]),
  });
  console.log({ apiResponse });
  if (!apiResponse.ok) {
    throw new Error(`HTTP error! status: ${apiResponse.status}`);
  }

  const responseData: any = await apiResponse.json();

  // Handle different response formats based on the provider
  let textContent = "";
  if (responseData.content && responseData.content.text) {
    // Anthropic format
    textContent = responseData.content.text;
  } else if (
    responseData.choices &&
    responseData.choices[0] &&
    responseData.choices[0].message
  ) {
    // OpenAI and Groq format
    textContent = responseData.choices[0].message.content;
  } else {
    console.error("Unexpected response format:", responseData);
    throw new Error("Unexpected response format from AI provider");
  }

  return textContent;
}
