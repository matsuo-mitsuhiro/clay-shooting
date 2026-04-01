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

export async function sendSupportInvitation(to: string, token: string) {
  const url = `${BASE_URL}/support?token=${token}`;
  await getTransporter().sendMail({
    from: `"クレー射撃 成績管理システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃 成績管理システム】お問い合わせフォームのご案内',
    html: `
      <p>この度は、クレー射撃 成績管理システムをご利用いただきありがとうございます。</p>
      <p>以下のURLから 「１時間」 以内に質問フォームへアクセスしてください。</p>
      <p><a href="${url}">${url}</a></p>
      <p>※このURLは1名・1回のみ有効です。</p>
      <p>※このリンクに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}

export async function sendQuestionConfirmation(to: string, name: string, body: string) {
  await getTransporter().sendMail({
    from: `"クレー射撃 成績管理システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃 成績管理システム】質問を受け付けました',
    html: `
      <p>${name} 様</p>
      <p>以下の質問を受け付けました。回答をお待ちください。</p>
      <hr>
      <p style="white-space: pre-wrap;">${body}</p>
      <hr>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}

export async function sendQuestionNotification(
  memberCode: string, name: string, affiliation: string | null,
  email: string, body: string
) {
  await getTransporter().sendMail({
    from: `"クレー射撃 成績管理システム" <${process.env.GMAIL_USER}>`,
    to: 'matsuo@repros.co.jp',
    subject: '【クレー射撃 成績管理システム】新しい質問が届きました',
    html: `
      <p>新しい質問が届きました。</p>
      <hr>
      <p>会員番号: ${memberCode}</p>
      <p>氏名: ${name}</p>
      <p>所属: ${affiliation ?? '—'}</p>
      <p>メール: ${email}</p>
      <hr>
      <p style="white-space: pre-wrap;">${body}</p>
      <hr>
      <p><a href="${BASE_URL}/admin/support">管理画面で回答する →</a></p>
      <br>
      <p>クレー射撃 成績管理システム</p>
    `,
  });
}

export async function sendAnswerNotification(
  to: string, name: string, questionBody: string, answerBody: string
) {
  await getTransporter().sendMail({
    from: `"クレー射撃 成績管理システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃 成績管理システム】質問への回答',
    html: `
      <p>${name} 様</p>
      <p>ご質問への回答をお送りします。</p>
      <hr>
      <p><strong>【ご質問】</strong></p>
      <p style="white-space: pre-wrap;">${questionBody}</p>
      <hr>
      <p><strong>【回答】</strong></p>
      <p style="white-space: pre-wrap;">${answerBody}</p>
      <hr>
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
