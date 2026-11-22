/* Stark Warden: quick guides in several languages. MACHINE DRAFT TRANSLATIONS: they have not been reviewed by a native
   speaker or a lawyer. They are marked as drafts on screen. English is the reference text. */
(function (root) {
  'use strict';
  var SW = root.SW = root.SW || {};
  SW.data = SW.data || {};

  SW.data.langs = [
    { id: 'en', label: 'English' }, { id: 'es', label: 'Español' }, { id: 'fr', label: 'Français' }, { id: 'pt', label: 'Português' },
    { id: 'vi', label: 'Tiếng Việt' }, { id: 'zh', label: '中文 (简体)' }, { id: 'tl', label: 'Tagalog' }
  ];

  SW.data.quick = {
    en: {
      draft: '',
      scam: { title: 'Scam safety: 8 rules', items: [
        'Stop and breathe. Scammers rush you so you cannot think.',
        'Never pay with gift cards, crypto, wire transfers or payment apps to someone you do not know.',
        'Never share a code, password or PIN, even with someone who says they are from your bank.',
        'Do not trust caller ID, links or phone numbers in a message. Contact the company yourself using a number you already have.',
        'Real government agencies do not threaten arrest by phone or text.',
        'Talk to someone you trust before you pay or send anything.',
        'If you paid, call your bank or card company right away.',
        'Report scams at ReportFraud.ftc.gov (copy the address into your browser).'] },
      debt: { title: 'Debt collectors: 7 things to know', items: [
        'Ask for the debt in writing (a validation notice). Do not pay on a phone call alone.',
        'You have about 30 days to dispute a debt in writing. Send it by certified mail.',
        'Collectors cannot call before 8 a.m. or after 9 p.m., or threaten arrest.',
        'You can tell a collector in writing to stop contacting you. It does not erase the debt.',
        'Do not pay or sign anything on an old debt until you check the time limit. A payment can restart the clock.',
        'Keep a log of every call, message and letter.',
        'You can complain to the CFPB, the FTC and your state attorney general, and a consumer attorney may take your case with no upfront fee.'] }
    },
    es: {
      draft: 'Traducción automática, sin revisar. Revísela con alguien de confianza antes de depender de ella.',
      scam: { title: 'Seguridad ante estafas: 8 reglas', items: [
        'Deténgase y respire. Los estafadores le apuran para que no piense.',
        'Nunca pague con tarjetas de regalo, criptomonedas, transferencias o aplicaciones de pago a alguien que no conoce.',
        'Nunca comparta un código, contraseña o PIN, ni siquiera con alguien que dice ser de su banco.',
        'No confíe en el identificador de llamadas, enlaces ni números de un mensaje. Contacte a la empresa usted mismo con un número que ya tenga.',
        'Las agencias del gobierno de verdad no amenazan con arrestarlo por teléfono ni por mensaje.',
        'Hable con alguien de confianza antes de pagar o enviar algo.',
        'Si ya pagó, llame de inmediato a su banco o a la compañía de su tarjeta.',
        'Denuncie las estafas en ReportFraud.ftc.gov (copie la dirección en su navegador).'] },
      debt: { title: 'Cobradores de deudas: 7 cosas que debe saber', items: [
        'Pida la deuda por escrito (una notificación de validación). No pague solo por una llamada.',
        'Tiene unos 30 días para disputar una deuda por escrito. Envíela por correo certificado.',
        'Los cobradores no pueden llamar antes de las 8 a. m. ni después de las 9 p. m., ni amenazar con arresto.',
        'Puede pedir por escrito a un cobrador que deje de contactarlo. Esto no borra la deuda.',
        'No pague ni firme nada sobre una deuda antigua sin revisar el plazo legal. Un pago puede reiniciar el plazo.',
        'Anote cada llamada, mensaje y carta.',
        'Puede presentar una queja ante el CFPB, la FTC y la fiscalía general de su estado; un abogado del consumidor puede aceptar su caso sin cobro inicial.'] }
    },
    fr: {
      draft: 'Traduction automatique, non relue. Faites-la vérifier par une personne de confiance avant de vous y fier.',
      scam: { title: 'Sécurité contre les arnaques : 8 règles', items: [
        'Arrêtez-vous et respirez. Les escrocs vous pressent pour vous empêcher de réfléchir.',
        'Ne payez jamais par cartes-cadeaux, cryptomonnaie, virement ou application de paiement une personne que vous ne connaissez pas.',
        'Ne partagez jamais un code, un mot de passe ou un code PIN, même avec quelqu’un qui dit venir de votre banque.',
        'Ne vous fiez pas à l’identifiant de l’appelant, aux liens ni aux numéros d’un message. Contactez vous-même l’entreprise avec un numéro que vous avez déjà.',
        'Les vraies agences gouvernementales ne menacent pas d’arrestation par téléphone ou par SMS.',
        'Parlez à une personne de confiance avant de payer ou d’envoyer quoi que ce soit.',
        'Si vous avez payé, appelez tout de suite votre banque ou l’émetteur de votre carte.',
        'Signalez les arnaques sur ReportFraud.ftc.gov (copiez l’adresse dans votre navigateur).'] },
      debt: { title: 'Recouvreurs de dettes : 7 points à connaître', items: [
        'Demandez la dette par écrit (un avis de validation). Ne payez pas sur un simple appel.',
        'Vous avez environ 30 jours pour contester une dette par écrit. Envoyez la lettre en recommandé.',
        'Un recouvreur ne peut pas appeler avant 8 h ni après 21 h, ni menacer d’arrestation.',
        'Vous pouvez demander par écrit à un recouvreur de cesser de vous contacter. Cela n’efface pas la dette.',
        'Ne payez ni ne signez rien pour une vieille dette sans vérifier le délai de prescription. Un paiement peut le faire repartir.',
        'Tenez un journal de chaque appel, message et lettre.',
        'Vous pouvez porter plainte auprès du CFPB, de la FTC et du procureur général de votre État ; un avocat spécialisé peut prendre votre dossier sans frais initiaux.'] }
    },
    pt: {
      draft: 'Tradução automática, não revisada. Peça a alguém de confiança que revise antes de depender dela.',
      scam: { title: 'Segurança contra golpes: 8 regras', items: [
        'Pare e respire. Os golpistas apressam você para que não pense.',
        'Nunca pague com cartões-presente, criptomoedas, transferências ou aplicativos de pagamento a quem você não conhece.',
        'Nunca compartilhe um código, senha ou PIN, nem com quem diz ser do seu banco.',
        'Não confie no identificador de chamadas, links ou números de uma mensagem. Entre em contato com a empresa por um número que você já tem.',
        'Órgãos do governo de verdade não ameaçam prender por telefone ou mensagem.',
        'Converse com alguém de confiança antes de pagar ou enviar qualquer coisa.',
        'Se você já pagou, ligue imediatamente para o seu banco ou operadora do cartão.',
        'Denuncie golpes em ReportFraud.ftc.gov (copie o endereço no navegador).'] },
      debt: { title: 'Cobradores de dívidas: 7 pontos importantes', items: [
        'Peça a dívida por escrito (um aviso de validação). Não pague só por telefone.',
        'Você tem cerca de 30 dias para contestar uma dívida por escrito. Envie por correio registrado.',
        'Cobradores não podem ligar antes das 8h nem depois das 21h, nem ameaçar com prisão.',
        'Você pode pedir por escrito que um cobrador pare de contatá-lo. Isso não apaga a dívida.',
        'Não pague nem assine nada sobre uma dívida antiga sem verificar o prazo legal. Um pagamento pode reiniciar o prazo.',
        'Anote cada ligação, mensagem e carta.',
        'Você pode reclamar ao CFPB, à FTC e à procuradoria-geral do seu estado; um advogado do consumidor pode aceitar o caso sem custo inicial.'] }
    },
    vi: {
      draft: 'Bản dịch máy, chưa được kiểm tra. Hãy nhờ người đáng tin cậy xem lại trước khi dựa vào.',
      scam: { title: 'An toàn trước lừa đảo: 8 quy tắc', items: [
        'Dừng lại và hít thở. Kẻ lừa đảo thúc ép bạn để bạn không kịp suy nghĩ.',
        'Không bao giờ trả tiền bằng thẻ quà tặng, tiền mã hóa, chuyển khoản hoặc ứng dụng thanh toán cho người bạn không quen.',
        'Không bao giờ chia sẻ mã xác nhận, mật khẩu hoặc mã PIN, kể cả với người nói là từ ngân hàng của bạn.',
        'Đừng tin số hiển thị cuộc gọi, đường link hoặc số điện thoại trong tin nhắn. Hãy tự liên hệ công ty bằng số bạn đã có.',
        'Cơ quan chính phủ thật không đe dọa bắt giữ qua điện thoại hay tin nhắn.',
        'Nói chuyện với người bạn tin tưởng trước khi trả tiền hoặc gửi bất cứ thứ gì.',
        'Nếu đã trả tiền, hãy gọi ngay cho ngân hàng hoặc công ty thẻ của bạn.',
        'Báo cáo lừa đảo tại ReportFraud.ftc.gov (sao chép địa chỉ vào trình duyệt).'] },
      debt: { title: 'Công ty đòi nợ: 7 điều cần biết', items: [
        'Yêu cầu khoản nợ bằng văn bản (thông báo xác nhận nợ). Đừng trả tiền chỉ qua một cuộc gọi.',
        'Bạn có khoảng 30 ngày để phản đối khoản nợ bằng văn bản. Gửi bằng thư bảo đảm.',
        'Người đòi nợ không được gọi trước 8 giờ sáng hoặc sau 9 giờ tối, và không được dọa bắt giữ.',
        'Bạn có thể yêu cầu bằng văn bản để họ ngừng liên lạc. Việc này không xóa khoản nợ.',
        'Đừng trả tiền hay ký gì cho khoản nợ cũ khi chưa kiểm tra thời hiệu. Một lần thanh toán có thể làm thời hiệu bắt đầu lại.',
        'Ghi lại mọi cuộc gọi, tin nhắn và thư.',
        'Bạn có thể khiếu nại với CFPB, FTC và tổng chưởng lý tiểu bang; luật sư bảo vệ người tiêu dùng có thể nhận vụ mà không thu phí trước.'] }
    },
    zh: {
      draft: '机器翻译,未经审校。依赖前请让可信的人检查。',
      scam: { title: '防诈骗安全:8 条规则', items: [
        '先停下来,深呼吸。骗子催促你,就是不想让你思考。',
        '不要用礼品卡、加密货币、转账或支付应用向不认识的人付款。',
        '不要分享验证码、密码或 PIN,即使对方自称是你的银行。',
        '不要相信来电显示、信息里的链接或电话号码。用你已有的号码自己联系该公司。',
        '真正的政府机构不会通过电话或短信威胁逮捕你。',
        '付款或发送任何东西之前,先和你信任的人商量。',
        '如果已经付款,请立刻联系你的银行或信用卡公司。',
        '在 ReportFraud.ftc.gov 举报诈骗(把地址复制到浏览器中)。'] },
      debt: { title: '债务催收:需要知道的 7 件事', items: [
        '要求对方提供书面债务通知(验证通知)。不要只凭一通电话就付款。',
        '你大约有 30 天时间以书面形式对债务提出异议。请用挂号信寄出。',
        '催收人不得在早上 8 点前或晚上 9 点后来电,也不得威胁逮捕你。',
        '你可以书面要求催收人停止联系你。这不会消除债务。',
        '在查明诉讼时效之前,不要为旧债务付款或签字。一笔付款可能使时效重新计算。',
        '记录每一次电话、信息和信件。',
        '你可以向 CFPB、FTC 和你所在州的总检察长投诉;消费者律师可能无需预付费用就接手你的案件。'] }
    },
    tl: {
      draft: 'Machine translation, hindi pa nasusuri. Ipasuri sa mapagkakatiwalaang tao bago umasa dito.',
      scam: { title: 'Kaligtasan laban sa scam: 8 patakaran', items: [
        'Huminto at huminga. Minamadali ka ng mga scammer para hindi ka makapag-isip.',
        'Huwag magbayad gamit ang gift card, crypto, wire transfer o payment app sa taong hindi mo kilala.',
        'Huwag magbigay ng code, password o PIN, kahit sa nagsasabing taga-bangko mo sila.',
        'Huwag magtiwala sa caller ID, link o numero sa mensahe. Ikaw mismo ang makipag-ugnayan sa kumpanya gamit ang numerong hawak mo na.',
        'Ang totoong ahensya ng gobyerno ay hindi nananakot ng pag-aresto sa telepono o text.',
        'Makipag-usap sa taong pinagkakatiwalaan mo bago magbayad o magpadala ng anuman.',
        'Kung nakabayad ka na, tawagan agad ang bangko o kumpanya ng card mo.',
        'Iulat ang scam sa ReportFraud.ftc.gov (kopyahin ang address sa browser).'] },
      debt: { title: 'Mga debt collector: 7 dapat malaman', items: [
        'Hingin ang utang nang nakasulat (validation notice). Huwag magbayad dahil lang sa tawag.',
        'Mayroon kang mga 30 araw para kontrahin ang utang nang nakasulat. Ipadala sa certified mail.',
        'Hindi puwedeng tumawag ang collector bago mag-8 ng umaga o pagkatapos ng 9 ng gabi, o manakot ng pag-aresto.',
        'Maaari mong hilingin nang nakasulat na tumigil sila sa pakikipag-ugnayan. Hindi nito binubura ang utang.',
        'Huwag magbayad o pumirma sa lumang utang hangga’t hindi mo nasusuri ang takdang panahon. Maaaring magsimulang muli ang bilang dahil sa bayad.',
        'Itala ang bawat tawag, mensahe at sulat.',
        'Maaari kang magreklamo sa CFPB, FTC at attorney general ng estado mo; maaaring tanggapin ng consumer attorney ang kaso nang walang paunang bayad.'] }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
