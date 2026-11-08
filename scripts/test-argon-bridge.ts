const https = require('https');
const { execSync } = require('child_process');

interface LanguageServerInfo {
  port: number;
  csrfToken: string;
}

let cachedInfo: LanguageServerInfo | null = null;
let lastDiscoveryTime = 0;

function discoverLanguageServer(): LanguageServerInfo | null {
  const now = Date.now();
  if (cachedInfo && (now - lastDiscoveryTime < 60000)) {
    return cachedInfo;
  }

  // 1. Check environment variables
  const envPort = process.env.LOCAL_LS_PORT;
  const envToken = process.env.LOCAL_LS_CSRF_TOKEN;
  if (envPort && envToken) {
    cachedInfo = { port: parseInt(envPort, 10), csrfToken: envToken.trim() };
    lastDiscoveryTime = now;
    return cachedInfo;
  }

  // 2. Discover from Windows process table
  try {
    const cmdLineOut = execSync('powershell -Command "Get-CimInstance Win32_Process -Filter \\"name = \'language_server.exe\'\\" | Select-Object -Property ProcessId, CommandLine | ConvertTo-Json"', { encoding: 'utf8', timeout: 5000 });
    if (!cmdLineOut || !cmdLineOut.trim()) return null;

    let procData: any = JSON.parse(cmdLineOut);
    if (Array.isArray(procData)) procData = procData[0];
    if (!procData || !procData.CommandLine) return null;

    const pid = procData.ProcessId;
    const cmdLine = procData.CommandLine;

    // Extract csrf token: --csrf_token <token>
    const matchToken = cmdLine.match(/--csrf_token\s+([a-f0-9\-]+)/i);
    const csrfToken = matchToken ? matchToken[1] : null;
    if (!csrfToken) return null;

    // Find listening port for this PID
    const netstatOut = execSync(`cmd /c "netstat -ano | findstr ${pid}"`, { encoding: 'utf8', timeout: 5000 });
    const listeningLines = netstatOut.split('\n').filter(l => l.includes('LISTENING') && l.includes('127.0.0.1:'));
    
    // Sort ports: language_server.exe typically listens on two ports (API server is the lower port, webview is the higher)
    const ports: number[] = [];
    for (const l of listeningLines) {
      const matchPort = l.match(/127\.0\.0\.1:(\d+)/);
      if (matchPort) ports.push(parseInt(matchPort[1], 10));
    }
    ports.sort((a, b) => a - b);
    if (ports.length === 0) return null;

    cachedInfo = { port: ports[0], csrfToken };
    lastDiscoveryTime = now;
    return cachedInfo;
  } catch (e: any) {
    console.warn("Language server discovery failed:", e.message);
    return null;
  }
}

function callRpc(info: LanguageServerInfo, method: string, body: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: '127.0.0.1',
      port: info.port,
      path: `/exa.language_server_pb.LanguageServerService/${method}`,
      method: 'POST',
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'x-codeium-csrf-token': info.csrfToken,
        'Connect-Protocol-Version': '1',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function test() {
  console.log("Discovering language_server.exe...");
  const info = discoverLanguageServer();
  if (!info) {
    console.error("Could not discover language_server.exe!");
    return;
  }
  console.log(`Discovered: Port ${info.port}, CSRF ${info.csrfToken}`);

  console.log("Checking quota...");
  const quota = await callRpc(info, 'RetrieveUserQuotaSummary', {});
  const argonGroup = quota.response?.groups?.find((g: any) => g.displayName?.includes('Argon'));
  console.log("Argon Quota:", JSON.stringify(argonGroup, null, 2));

  console.log("Testing generation for gemini-4-argon-medium...");
  const start = await callRpc(info, 'StartCascade', {
    source: 'CORTEX_TRAJECTORY_SOURCE_CASCADE_CLIENT',
    requestedModel: 'MODEL_PLACEHOLDER_M418'
  });
  const cascadeId = start.cascadeId;
  console.log("Cascade started:", cascadeId);

  await callRpc(info, 'SendUserCascadeMessage', {
    cascadeId,
    cascadeConfig: {
      plannerConfig: {
        planModel: 'MODEL_PLACEHOLDER_M418'
      }
    },
    items: [
      { text: 'Describe a futuristic cybernetic city in 2 vivid sentences.' }
    ]
  });

  console.log("Polling trajectory steps...");
  let completedResponse: any = null;
  const startTime = Date.now();
  while (Date.now() - startTime < 30000) {
    await new Promise(r => setTimeout(r, 400));
    const stepsData = await callRpc(info, 'GetCascadeTrajectorySteps', { cascadeId });
    const steps = stepsData.steps || [];
    for (const s of steps) {
      if (s.plannerResponse?.response) {
        completedResponse = s.plannerResponse;
        break;
      }
    }
    if (completedResponse) break;
  }

  if (completedResponse) {
    console.log("\n🎉 GEMINI 4 ARGON GENERATION SUCCEEDED! 🎉");
    console.log("Response:", completedResponse.response);
    console.log("Thinking signature:", completedResponse.thinkingSignature);
  } else {
    console.error("Timed out waiting for response.");
  }
}

test().catch(console.error);
