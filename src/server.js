/**
 * The core server that runs on a Cloudflare worker.
 */

import { AutoRouter } from 'itty-router';
import {
  InteractionResponseType,
  InteractionType,
  verifyKey,
} from 'discord-interactions';
import { STRATIV_LAST_SALARY } from './commands.js';
import moment from 'moment-timezone';
// import { getCuteUrl } from './reddit.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

const router = AutoRouter();

/**
 * A simple :wave: hello page to verify the worker is working.
 */
router.get('/', (request, env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

const staticDate = '2024-10-14T01:09:00Z';
/**
 * Main route for all requests sent from Discord.  All incoming messages will
 * include a JSON payload described here:
 * https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object
 */
router.post('/', async (request, env) => {
  const { isValid, interaction } = await server.verifyDiscordRequest(
    request,
    env,
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({
      type: InteractionResponseType.PONG,
    });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    switch (interaction.data.name.toLowerCase()) {
      case STRATIV_LAST_SALARY.name.toLowerCase(): {
        const now = moment().tz('Asia/Dhaka');
        const staticDateTime = moment(staticDate).tz('Asia/Dhaka');
        const duration = moment.duration(now.diff(staticDateTime));
        const days = Math.floor(duration.asDays());
        const hours = duration.hours();
        const minutes = duration.minutes();
        const seconds = duration.seconds();
        let content;

        if (days < 1) {
          content = `\n\n ** You guys got last salary ${hours} Hours, ${minutes} Minutes, ${seconds} Seconds ago.** 😒😒`;
        } else {
          content = `\n\n ** SOON, BUT NOT TODAY ** \n\n \`\`\`Last Salary: ${days} Days, ${hours} Hours, ${minutes} Minutes, ${seconds} Seconds ago.\`\`\``;
        }
        // Send initial message and store message ID and channel ID
        const initialResponse = await fetch(
          `https://discord.com/api/v8/interactions/${interaction.id}/${interaction.token}/callback`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bot ${env.DISCORD_TOKEN}`,
            },
            body: JSON.stringify({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: content,
              },
            }),
          },
        );
        const initialData = await initialResponse.json();
        // eslint-disable-next-line no-undef
        messageId = initialData.id;
        // eslint-disable-next-line no-undef
        channelId = interaction.channel_id;

        return new JsonResponse({ success: true });
      }
      default:
        return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }

  console.error('Unknown Type');
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});
router.all('*', () => new Response('Not Found.', { status: 404 }));

async function verifyDiscordRequest(request, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { interaction: JSON.parse(body), isValid: true };
}

const server = {
  verifyDiscordRequest,
  fetch: router.fetch,
};

export default server;
