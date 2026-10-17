import { extractCharacterName, extractInjectedLore, InjectedLoreEntry } from './memory';

export interface CharacterCardV2Data {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  creator_notes: string;
  system_prompt: string;
  post_history_instructions: string;
  alternate_greetings: string[];
  character_book?: any;
  tags: string[];
  creator: string;
  character_version: string;
  extensions: Record<string, any>;
}

export interface CharacterCardV2Spec {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: CharacterCardV2Data;
}

function extractSectionByRegex(text: string, patterns: RegExp[]): string {
  if (!text) return '';
  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1] && match[1].trim()) {
      return match[1].trim();
    }
  }
  return '';
}

function getMessageText(m: any): string {
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  if (Array.isArray(m.content)) {
    return m.content.map((p: any) => (typeof p === 'string' ? p : p?.text || '')).join('\n');
  }
  return '';
}

export function exportCharacterCard(
  messages: any[] = [],
  rawSystemText: string = '',
  headers?: { get: (name: string) => string | null } | Headers
): string {
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];

  // 1. Resolve Character Name
  const customHeaderName =
    headers && typeof (headers as any).get === 'function'
      ? (headers as any).get('x-character-name') || (headers as any).get('character-name')
      : null;

  let characterName = (customHeaderName || '').trim();
  if (!characterName) {
    characterName = extractCharacterName(rawSystemText, safeMessages);
  }
  if (!characterName || characterName.toLowerCase() === 'character' || characterName.toLowerCase() === 'assistant') {
    // Attempt fallback from earliest assistant message greeting
    const firstAssistantMsg = safeMessages.find(m => m.role === 'assistant');
    if (firstAssistantMsg) {
      const text = getMessageText(firstAssistantMsg).trim();
      const match = text.match(/^([A-Z][a-zA-Z0-9_\-]{1,25})\s*:/);
      if (match && match[1]) {
        characterName = match[1];
      }
    }
  }
  if (!characterName) {
    characterName = 'Character';
  }

  // 2. Extract First Message / Greeting
  let firstMes = '';
  const firstAssistant = safeMessages.find(m => m.role === 'assistant');
  if (firstAssistant) {
    firstMes = getMessageText(firstAssistant).trim();
  }

  // 3. Extract Specific Character Definition Sections
  const personalityPatterns = [
    /<personality>([\s\S]*?)<\/personality>/i,
    /<char_persona[^>]*>([\s\S]*?)<\/char_persona>/i,
    /(?:^|\n)\s*(?:###\s*)?(?:Personality|Persona|Traits|Psychological Profile)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:###\s*)?(?:Scenario|Appearance|Description|Setting|World|System Instructions?|First Message|Examples?|Rules?):|\n\s*###|$))/i,
    /\[(?:Personality|Traits)\s*:\s*([^\]]+)\]/i,
    /Personality\("([^"]+)"\)/i,
  ];

  const scenarioPatterns = [
    /<scenario>([\s\S]*?)<\/scenario>/i,
    /<world>([\s\S]*?)<\/world>/i,
    /(?:^|\n)\s*(?:###\s*)?(?:Scenario|Setting|World Info|World Setting|Context)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:###\s*)?(?:Personality|Appearance|Description|First Message|Examples?|Rules?|System Instructions?):|\n\s*###|$))/i,
    /\[(?:Scenario|Setting)\s*:\s*([^\]]+)\]/i,
    /Scenario\("([^"]+)"\)/i,
  ];

  const descriptionPatterns = [
    /<description>([\s\S]*?)<\/description>/i,
    /<appearance>([\s\S]*?)<\/appearance>/i,
    /(?:^|\n)\s*(?:###\s*)?(?:Description|Appearance|Physical Appearance|Background|Backstory|Overview)\s*:\s*([\s\S]*?)(?=(?:\n\s*(?:###\s*)?(?:Scenario|Personality|Setting|World|Rules?|System Instructions?):|\n\s*###|$))/i,
    /\[(?:Description|Appearance)\s*:\s*([^\]]+)\]/i,
    /Description\("([^"]+)"\)/i,
  ];

  const examplePatterns = [
    /<mes_example>([\s\S]*?)<\/mes_example>/i,
    /<example_dialogue>([\s\S]*?)<\/example_dialogue>/i,
    /<dialogue>([\s\S]*?)<\/dialogue>/i,
    /(?:^|\n)\s*(?:<START>|### Example Dialogues?)([\s\S]*?)(?:###|<END>|$)/i,
    /(?:^|\n)\s*Example Dialogue\s*:\s*([\s\S]*?)(?=(?:\n\s*###|$))/i,
  ];

  const extractedPersonality = extractSectionByRegex(rawSystemText, personalityPatterns);
  const extractedScenario = extractSectionByRegex(rawSystemText, scenarioPatterns);
  const extractedDescription = extractSectionByRegex(rawSystemText, descriptionPatterns);
  const extractedExamples = extractSectionByRegex(rawSystemText, examplePatterns);

  // If description wasn't specifically subdivided, default to rawSystemText
  const finalDescription = (extractedDescription || rawSystemText || '').trim();

  // 4. Extract Multi-System Messages (Separate Jailbreak / User Directives)
  const systemMessages = safeMessages.filter(m => m.role === 'system');
  let separateSystemInstructions = '';
  if (systemMessages.length > 1) {
    const extraBlocks: string[] = [];
    for (let i = 1; i < systemMessages.length; i++) {
      const blockText = getMessageText(systemMessages[i]).trim();
      if (blockText) {
        extraBlocks.push(`[System Block ${i + 1}]:\n${blockText}`);
      }
    }
    separateSystemInstructions = extraBlocks.join('\n\n');
  }

  // 5. Extract Injected Lore / World Info
  const injectedLore = extractInjectedLore(safeMessages, rawSystemText);

  // 6. Build SillyTavern V2 Character Card Spec Object
  let characterBook: any = undefined;
  if (injectedLore.length > 0) {
    characterBook = {
      name: `${characterName} Lorebook`,
      description: `Auto-extracted lorebook entries for ${characterName}`,
      scan_depth: 100,
      token_budget: 2048,
      recursive_scanning: false,
      entries: injectedLore.map((entry, idx) => ({
        id: idx + 1,
        keys: [entry.title.toLowerCase().trim()],
        secondary_keys: [],
        comment: entry.title,
        content: entry.content,
        constant: false,
        selective: false,
        insertion_order: idx + 1,
        enabled: true,
        position: 'before_char',
        case_sensitive: false,
        name: entry.title,
        priority: 10,
      })),
    };
  }

  const cardV2Spec: CharacterCardV2Spec = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: characterName,
      description: finalDescription,
      personality: extractedPersonality,
      scenario: extractedScenario,
      first_mes: firstMes,
      mes_example: extractedExamples,
      creator_notes: 'Exported via Google Antigravity Card Exporter Gateway (prototype-1-nextjs)',
      system_prompt: separateSystemInstructions || '',
      post_history_instructions: '',
      alternate_greetings: [],
      ...(characterBook ? { character_book: characterBook } : {}),
      tags: ['Antigravity Proxy', 'Exported Card', 'Roleplay'],
      creator: 'Antigravity Proxy Gateway',
      character_version: '2.0',
      extensions: {},
    },
  };

  const jsonOutput = JSON.stringify(cardV2Spec, null, 2);

  // 7. Calculate Telemetry & Stats
  const systemChars = rawSystemText.length;
  const greetingChars = firstMes.length;
  const totalDefChars = systemChars + greetingChars;
  const estDefTokens = Math.max(1, Math.floor(totalDefChars / 4));
  const estGreetingTokens = Math.max(0, Math.floor(greetingChars / 4));

  const userTurns = safeMessages.filter(m => m.role === 'user').length;
  const assistantTurns = safeMessages.filter(m => m.role === 'assistant').length;
  const systemTurns = safeMessages.filter(m => m.role === 'system').length;
  const totalTurns = safeMessages.length;

  const timestampIso = new Date().toISOString();

  // 8. Assemble Clean Markdown Output
  const sections: string[] = [];

  sections.push(`# 📋 Character Card Export: ${characterName}`);
  sections.push(`> ⚡ **Model**: \`card-exporter\` *(Virtual Edge Utility • 0 Upstream Quota Consumed)*
> 🏷️ **Character Name**: **${characterName}**
> 📊 **Definition Size**: ${totalDefChars.toLocaleString()} chars (~${estDefTokens.toLocaleString()} tokens)
> 💬 **Initial Greeting**: ${greetingChars.toLocaleString()} chars (~${estGreetingTokens.toLocaleString()} tokens)
> 🔄 **Chat History**: ${totalTurns} turns (${userTurns} User • ${assistantTurns} Assistant • ${systemTurns} System)
> 📚 **Injected Lore Entries**: ${injectedLore.length} active entries
> ⏱️ **Exported At**: \`${timestampIso}\``);

  sections.push('---');

  sections.push(`### 👤 Character Persona & Description\n${finalDescription ? finalDescription : '*(No character description provided)*'}`);

  if (extractedPersonality) {
    sections.push(`### 🧠 Personality & Traits\n${extractedPersonality}`);
  }

  if (extractedScenario) {
    sections.push(`### 🎭 Scenario & World Setting\n${extractedScenario}`);
  }

  sections.push(`### 💬 Initial Greeting (First Message)\n${firstMes ? firstMes : '*(No assistant greeting found in history)*'}`);

  if (extractedExamples) {
    sections.push(`### 💬 Example Dialogue\n${extractedExamples}`);
  }

  if (injectedLore.length > 0) {
    const loreLines = injectedLore.map((l, i) => `**${i + 1}. ${l.title}** (${l.category.toUpperCase()} • ~${l.tokens} tokens):\n\`\`\`\n${l.content}\n\`\`\``);
    sections.push(`### 📚 Injected Lore & World Info (${injectedLore.length})\n${loreLines.join('\n\n')}`);
  }

  if (separateSystemInstructions) {
    sections.push(`### ⚙️ Additional System Instructions & Jailbreaks\n${separateSystemInstructions}`);
  }

  sections.push('---');
  sections.push(`### 💾 SillyTavern V2 Character Card (Importable JSON)
*Copy the JSON code block below to import this character directly into SillyTavern, Janitor AI, Chub.ai, or Backyard AI:*

\`\`\`json
${jsonOutput}
\`\`\``);

  return sections.join('\n\n');
}
