import tls from "node:tls";

type SendMailArgs = {
  smtpUser: string;
  smtpPass: string;
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

function b64(s: string) {
  return Buffer.from(s, "utf8").toString("base64");
}

function normalizeCrlf(s: string) {
  return s.replace(/\r?\n/g, "\r\n");
}

async function smtpDialogue(socket: tls.TLSSocket, cmd: string) {
  socket.write(cmd + "\r\n");
  return await readResponse(socket);
}

function readResponse(socket: tls.TLSSocket): Promise<{ code: number; lines: string[] }> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const lines: string[] = [];

    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      while (true) {
        const idx = buf.indexOf("\r\n");
        if (idx === -1) break;
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (!line) continue;
        lines.push(line);
        const m = line.match(/^(\d{3})([ -])\s*(.*)$/);
        if (m && m[2] === " ") {
          cleanup();
          resolve({ code: Number(m[1]), lines });
          return;
        }
      }
    };

    const onErr = (e: any) => {
      cleanup();
      reject(e);
    };

    const onClose = () => {
      cleanup();
      reject(new Error("smtp_closed"));
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onErr);
      socket.off("close", onClose);
    };

    socket.on("data", onData);
    socket.on("error", onErr);
    socket.on("close", onClose);
  });
}

export async function sendMailGmailSmtp(args: SendMailArgs): Promise<void> {
  const { smtpUser, smtpPass, to, subject, text, replyTo } = args;

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
  });

  await new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", () => resolve());
    socket.once("error", (e) => reject(e));
  });

  const greet = await readResponse(socket);
  if (greet.code !== 220) throw new Error("smtp_greet_failed");

  const ehlo = await smtpDialogue(socket, `EHLO portal-irp`);
  if (ehlo.code !== 250) throw new Error("smtp_ehlo_failed");

  const auth = await smtpDialogue(socket, "AUTH LOGIN");
  if (auth.code !== 334) throw new Error("smtp_auth_failed");
  const u = await smtpDialogue(socket, b64(smtpUser));
  if (u.code !== 334) throw new Error("smtp_auth_user_failed");
  const p = await smtpDialogue(socket, b64(smtpPass));
  if (p.code !== 235) throw new Error("smtp_auth_pass_failed");

  const fromCmd = await smtpDialogue(socket, `MAIL FROM:<${smtpUser}>`);
  if (fromCmd.code !== 250) throw new Error("smtp_mailfrom_failed");
  const rcptCmd = await smtpDialogue(socket, `RCPT TO:<${to}>`);
  if (rcptCmd.code !== 250 && rcptCmd.code !== 251) throw new Error("smtp_rcpt_failed");

  const dataCmd = await smtpDialogue(socket, "DATA");
  if (dataCmd.code !== 354) throw new Error("smtp_data_failed");

  const headers: string[] = [];
  headers.push(`From: Portal IRP <${smtpUser}>`);
  headers.push(`To: <${to}>`);
  headers.push(`Subject: ${subject}`);
  headers.push("MIME-Version: 1.0");
  headers.push("Content-Type: text/plain; charset=utf-8");
  headers.push("Content-Transfer-Encoding: 8bit");
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  const message = normalizeCrlf(headers.join("\r\n") + "\r\n\r\n" + text + "\r\n");
  socket.write(message);
  socket.write("\r\n.\r\n");

  const dataOk = await readResponse(socket);
  if (dataOk.code !== 250) throw new Error("smtp_send_failed");

  try {
    await smtpDialogue(socket, "QUIT");
  } catch {}
  try {
    socket.end();
  } catch {}
}


