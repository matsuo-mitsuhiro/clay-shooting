import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM ?? 'noreply@clay-shooting.vercel.app';
const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://clay-shooting.vercel.app';

export async function sendRegistrationComplete(to: string, name: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: '【クレー射撃 成績管理システム】大会管理者登録完了',
    html: `
      <p>${name} 様</p>
      <p>大会管理者として登録が完了しました。</p>
      <p>以下のURLからログインしてください。</p>
      <p><a href="${BASE_URL}/admin/login">${BASE_URL}/admin/login</a></p>
      <br>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}

export async function sendPasswordReset(to: string, name: string, token: string) {
  const url = `${BASE_URL}/admin/reset-password/${token}`;
  await resend.emails.send({
    from: FROM,
    to,
    subject: '【クレー射撃 成績管理システム】パスワードリセット',
    html: `
      <p>${name} 様</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のURLから1時間以内に新しいパスワードを設定してください。</p>
      <p><a href="${url}">${url}</a></p>
      <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}
