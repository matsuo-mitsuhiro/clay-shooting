import nodemailer from 'nodemailer';

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://clay-shooting.vercel.app';

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

export async function sendRegistrationComplete(to: string, name: string) {
  await getTransporter().sendMail({
    from: `"クレー射撃 成績管理システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃 成績管理システム】大会管理者登録完了',
    html: `
      <p>${name} 様</p>
      <p>大会管理者として登録が完了しました。</p>
      <p>以下のURLからログインしてください。</p>
      <p><a href="${BASE_URL}/admin/login">${BASE_URL}/admin/login</a></p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}

export async function sendPasswordReset(to: string, name: string, token: string) {
  const url = `${BASE_URL}/admin/reset-password/${token}`;
  await getTransporter().sendMail({
    from: `"クレー射撃 成績管理システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃 成績管理システム】パスワードリセット',
    html: `
      <p>${name} 様</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のURLから 「１時間」 以内に新しいパスワードを設定してください。</p>
      <p><a href="${url}">${url}</a></p>
      <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}
