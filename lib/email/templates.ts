function wrapEmailBody(title: string, bodyHtml: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="font-size: 18px; margin-bottom: 16px;">${title}</h2>
      ${bodyHtml}
      <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">
        Esta é uma mensagem automática do Sistema de Horas UFSJ. Não responda a este email.
      </p>
    </div>
  `;
}

/**
 * Notifica o aluno sobre uma novidade em qualquer um dos 3 cards
 * (Complementar, Extensão, Estágio): aprovação, rejeição, horas concedidas etc.
 */
export function studentStatusUpdateEmail({
  studentName,
  itemLabel,
  statusHeadline,
  message,
}: {
  studentName: string;
  itemLabel: string;
  statusHeadline: string;
  message: string;
}) {
  const subject = `[Horas UFSJ] ${itemLabel} — ${statusHeadline}`;
  const html = wrapEmailBody(statusHeadline, `
    <p>Olá, ${studentName},</p>
    <p>Há uma novidade em <strong>${itemLabel}</strong>:</p>
    <p style="padding: 12px; background: #f3f4f6; border-radius: 8px;">${message}</p>
    <p>Acesse o sistema para mais detalhes.</p>
  `);

  return { subject, html };
}

/**
 * Notifica o coordenador citado numa nova proposta de projeto de extensão.
 */
export function coordinatorNotificationEmail({
  coordinatorName,
  studentName,
  projectTitle,
}: {
  coordinatorName: string;
  studentName: string;
  projectTitle: string;
}) {
  const subject = `[Horas UFSJ] Você foi indicado como coordenador de "${projectTitle}"`;
  const html = wrapEmailBody("Você foi indicado como coordenador", `
    <p>Olá, ${coordinatorName},</p>
    <p>
      O(a) aluno(a) <strong>${studentName}</strong> cadastrou o projeto de
      extensão <strong>"${projectTitle}"</strong> no Sistema de Horas UFSJ,
      indicando você como coordenador(a).
    </p>
    <p>
      A proposta está em avaliação pela coordenação de extensão. Caso tenha
      dúvidas, entre em contato com o aluno ou com a coordenação.
    </p>
  `);

  return { subject, html };
}
