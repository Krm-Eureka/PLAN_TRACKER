// @ts-nocheck
import { google } from 'googleapis';

/**
 * Creates an authenticated Gmail API client using the user's OAuth access token.
 */
const getGmailClient = (accessToken: string) => {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: 'v1', auth });
};

/**
 * Fetches the user's primary email signature.
 */
export async function getUserSignature(accessToken: string): Promise<string> {
  try {
    const gmail = getGmailClient(accessToken);
    const res = await gmail.users.settings.sendAs.list({
      userId: 'me',
    });
    
    // Find the primary sendAs alias and return its signature
    const primaryAlias = res.data.sendAs?.find(alias => alias.isPrimary);
    return primaryAlias?.signature || '';
  } catch (error) {
    console.error("Failed to fetch signature:", error);
    return '';
  }
}

/**
 * Searches the user's mailbox for threads matching the query.
 * Returns an array of threads.
 */
export async function searchEmailThreads(accessToken: string, query: string, maxResults: number = 5) {
  try {
    const gmail = getGmailClient(accessToken);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults,
    });

    if (!res.data.messages || res.data.messages.length === 0) {
      return [];
    }

    const uniqueThreadIds = new Set<string>();
    const messagesToFetch = [];
    
    for (const m of res.data.messages) {
      if (!uniqueThreadIds.has(m.threadId!)) {
        uniqueThreadIds.add(m.threadId!);
        messagesToFetch.push(m);
      }
    }

    const threads = await Promise.all(messagesToFetch.map(async (m) => {
      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: m.id!,
          format: 'metadata',
          metadataHeaders: ['Subject', 'Message-ID', 'References', 'From', 'To', 'Cc', 'Date'],
        });

        const headers = msgRes.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          threadId: m.threadId!,
          messageId: m.id!,
          internalDate: msgRes.data.internalDate,
          snippet: msgRes.data.snippet,
          subject: getHeader('Subject'),
          from: getHeader('From'),
          to: getHeader('To'),
          cc: getHeader('Cc'),
          originalMessageId: getHeader('Message-ID'),
          references: getHeader('References'),
        };
      } catch(e) {
        return null;
      }
    }));

    return threads.filter(Boolean);
  } catch (error: any) {
    console.error("Failed to search email threads:", error.message || error);
    throw new Error(error.message || "Failed to search email threads");
  }
}

/**
 * Sends a clean email (optionally in-reply-to an existing thread).
 */
export async function sendCleanReply(
  accessToken: string,
  params: {
    to: string;
    cc?: string;
    subject: string;
    htmlBody: string;
    threadId?: string;
    inReplyTo?: string; // The Message-ID of the email we are replying to
    references?: string;
    pdfBase64?: string;
    pdfFilename?: string;
  }
) {
  try {
    const gmail = getGmailClient(accessToken);
    
    // Construct MIME message
    const boundary = `----=_Part_${Date.now()}`;
    const altBoundary = `----=_Alt_${Date.now()}`;
    
    let email = '';
    email += `To: ${params.to}\r\n`;
    if (params.cc) email += `Cc: ${params.cc}\r\n`;
    email += `Subject: ${params.subject}\r\n`;
    email += `MIME-Version: 1.0\r\n`;
    
    // Threading headers
    if (params.inReplyTo) {
      email += `In-Reply-To: ${params.inReplyTo}\r\n`;
      let refs = params.references ? `${params.references} ${params.inReplyTo}` : params.inReplyTo;
      email += `References: ${refs}\r\n`;
    }

    if (params.pdfBase64) {
      email += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;
      email += `--${boundary}\r\n`;
    }

    // HTML Body part
    email += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
    email += `--${altBoundary}\r\n`;
    email += `Content-Type: text/html; charset="UTF-8"\r\n\r\n`;
    email += `${params.htmlBody}\r\n\r\n`;
    email += `--${altBoundary}--\r\n\r\n`;

    // Attachment part
    if (params.pdfBase64 && params.pdfFilename) {
      email += `--${boundary}\r\n`;
      email += `Content-Type: application/pdf; name="${params.pdfFilename}"\r\n`;
      email += `Content-Disposition: attachment; filename="${params.pdfFilename}"\r\n`;
      email += `Content-Transfer-Encoding: base64\r\n\r\n`;
      // Clean up base64 string if it contains data uri prefix
      const b64Data = params.pdfBase64.includes('base64,') ? params.pdfBase64.split('base64,')[1] : params.pdfBase64;
      email += `${b64Data}\r\n\r\n`;
      email += `--${boundary}--\r\n`;
    }

    // Encode to base64url format required by Gmail API
    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
        threadId: params.threadId, // Important to group in the same thread in UI
      },
    });

    return res.data;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}
