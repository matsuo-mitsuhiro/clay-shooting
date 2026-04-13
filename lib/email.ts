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
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃大会運営システム】運営管理者登録完了',
    html: `
      <p>${name} 様</p>
      <p>運営管理者として登録が完了しました。</p>
      <p>以下のURLからログインしてください。</p>
      <p><a href="${BASE_URL}/admin/login">${BASE_URL}/admin/login</a></p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendSupportInvitation(to: string, token: string) {
  const url = `${BASE_URL}/support?token=${token}`;
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃大会運営システム】お問い合わせフォームのご案内',
    html: `
      <p>この度は、クレー射撃大会運営システムをご利用いただきありがとうございます。</p>
      <p>以下のURLから 「１時間」 以内に質問フォームへアクセスしてください。</p>
      <p><a href="${url}">${url}</a></p>
      <p>※このURLは1名・1回のみ有効です。</p>
      <p>※このリンクに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendQuestionConfirmation(to: string, name: string, body: string) {
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃大会運営システム】質問を受け付けました',
    html: `
      <p>${name} 様</p>
      <p>以下の質問を受け付けました。回答をお待ちください。</p>
      <hr>
      <p style="white-space: pre-wrap;">${body}</p>
      <hr>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendQuestionNotification(
  memberCode: string, name: string, affiliation: string | null,
  email: string, body: string
) {
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to: 'matsuo@repros.co.jp',
    subject: '【クレー射撃大会運営システム】新しい質問が届きました',
    html: `
      <p>新しい質問が届きました。</p>
      <hr>
      <p>会員番号: ${memberCode}</p>
      <p>氏名: ${name}</p>
      <p>所属協会: ${affiliation ?? '—'}</p>
      <p>メール: ${email}</p>
      <hr>
      <p style="white-space: pre-wrap;">${body}</p>
      <hr>
      <p><a href="${BASE_URL}/admin/support">管理画面で回答する →</a></p>
      <br>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendAnswerNotification(
  to: string, name: string, questionBody: string, answerBody: string
) {
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃大会運営システム】質問への回答',
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
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

// ============================================================
// 申込関連メール送信関数
// ============================================================

export async function sendApplyCode(to: string, tournamentName: string, code: string): Promise<void> {
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: `「${tournamentName}」申込コードのご案内`,
    html: `
      <p>この度は「${tournamentName}」へのお申込みありがとうございます。</p>
      <p>以下の6桁の申込コードを申込フォームに入力してください。</p>
      <p style="font-size: 36px; font-weight: bold; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 16px 0;">${code}</p>
      <p>このコードの有効期限は <strong>10分</strong> です。</p>
      <p>※このリンクに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendApplyConfirmation(
  to: string,
  name: string,
  tournament: {
    name: string;
    venue: string | null;
    day1_date: string | null;
    day2_date: string | null;
    event_type: string;
    competition_start_time: string | null;
    gate_open_time: string | null;
    reception_start_time: string | null;
    practice_clay_time: string | null;
    cancellation_notice: string | null;
    notes: string | null;
  },
  cancelUrl: string
): Promise<void> {
  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const eventLabel = tournament.event_type === 'trap' ? 'トラップ' : 'スキート';
  const dateStr = tournament.day1_date
    ? fmtDate(tournament.day1_date) + (tournament.day2_date ? ` / ${fmtDate(tournament.day2_date)}` : '')
    : '';

  const lines: string[] = [
    `【大会名】${tournament.name}`,
    tournament.venue ? `【会場】${tournament.venue}` : '',
    dateStr ? `【開催日】${dateStr}` : '',
    `【種目】${eventLabel}`,
    tournament.gate_open_time ? `【射撃場開門】${tournament.gate_open_time}` : '',
    tournament.reception_start_time ? `【受付開始】${tournament.reception_start_time}` : '',
    tournament.practice_clay_time ? `【テストクレー放出】${tournament.practice_clay_time}` : '',
    tournament.competition_start_time ? `【競技開始】${tournament.competition_start_time}` : '',
    tournament.cancellation_notice ? `\n【中止のお知らせ方法】\n${tournament.cancellation_notice}` : '',
    tournament.notes ? `\n【注意事項】\n${tournament.notes}` : '',
  ].filter(Boolean);

  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: `「${tournament.name}」申込完了のお知らせ`,
    html: `
      <p>${name} 様</p>
      <p>「${tournament.name}」へのお申込みが完了しました。</p>
      <hr>
      <pre style="font-family: sans-serif; white-space: pre-wrap;">${lines.join('\n')}</pre>
      <hr>
      <p>申込のキャンセルは以下のURLから手続きできます：<br>
      ただし、運営者が設定したキャンセル期限を超えた場合はキャンセルできません。</p>
      <p><a href="${cancelUrl}">${cancelUrl}</a></p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendCancelToken(to: string, tournamentName: string, cancelUrl: string): Promise<void> {
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: `「${tournamentName}」キャンセル手続きのご案内`,
    html: `
      <p>「${tournamentName}」のキャンセル手続きのご案内です。</p>
      <p>以下のURLから <strong>1時間以内</strong> にキャンセルを完了してください。</p>
      <p><a href="${cancelUrl}">${cancelUrl}</a></p>
      <p>※申込時のメールアドレスを入力してください。</p>
      <p>※このURLは1回のみ有効です。</p>
      <p>※このリンクに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}

export async function sendPasswordReset(to: string, name: string, token: string) {
  const url = `${BASE_URL}/admin/reset-password/${token}`;
  await getTransporter().sendMail({
    from: `"クレー射撃大会運営システム" <${process.env.GMAIL_USER}>`,
    to,
    subject: '【クレー射撃大会運営システム】パスワードリセット',
    html: `
      <p>${name} 様</p>
      <p>パスワードリセットのリクエストを受け付けました。</p>
      <p>以下のURLから 「１時間」 以内に新しいパスワードを設定してください。</p>
      <p><a href="${url}">${url}</a></p>
      <p>このリクエストに心当たりがない場合は、このメールを無視してください。</p>
      <br>
      <p>※このメールアドレス（jpn.clayshooting@gmail.com）は送信専用の為、受取できません。</p>
      <p>クレー射撃大会運営システム</p>
    `,
  });
}
