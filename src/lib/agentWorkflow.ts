import callOpenAI from '@/lib/aiProvider';

export type AgentWorkflowConfig = {
  redacteur: {
    systemPrompt: string;
    userPrompt: string;
    responseFormat?: 'text' | 'json_object';
    agentId?: string;
  };
  transformateur: {
    systemPrompt: string;
    userPromptTemplate?: (raw: string) => string;
    responseFormat?: 'text' | 'json_object';
    agentId?: string;
  };
  callConfig?: any;
};

/**
 * Orchestrates a two-agent workflow: first generates content, then formats it.
 * @returns The formatted result from the transformateur agent.
 */
export async function agentWorkflow<T = any>(config: AgentWorkflowConfig): Promise<T> {
  console.log('[agentWorkflow] Starting workflow with config:', config);
  // 1. Rédacteur
  console.log('[agentWorkflow] Calling redacteur agent with systemPrompt:', config.redacteur.systemPrompt);
  console.log('[agentWorkflow] Redacteur userPrompt:', config.redacteur.userPrompt);
  const redacteurResponse = await callOpenAI(
    [config.redacteur.systemPrompt],
    [config.redacteur.userPrompt],
    {
      ...(config.callConfig || {}),
      responseFormat: { type: config.redacteur.responseFormat || 'text' },
      agentId: config.redacteur.agentId || process.env.MISTRAL_AGENT_ID_REDACTEUR
    }
  ) as string;
  console.log('[agentWorkflow] Redacteur response:', redacteurResponse);

  // 2. Transformateur
  const transformateurUserPrompt = config.transformateur.userPromptTemplate
    ? config.transformateur.userPromptTemplate(redacteurResponse)
    : `Réponse à transformer :\n${redacteurResponse}`;
  console.log('[agentWorkflow] Calling transformateur agent with systemPrompt:', config.transformateur.systemPrompt);
  console.log('[agentWorkflow] Transformateur userPrompt:', transformateurUserPrompt);

  const formatted = await callOpenAI(
    [config.transformateur.systemPrompt],
    [transformateurUserPrompt],
    {
      ...(config.callConfig || {}),
      responseFormat: { type: config.transformateur.responseFormat || 'json_object' },
      agentId: config.transformateur.agentId || process.env.MISTRAL_AGENT_ID_TRANSFORMATEUR
    }
  );
  console.log('[agentWorkflow] Transformateur response:', formatted);

  return formatted as T;
} 