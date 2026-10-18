import { extractCharacterName, extractUserInfo, extractInjectedLore, InjectedLoreEntry } from './memory';

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
  headers?: { get: (name: string) => string | null } | Headers | Record<string, any>
): string {
  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];

  // 1. Resolve Header Helper (supports Web API Headers, mock objects with .get, and plain Record objects)
  const getHeader = (key: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as any).get === 'function') {
      return (headers as any).get(key) || (headers as any).get(key.toLowerCase());
    }
    if (typeof headers === 'object') {
      const lowerKey = key.toLowerCase();
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lowerKey && typeof v === 'string') return v;
      }
    }
    return null;
  };

  // 1. Resolve User Information (Name & Persona)
  const extractedUserInfo = extractUserInfo(rawSystemText, safeMessages, headers);
  let userName = extractedUserInfo.userName;
  let userPersona = extractedUserInfo.userPersona;

  // Header overrides
  const customUserName =
    getHeader('x-user-name') ||
    getHeader('user-name') ||
    getHeader('x-user') ||
    getHeader('user');
  if (customUserName && customUserName.trim()) {
    userName = customUserName.trim();
  }

  // 2. Resolve Character Name
  const customHeaderName =
    getHeader('x-character-name') ||
    getHeader('character-name') ||
    getHeader('x-char-name') ||
    getHeader('char-name') ||
    getHeader('x-bot-name') ||
    getHeader('bot-name');

  let characterName = (customHeaderName || '').trim();

  // Explicit XML tag check in system prompt
  if (!characterName) {
    const explicitNameMatch = rawSystemText.match(/<(?:char_name|character_name|char|bot_name)\s*>([^<]+)<\/(?:char_name|character_name|char|bot_name)>/i);
    if (explicitNameMatch && explicitNameMatch[1] && explicitNameMatch[1].trim()) {
      const candidate = explicitNameMatch[1].trim();
      if (!userName || candidate.toLowerCase() !== userName.toLowerCase()) {
        characterName = candidate;
      }
    }
  }

  if (!characterName) {
    characterName = extractCharacterName(rawSystemText, safeMessages);
  }

  // Guard against characterName being mistakenly set to userName or generic labels
  if (userName && characterName.toLowerCase() === userName.toLowerCase()) {
    characterName = 'Character';
  }

  if (!characterName || characterName.toLowerCase() === 'character' || characterName.toLowerCase() === 'assistant') {
    // Attempt fallback from earliest assistant message greeting
    const firstAssistantMsg = safeMessages.find(m => m.role === 'assistant');
    if (firstAssistantMsg) {
      const text = getMessageText(firstAssistantMsg).trim();
      const prefixMatch = text.match(/^([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)\s*:/);
      if (prefixMatch && prefixMatch[1]) {
        const cand = prefixMatch[1].trim();
        if (!userName || cand.toLowerCase() !== userName.toLowerCase()) {
          characterName = cand;
        }
      } else {
        const actionMatch = text.match(/^\*([A-Z][a-zA-Z0-9_\-&]{1,25}(?:\s+(?:&|and)\s+[A-Z][a-zA-Z0-9_\-]{1,25})*)\b/);
        if (actionMatch && actionMatch[1]) {
          const cand = actionMatch[1].trim();
          if (!userName || cand.toLowerCase() !== userName.toLowerCase()) {
            characterName = cand;
          }
        }
      }
    }
  }
  if (!characterName || (userName && characterName.toLowerCase() === userName.toLowerCase())) {
    characterName = 'Character';
  }

  // 2. Extract First Message / Greeting (Prompt declarations take precedence; fallback to earliest assistant message)
  const firstMesPatterns = [
    /<first_mes>([\s\S]*?)<\/first_mes>/i,
    /<first_message>([\s\S]*?)<\/first_message>/i,
    /<greeting>([\s\S]*?)<\/greeting>/i,
    /<starter>([\s\S]*?)<\/starter>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?(?:First Message|Initial Greeting|Greeting|Starter Message|Starter)(?::\s*|\s*\n)\s*([\s\S]*?)(?=(?:\n\s*#{1,4}|\n\s*(?:Personality|Scenario|Appearance|Description|Examples?|Dialogue|World):?|$))/i,
    /\[(?:First Message|Greeting|Starter)\s*:\s*([^\]]+)\]/i,
    /(?:FirstMessage|Greeting)\("([^"]+)"\)/i,
  ];

  let firstMes = extractSectionByRegex(rawSystemText, firstMesPatterns);
  if (!firstMes) {
    const firstAssistant = safeMessages.find(m => m.role === 'assistant');
    if (firstAssistant) {
      firstMes = getMessageText(firstAssistant).trim();
    }
  }

  // 3. Extract Specific Character Definition Sections (supporting optional colons on markdown headers)
  const personalityPatterns = [
    /<personality>([\s\S]*?)<\/personality>/i,
    /<traits>([\s\S]*?)<\/traits>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?(?:Personality|Persona Traits|Traits|Psychological Profile)(?::\s*|\s*\n)\s*([\s\S]*?)(?=(?:\n\s*(?:#{1,4}\s*)?(?:Scenario|Appearance|Description|Setting|World|System Instructions?|First Message|Greeting|Examples?|Rules?):?|\n\s*#{1,4}|$))/i,
    /\[(?:Personality|Traits)\s*:\s*([^\]]+)\]/i,
    /Personality\("([^"]+)"\)/i,
  ];

  const scenarioPatterns = [
    /<scenario>([\s\S]*?)<\/scenario>/i,
    /<world>([\s\S]*?)<\/world>/i,
    /<setting>([\s\S]*?)<\/setting>/i,
    /<context>([\s\S]*?)<\/context>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?(?:Scenario|Setting|World Info|World Setting|Context)(?::\s*|\s*\n)\s*([\s\S]*?)(?=(?:\n\s*(?:#{1,4}\s*)?(?:Personality|Appearance|Description|First Message|Greeting|Examples?|Rules?|System Instructions?):?|\n\s*#{1,4}|$))/i,
    /\[(?:Scenario|Setting)\s*:\s*([^\]]+)\]/i,
    /Scenario\("([^"]+)"\)/i,
  ];

  const descriptionPatterns = [
    /<description>([\s\S]*?)<\/description>/i,
    /<char_description>([\s\S]*?)<\/char_description>/i,
    /<bot_description>([\s\S]*?)<\/bot_description>/i,
    /<character_description>([\s\S]*?)<\/character_description>/i,
    /<char_persona[^>]*>([\s\S]*?)<\/char_persona>/i,
    /<persona>([\s\S]*?)<\/persona>/i,
    /<appearance>([\s\S]*?)<\/appearance>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?(?:Character Persona|Character Description|Description|Appearance|Physical Appearance|Background|Backstory|Overview)(?::\s*|\s*\n)\s*([\s\S]*?)(?=(?:\n\s*(?:#{1,4}\s*)?(?:Scenario|Personality|Setting|World|Rules?|System Instructions?|First Message|Greeting|Examples?|User(?:'s)?\s*Persona):?|\n\s*#{1,4}|$))/i,
    /\[(?:Character Persona|Character Description|Description|Appearance)\s*:\s*([^\]]+)\]/i,
    /(?:Description|Appearance)\("([^"]+)"\)/i,
  ];

  const examplePatterns = [
    /<mes_example>([\s\S]*?)<\/mes_example>/i,
    /<example_dialogue>([\s\S]*?)<\/example_dialogue>/i,
    /<dialogue_examples>([\s\S]*?)<\/dialogue_examples>/i,
    /<examples>([\s\S]*?)<\/examples>/i,
    /<dialogue>([\s\S]*?)<\/dialogue>/i,
    /(?:^|\n)\s*(?:<START>|#{1,4}\s*Example Dialogues?)([\s\S]*?)(?:#{1,4}|<END>|$)/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?Example Dialogue(?::\s*|\s*\n)\s*([\s\S]*?)(?=(?:\n\s*#{1,4}|$))/i,
  ];

  const systemPromptPatterns = [
    /<system_prompt>([\s\S]*?)<\/system_prompt>/i,
    /<system_instructions>([\s\S]*?)<\/system_instructions>/i,
    /<jailbreak>([\s\S]*?)<\/jailbreak>/i,
    /<custom_instructions>([\s\S]*?)<\/custom_instructions>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?(?:System Instructions?|Jailbreak|Custom Instructions?)(?::\s*|\s*\n)\s*([\s\S]*?)(?=(?:\n\s*#{1,4}|$))/i,
  ];

  const extractedPersonality = extractSectionByRegex(rawSystemText, personalityPatterns);
  const extractedScenario = extractSectionByRegex(rawSystemText, scenarioPatterns);
  const extractedDescription = extractSectionByRegex(rawSystemText, descriptionPatterns);
  const extractedExamples = extractSectionByRegex(rawSystemText, examplePatterns);
  const extractedSystemPrompt = extractSectionByRegex(rawSystemText, systemPromptPatterns);

  // If description wasn't specifically subdivided, clean out already-extracted tags if present
  let finalDescription = extractedDescription;
  if (!finalDescription) {
    const strippedFallback = rawSystemText
      .replace(/<(?:char_name|character_name|char|bot_name|name)\s*>[\s\S]*?<\/(?:char_name|character_name|char|bot_name|name)>/gi, '')
      .replace(/<(?:personality|traits)>[\s\S]*?<\/(?:personality|traits)>/gi, '')
      .replace(/<(?:scenario|setting|world)>[\s\S]*?<\/(?:scenario|setting|world)>/gi, '')
      .replace(/<(?:first_mes|first_message|greeting|starter)>[\s\S]*?<\/(?:first_mes|first_message|greeting|starter)>/gi, '')
      .replace(/<(?:mes_example|example_dialogue|dialogue)>[\s\S]*?<\/(?:mes_example|example_dialogue|dialogue)>/gi, '')
      .replace(/<(?:system_prompt|jailbreak|system_instructions|custom_instructions)>[\s\S]*?<\/(?:system_prompt|jailbreak|system_instructions|custom_instructions)>/gi, '')
      .replace(/<(?:user_persona|user_profile|user_description|user_name|user)>[\s\S]*?<\/(?:user_persona|user_profile|user_description|user_name|user)>/gi, '')
      .replace(/\[(?:User's Persona|User Persona|User Description|User Profile|User Definition|User Info|User)\s*:\s*[\s\S]*?\]/gi, '')
      .trim();
    finalDescription = (strippedFallback || rawSystemText || '').trim();
  }

  // 4. Extract Multi-System Messages (Preserving distinct jailbreaks & system prompt instructions)
  const systemMessages = safeMessages.filter(m => m.role === 'system');
  const systemInstructionBlocks: string[] = [];
  if (systemMessages.length > 1) {
    for (let i = 0; i < systemMessages.length; i++) {
      const blockText = getMessageText(systemMessages[i]).trim();
      if (!blockText) continue;
      // Identify non-character system instructions / jailbreaks
      const isCharDef = /<(?:char|character|char_name|char_persona|personality|scenario|description)\b/i.test(blockText) ||
                        /(?:###\s*(?:Character|Persona|Personality|Description|Scenario))/i.test(blockText) ||
                        /\[(?:Character|Personality|Appearance|Scenario)\b/i.test(blockText);
      const isInstruction = /<(?:system_prompt|jailbreak|system_instructions)>/i.test(blockText) ||
                            /(?:###\s*(?:System Instructions?|Jailbreak))/i.test(blockText) ||
                            !isCharDef;
      if (isInstruction) {
        systemInstructionBlocks.push(`[System Block ${i + 1}]:\n${blockText}`);
      }
    }
  } else if (extractedSystemPrompt) {
    systemInstructionBlocks.push(extractedSystemPrompt);
  }
  const separateSystemInstructions = systemInstructionBlocks.join('\n\n');

  // 5. Extract Injected Lore / World Info (strictly excluding raw system blocks)
  const allInjectedLore = extractInjectedLore(safeMessages, rawSystemText);
  const trueLoreEntries = allInjectedLore.filter(entry => entry.category !== 'system_block');

  // 6. Extract Tags & Creator metadata
  const tagPatterns = [
    /<tags>([\s\S]*?)<\/tags>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?Tags(?::\s*|\s*\n)\s*([^\n\r]+)/i,
    /\[Tags\s*:\s*([^\]]+)\]/i,
  ];
  const extractedTagsStr = extractSectionByRegex(rawSystemText, tagPatterns);
  let parsedTags = ['Antigravity Proxy', 'Exported Card', 'Roleplay'];
  if (extractedTagsStr) {
    const customTags = extractedTagsStr
      .split(/[,;\n]+/)
      .map(t => t.trim())
      .filter(t => t.length > 0 && !parsedTags.includes(t));
    parsedTags = [...parsedTags, ...customTags];
  }

  const creatorPatterns = [
    /<creator>([\s\S]*?)<\/creator>/i,
    /(?:^|\n)\s*(?:#{1,4}\s*)?(?:Creator|Author)(?::\s*|\s*\n)\s*([^\n\r]+)/i,
  ];
  const extractedCreator = extractSectionByRegex(rawSystemText, creatorPatterns);

  // 7. Build SillyTavern V2 Character Card Spec Object
  let characterBook: any = undefined;
  if (trueLoreEntries.length > 0) {
    characterBook = {
      name: `${characterName} Lorebook`,
      description: `Auto-extracted lorebook entries for ${characterName}`,
      scan_depth: 100,
      token_budget: 2048,
      recursive_scanning: false,
      entries: trueLoreEntries.map((entry, idx) => ({
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
      creator_notes: `Exported via Google Antigravity Card Exporter Gateway (prototype-1-nextjs)${userName && userName !== 'User' ? ` • Roleplaying with ${userName}` : ''}`,
      system_prompt: separateSystemInstructions || '',
      post_history_instructions: '',
      alternate_greetings: [],
      ...(characterBook ? { character_book: characterBook } : {}),
      tags: parsedTags,
      creator: extractedCreator || 'Antigravity Proxy Gateway',
      character_version: '2.0',
      extensions: {
        ...(userName && userName !== 'User' ? { user_name: userName } : {}),
        ...(userPersona ? { user_persona: userPersona } : {}),
      },
    },
  };

  const jsonOutput = JSON.stringify(cardV2Spec, null, 2);

  // 8. Calculate Telemetry & Stats
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

  // 9. Assemble Google AI Studio System Instructions (Single Box Copy-Paste)
  const studioBlocks: string[] = [];

  // [Character Definition]
  const charDefLines: string[] = [];
  charDefLines.push('[Character Definition]');
  charDefLines.push(`Character Name: ${characterName}`);
  if (finalDescription) {
    charDefLines.push(`\n[Persona & Description]\n${finalDescription}`);
  }
  if (extractedPersonality) {
    charDefLines.push(`\n[Personality & Traits]\n${extractedPersonality}`);
  }
  if (extractedScenario) {
    charDefLines.push(`\n[Scenario & World Setting]\n${extractedScenario}`);
  }
  if (extractedExamples) {
    charDefLines.push(`\n[Example Dialogue]\n${extractedExamples}`);
  }
  if (trueLoreEntries.length > 0) {
    const loreContent = trueLoreEntries.map(e => `• ${e.title}:\n${e.content}`).join('\n\n');
    charDefLines.push(`\n[World Lore & Knowledge]\n${loreContent}`);
  }
  studioBlocks.push(charDefLines.join('\n'));

  // [User Definition]
  const userDefLines: string[] = [];
  userDefLines.push('[User Definition]');
  userDefLines.push(`User Name: ${userName}`);
  userDefLines.push(`User Persona: ${userPersona ? userPersona : '*(No user persona provided)*'}`);
  studioBlocks.push(userDefLines.join('\n'));

  // [System Instructions / Formatting Rules]
  const sysRuleLines: string[] = [];
  sysRuleLines.push('[System Instructions / Formatting Rules]');
  if (separateSystemInstructions) {
    sysRuleLines.push(separateSystemInstructions);
    sysRuleLines.push(
      `• Maintain full immersion in ${characterName}'s persona without breaking character.\n` +
      `• Wrap actions, scene narration, and expressions in *asterisks* (e.g. *smiles faintly*).\n` +
      `• Wrap spoken dialogue in "double quotes" (e.g. "What brings you here?").\n` +
      `• Inner thoughts in \`backticks\`.\n` +
      `• Never speak, act, or make decisions on behalf of ${userName}.`
    );
  } else {
    sysRuleLines.push(
      `• Maintain full immersion in ${characterName}'s persona, lore, tone, and speech habits without breaking character.\n` +
      `• Adhere strictly to roleplay markdown syntax:\n` +
      `  - Wrap character actions, expressions, and physical movements in *asterisks* (e.g. *she looks over, smiling faintly*).\n` +
      `  - Wrap all spoken dialogue in "double quotes" (e.g. "What brings you here?").\n` +
      `  - Wrap internal thoughts or monologues in \`backticks\` (e.g. \`I hope they didn't notice...\`).\n` +
      `• Never speak, act, narrate, or decide on behalf of ${userName}.\n` +
      `• Drive the narrative forward with engaging, multi-layered responses.`
    );
  }
  studioBlocks.push(sysRuleLines.join('\n'));

  // [First Message / Greeting]
  if (firstMes) {
    studioBlocks.push(`[First Message / Greeting]\n${firstMes}`);
  }

  const unifiedStudioInstructions = studioBlocks.join('\n\n---\n\n');
  const fence = unifiedStudioInstructions.includes('```') ? '````' : '```';

  // 10. Assemble Clean Markdown Output
  const sections: string[] = [];

  sections.push(`# 📋 Character Card Export: ${characterName}`);
  sections.push(`> ⚡ **Model**: \`card-exporter\` *(Virtual Edge Utility • 0 Upstream Quota Consumed)*
> 🏷️ **Character Name**: **${characterName}**
> 👤 **User Name**: **${userName}**
> 📊 **Definition Size**: ${totalDefChars.toLocaleString()} chars (~${estDefTokens.toLocaleString()} tokens)
> 💬 **Initial Greeting**: ${greetingChars.toLocaleString()} chars (~${estGreetingTokens.toLocaleString()} tokens)
> 🔄 **Chat History**: ${totalTurns} turns (${userTurns} User • ${assistantTurns} Assistant • ${systemTurns} System)
> 📚 **Injected Lore Entries**: ${trueLoreEntries.length} active entries
> ⏱️ **Exported At**: \`${timestampIso}\``);

  sections.push('---');

  // Google AI Studio System Instructions (Single Box Copy-Paste)
  sections.push(`### 📦 Google AI Studio System Instructions (Single Box Copy-Paste)
*Copy the single block below and paste it directly into Google AI Studio's "System Instructions" box to start roleplaying:*

${fence}markdown
${unifiedStudioInstructions}
${fence}`);

  sections.push('---');

  sections.push(`### 👤 Character Persona & Description\n${finalDescription ? finalDescription : '*(No character description provided)*'}`);

  if (extractedPersonality) {
    sections.push(`### 🧠 Personality & Traits\n${extractedPersonality}`);
  }

  if (extractedScenario) {
    sections.push(`### 🎭 Scenario & World Setting\n${extractedScenario}`);
  }

  sections.push(`### 👤 User Definition & Persona
> 🏷️ **User Name**: **${userName}**
${userPersona ? userPersona : '*(No user persona provided)*'}`);

  sections.push(`### 💬 Initial Greeting (First Message)\n${firstMes ? firstMes : '*(No assistant greeting found in history)*'}`);

  if (extractedExamples) {
    sections.push(`### 💬 Example Dialogue\n${extractedExamples}`);
  }

  if (trueLoreEntries.length > 0) {
    const loreLines = trueLoreEntries.map((l, i) => `**${i + 1}. ${l.title}** (${l.category.toUpperCase()} • ~${l.tokens} tokens):\n\`\`\`\n${l.content}\n\`\`\``);
    sections.push(`### 📚 Injected Lore & World Info (${trueLoreEntries.length})\n${loreLines.join('\n\n')}`);
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
